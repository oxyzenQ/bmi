// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// @vitest-environment node
//
// night-frontier-Z6 - the keyed witness law battery (split from the
// ledger-continuity battery to keep both under the LOC ratchet).
//
// Proves the keyed witness law end to end:
//   1. Keyed chain math: the module's keyed chain equals an INDEPENDENT
//      WebCrypto HMAC reference (plain genesis, then HMAC links).
//   2. Re-seal resistance: the attacker's unkeyed recomputation can
//      never reproduce a keyed witness head.
//   3. Witness semantics under a key: keyed advance, keyed freeze,
//      tombstone on key loss or rotation, the plain-to-keyed upgrade,
//      and fail-closed parse rules for damaged witnesses.
//   4. Audit states: witness-opaque plus ok/violated under a key.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const lsStore = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => lsStore.get(k) ?? null,
	setItem: (k: string, v: string) => lsStore.set(k, String(v)),
	removeItem: (k: string) => lsStore.delete(k),
	clear: () => lsStore.clear()
});

const dbState = vi.hoisted(() => ({
	meta: new Map<string, string>()
}));

vi.mock('../db', () => ({
	isIndexedDbAvailable: () => true,
	dbMetaGet: vi.fn(async (key: string) => dbState.meta.get(key) ?? null),
	dbMetaSet: vi.fn(async (key: string, value: string) => {
		dbState.meta.set(key, value);
	}),
	dbSet: vi.fn(async () => {}),
	dbRemove: vi.fn(async () => {}),
	dbGetAll: vi.fn(async () => []),
	dbClose: vi.fn(),
	dbBackupSave: vi.fn(async () => 1),
	dbBackupGetAll: vi.fn(async () => []),
	dbBackupLatest: vi.fn(async () => null),
	dbBackupDelete: vi.fn(async () => {})
}));

import {
	STORAGE_KEYS,
	initStorage,
	storageInvalidateAll,
	_resetIdbWriteSeqForTesting
} from '../storage';
import {
	META_LEDGER_CHAIN,
	computeLedgerChain,
	computeWitnessChain,
	getSealedLedgerChain,
	sealLedgerChain,
	reseatLedgerChainAfterSave
} from '../ledger-continuity';
import { auditLedgerContinuity } from '../bmi-history';
import { _resetAtRestStateForTesting } from '../at-rest-state';
import {
	_resetWitnessKeyForTesting,
	installWitnessKey,
	wipeWitnessKey,
	getWitnessKeyFingerprint
} from '../witness-key';

const HISTORY = STORAGE_KEYS.HISTORY;

/** Deterministic xorshift32 PRNG - the battery is reproducible forever. */
function makePrng(seed: number): () => number {
	let s = seed | 0 || 1;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		s >>>= 0;
		return s / 0x100000000;
	};
}

function randomRecords(
	prng: () => number,
	count: number
): { timestamp: number; bmi: number; height: number; weight: number; age?: number }[] {
	const base = 1_700_000_000_000;
	return Array.from({ length: count }, (_, i) => ({
		timestamp: base + i * 3_600_000 + Math.floor(prng() * 1000),
		bmi: Math.round((15 + prng() * 20) * 100) / 100,
		height: Math.round(120 + prng() * 80),
		weight: Math.round(30 + prng() * 100),
		age: prng() > 0.5 ? 10 + Math.floor(prng() * 70) : undefined
	}));
}

async function sha256HexInput(text: string): Promise<string> {
	const bytes = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer as ArrayBuffer);
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

beforeEach(() => {
	lsStore.clear();
	dbState.meta.clear();
	storageInvalidateAll();
	_resetIdbWriteSeqForTesting();
	_resetAtRestStateForTesting();
	_resetWitnessKeyForTesting();
	initStorage();
});

// ── night-frontier-Z6: the keyed witness law ──
// The witness over a passphrase-protected ledger becomes an HMAC-SHA256
// chain under the witness attestation key. The property that matters:
// a party who rewrites both the history and the meta store can no
// longer re-seal — the next link requires the key, and the key requires
// the passphrase.

/** Deterministic 32-byte witness key material for a given seed. */
function witnessKeyBytes(seed: number): Uint8Array {
	const prng = makePrng(seed);
	const bytes = new Uint8Array(32);
	for (let i = 0; i < 32; i++) bytes[i] = Math.floor(prng() * 256);
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(key: Uint8Array, text: string): Promise<string> {
	const ab = new ArrayBuffer(key.length);
	new Uint8Array(ab).set(key);
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		ab,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(text));
	return bytesToHex(new Uint8Array(sig));
}

/** The independent KEYED reference: plain genesis, then HMAC links. */
async function keyedReferenceHead(
	key: Uint8Array,
	records: { timestamp: number; bmi: number; height: number; weight: number; age?: number }[]
): Promise<string> {
	let link = await sha256HexInput('bmi-stellar-ledger-v4-genesis');
	for (const r of records) {
		link = await hmacSha256Hex(
			key,
			`${link}:${JSON.stringify({
				timestamp: r.timestamp,
				bmi: r.bmi,
				height: r.height,
				weight: r.weight,
				age: r.age
			})}`
		);
	}
	return link;
}

describe('keyed witness chain math (night-frontier-Z6)', () => {
	it('matches an independent WebCrypto HMAC reference implementation', async () => {
		const key = witnessKeyBytes(0x6b65);
		await installWitnessKey(new Uint8Array(key));
		const prng = makePrng(0x7a36);
		const records = randomRecords(prng, 12);
		const chain = await computeWitnessChain(records as never, 'keyed');
		expect(chain.head).toBe(await keyedReferenceHead(key, records));
		expect(chain.length).toBe(12);
		// A bare chain computation writes no witness: the meta store stays
		// untouched until a real seal happens (the seal battery pins mode
		// and fingerprint there).
		expect(await getSealedLedgerChain()).toBeNull();
	});

	it('seals keyed with the mode and fingerprint when a key is installed', async () => {
		const key = witnessKeyBytes(0x1111);
		await installWitnessKey(new Uint8Array(key));
		const records = randomRecords(makePrng(0x2222), 4) as never;
		await sealLedgerChain(records);
		const sealed = await getSealedLedgerChain();
		expect(sealed).toEqual({
			head: await computeWitnessChain(records, 'keyed').then((c) => c.head),
			length: 4,
			mode: 'keyed',
			kf: getWitnessKeyFingerprint()
		});
	});

	it('diverges the keyed head from the plain head for the same records', async () => {
		const key = witnessKeyBytes(0x3333);
		await installWitnessKey(new Uint8Array(key));
		const records = randomRecords(makePrng(0x4444), 6) as never;
		const plain = await computeLedgerChain(records);
		const keyed = await computeWitnessChain(records, 'keyed');
		expect(keyed.head).not.toBe(plain.head);
		// The re-seal resistance property in one line: the attacker's
		// unkeyed recomputation can NEVER reproduce the keyed witness.
	});

	it('stays byte-identical for an empty ledger (genesis head, length zero)', async () => {
		const key = witnessKeyBytes(0x5555);
		await installWitnessKey(new Uint8Array(key));
		const genesis = await sha256HexInput('bmi-stellar-ledger-v4-genesis');
		const keyed = await computeWitnessChain([], 'keyed');
		expect(keyed).toEqual({ head: genesis, length: 0 });
		await sealLedgerChain([]);
		const sealed = await getSealedLedgerChain();
		expect(sealed!.head).toBe(genesis);
		expect(sealed!.mode).toBe('keyed');
	});

	it('rejects a keyed chain request without an attestation key (fail-closed)', async () => {
		const records = randomRecords(makePrng(0x6666), 3) as never;
		await expect(computeWitnessChain(records, 'keyed')).rejects.toThrow(
			/keyed witness chain requested without an attestation key/
		);
	});
});

describe('keyed witness semantics (night-frontier-Z6)', () => {
	it('advances keyed on a legit save transition and freezes on a tampered pre-state', async () => {
		const key = witnessKeyBytes(0x7f11);
		await installWitnessKey(new Uint8Array(key));
		const pre = randomRecords(makePrng(0x8f11), 4) as never;
		await sealLedgerChain(pre);
		const before = await getSealedLedgerChain();
		expect(before!.mode).toBe('keyed');
		const next = [
			...(pre as unknown[]),
			{ timestamp: 1_700_010_000_000, bmi: 22.9, height: 175, weight: 70, age: 30 }
		] as never;
		await reseatLedgerChainAfterSave(pre, next);
		const after = await getSealedLedgerChain();
		expect(after!.mode).toBe('keyed');
		expect(after!.head).toBe((await computeWitnessChain(next, 'keyed')).head);
		// Tampered pre-state, same key: the freeze rule stands untouched.
		const tamperedPre = randomRecords(makePrng(0x9f11), 4) as never;
		const next2 = randomRecords(makePrng(0xa111), 5) as never;
		await reseatLedgerChainAfterSave(tamperedPre, next2);
		expect(await getSealedLedgerChain()).toEqual(after);
	});

	it('leaves the witness frozen when the attestation key is gone (silence, evidence preserved)', async () => {
		const key = witnessKeyBytes(0xb111);
		await installWitnessKey(new Uint8Array(key));
		const records = randomRecords(makePrng(0xc111), 3) as never;
		await sealLedgerChain(records);
		const sealed = await getSealedLedgerChain();
		wipeWitnessKey();
		// Even the honest recomputation cannot match a keyed witness, and
		// an attacker's plain recomputation never will either.
		const plain = await computeLedgerChain(records);
		expect(plain.head).not.toBe(sealed!.head);
		// A write attempt without the key: the witness can be neither
		// verified nor advanced - it STAYS. A refused write must never
		// reshape the witness: erasing a valid keyed seal is exactly what
		// an attacker wants and what the purge-guard contract forbids.
		const next = randomRecords(makePrng(0xd111), 4) as never;
		await reseatLedgerChainAfterSave(records, next);
		expect(await getSealedLedgerChain()).toEqual(sealed);
		// Repeated keyless attempts keep it frozen, never degraded.
		await reseatLedgerChainAfterSave(next, randomRecords(makePrng(0xe111), 5) as never);
		expect(await getSealedLedgerChain()).toEqual(sealed);
	});

	it('steps aside on passphrase rotation and re-anchors under the new key', async () => {
		const keyA = witnessKeyBytes(0xf111);
		await installWitnessKey(new Uint8Array(keyA));
		const records = randomRecords(makePrng(0x0221), 3) as never;
		await sealLedgerChain(records);
		const kfA = getWitnessKeyFingerprint();
		// Rotation: a new passphrase installed a new attestation key.
		const keyB = witnessKeyBytes(0x1221);
		await installWitnessKey(new Uint8Array(keyB));
		expect(getWitnessKeyFingerprint()).not.toBe(kfA);
		await reseatLedgerChainAfterSave(records, randomRecords(makePrng(0x2221), 4) as never);
		// Honest step-aside: no stale anchor, no false violation.
		expect(await getSealedLedgerChain()).toBeNull();
		// The next legit save anchors under the new key's fingerprint.
		const next = randomRecords(makePrng(0x3221), 5) as never;
		await reseatLedgerChainAfterSave([], next);
		const sealed = await getSealedLedgerChain();
		expect(sealed!.mode).toBe('keyed');
		expect(sealed!.kf).toBe(getWitnessKeyFingerprint());
		expect(sealed!.head).toBe((await computeWitnessChain(next, 'keyed')).head);
	});

	it('upgrades a plain witness to keyed on the next legit save', async () => {
		const records = randomRecords(makePrng(0x4221), 3) as never;
		await sealLedgerChain(records);
		expect((await getSealedLedgerChain())!.mode).toBeUndefined();
		await installWitnessKey(witnessKeyBytes(0x5221));
		const next = randomRecords(makePrng(0x6221), 4) as never;
		await reseatLedgerChainAfterSave(records, next);
		const sealed = await getSealedLedgerChain();
		expect(sealed!.mode).toBe('keyed');
		expect(sealed!.head).toBe((await computeWitnessChain(next, 'keyed')).head);
	});

	it('treats a damaged keyed witness as attestable-by-nothing, not as plain', async () => {
		const key = witnessKeyBytes(0x7221);
		await installWitnessKey(new Uint8Array(key));
		await sealLedgerChain(randomRecords(makePrng(0x8221), 2) as never);
		// Damage the fingerprint field: the witness must NOT fall back to
		// plain reading (a plain recomputation would accuse honest records).
		const raw = JSON.parse(dbState.meta.get(META_LEDGER_CHAIN)!);
		delete raw.kf;
		dbState.meta.set(META_LEDGER_CHAIN, JSON.stringify(raw));
		const sealed = await getSealedLedgerChain();
		expect(sealed!.mode).toBe('keyed');
		expect(sealed!.kf).toBeUndefined();
	});

	it('reads an unknown witness mode as unanchored (never violated)', async () => {
		dbState.meta.set(
			META_LEDGER_CHAIN,
			JSON.stringify({ head: 'a'.repeat(64), length: 2, mode: 'future-mode' })
		);
		expect(await getSealedLedgerChain()).toBeNull();
	});
});

describe('keyed witness audit states (night-frontier-Z6)', () => {
	it('reports witness-opaque for a keyed witness without the key', async () => {
		const records = randomRecords(makePrng(0x9221), 3);
		lsStore.set(HISTORY, JSON.stringify(records));
		await installWitnessKey(witnessKeyBytes(0xa221));
		await sealLedgerChain(records as never);
		wipeWitnessKey();
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('witness-opaque');
		expect(audit.sealed).not.toBeNull();
		expect(audit.computed).toBeNull();
	});

	it('reports ok and violated under a keyed witness with the key installed', async () => {
		const records = randomRecords(makePrng(0xb221), 4);
		lsStore.set(HISTORY, JSON.stringify(records));
		await installWitnessKey(witnessKeyBytes(0xc221));
		await sealLedgerChain(records as never);
		expect((await auditLedgerContinuity()).state).toBe('ok');
		// Device tamper under a keyed witness: the audit must still accuse.
		const tampered = records.map((r, i) => (i === 1 ? { ...r, weight: r.weight + 40 } : r));
		lsStore.set(HISTORY, JSON.stringify(tampered));
		// The raw write bypassed the storage layer: drop the realm cache so
		// the audit reads the real (tampered) bytes, as a cold realm would.
		storageInvalidateAll();
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('violated');
		// And the plain recomputation of the tampered records can never
		// match the keyed witness - the attacker has no shortcut.
		const plain = await computeLedgerChain(tampered as never);
		expect(plain.head).not.toBe(audit.sealed!.head);
	});
});

// ── night-frontier-Z7: the tri-home witness ──
// The vault mirror (the flush-written OPFS copy of the latest backup
// snapshot) carries the witness live at backup time. The reseat path
// consults it before any unanchored re-anchor: a meta-witness wipe is
// the one way the freeze rule could be escaped, and a same-length
// disagreement with the second home freezes the re-anchor - blessing
// would destroy the vault's evidence.

import { parseWitnessRaw } from '../ledger-vault-anchor';
import { VAULT_WITNESS_META_KEY } from '../vault-backup';

// The bridge reads the vault through the REAL vault-backup module; the
// battery stubs the platform boundary (navigator.storage.getDirectory)
// with an in-memory OPFS root holding exactly what a flush() would have
// written - the raw snapshot JSON with the witness entry the backup
// path embeds. The parse path is the production parse path.
const vaultMirror = vi.hoisted(() => ({ snapshot: null as string | null }));

vi.stubGlobal('navigator', {
	storage: {
		getDirectory: async () => ({
			getFileHandle: async (name: string, options?: { create?: boolean }) => {
				if (name !== 'vault-backup.json') {
					throw new Error(`no such file: ${name}`);
				}
				if (vaultMirror.snapshot === null && !options?.create) {
					throw new Error('vault file absent');
				}
				return {
					getFile: async () => ({
						text: async () => vaultMirror.snapshot ?? '',
						size: vaultMirror.snapshot?.length ?? 0
					})
				};
			}
		})
	}
});

const vaultWitnessJson = (
	witness:
		Record<string, unknown> | { head: string; length: number; mode?: 'keyed'; kf?: string } | null
): void => {
	if (witness === null) {
		vaultMirror.snapshot = null;
		return;
	}
	vaultMirror.snapshot = JSON.stringify({
		'bmi.history': '[]',
		[VAULT_WITNESS_META_KEY]: JSON.stringify(witness)
	});
};

describe('tri-home witness: the vault anchor vetoes a wiped witness (night-frontier-Z7)', () => {
	it('a same-length history rewrite behind a wiped witness is vetoed', async () => {
		const key = witnessKeyBytes(0x9001);
		await installWitnessKey(new Uint8Array(key));
		const original = randomRecords(makePrng(0x9002), 5);
		await sealLedgerChain(original as never);
		vaultWitnessJson(await getSealedLedgerChain());
		// Out-of-band attack: rewrite the history at the SAME length and
		// wipe the meta witness - the freeze rule's one escape hatch.
		const tampered = original.map((r, i) => (i === 2 ? { ...r, weight: r.weight + 33 } : r));
		lsStore.set(HISTORY, JSON.stringify(tampered));
		dbState.meta.set(META_LEDGER_CHAIN, '');
		// The next legit save observes the tombstone - and the vault
		// refuses to bless it.
		await reseatLedgerChainAfterSave(
			tampered as never,
			[
				...tampered,
				{ timestamp: 1_700_020_000_000, bmi: 22.9, height: 175, weight: 70, age: 30 }
			] as never
		);
		expect(await getSealedLedgerChain()).toBeNull();
		// The vault's evidence survives untouched.
		expect(vaultMirror.snapshot).not.toBeNull();
	});

	it('an honest wiped witness re-anchors: the second home proves the records', async () => {
		const key = witnessKeyBytes(0x9101);
		await installWitnessKey(new Uint8Array(key));
		const records = randomRecords(makePrng(0x9102), 4);
		await sealLedgerChain(records as never);
		vaultWitnessJson(await getSealedLedgerChain());
		// The meta witness is wiped but the records are UNTOUCHED: the
		// vault proves them and the re-anchor proceeds.
		lsStore.set(HISTORY, JSON.stringify(records));
		dbState.meta.set(META_LEDGER_CHAIN, '');
		const next = [
			...records,
			{ timestamp: 1_700_030_000_000, bmi: 22.4, height: 175, weight: 71, age: 30 }
		];
		await reseatLedgerChainAfterSave(records as never, next as never);
		const sealed = await getSealedLedgerChain();
		expect(sealed).not.toBeNull();
		expect(sealed!.mode).toBe('keyed');
		expect(sealed!.head).toBe((await computeWitnessChain(next as never, 'keyed')).head);
	});

	it('a stale vault copy (different length) is silence, never evidence', async () => {
		const key = witnessKeyBytes(0x9201);
		await installWitnessKey(new Uint8Array(key));
		const old = randomRecords(makePrng(0x9202), 3);
		vaultWitnessJson({
			head: (await computeWitnessChain(old as never, 'keyed')).head,
			length: 3,
			mode: 'keyed',
			kf: getWitnessKeyFingerprint()
		});
		// The ledger legitimately grew since the backup: a re-anchor is
		// free to proceed without the stale copy's opinion.
		const grown = randomRecords(makePrng(0x9203), 5);
		await reseatLedgerChainAfterSave(old as never, grown as never);
		const sealed = await getSealedLedgerChain();
		expect(sealed).not.toBeNull();
		expect(sealed!.head).toBe((await computeWitnessChain(grown as never, 'keyed')).head);
	});

	it('a keyed vault anchor without its key answers unknown: no blessing, no accusation', async () => {
		const otherKey = witnessKeyBytes(0x9301);
		await installWitnessKey(new Uint8Array(otherKey));
		const records = randomRecords(makePrng(0x9302), 4);
		vaultWitnessJson({
			head: 'a'.repeat(64),
			length: 4,
			mode: 'keyed',
			kf: 'deadbeef'
		});
		await reseatLedgerChainAfterSave(records as never, randomRecords(makePrng(0x9303), 5) as never);
		expect(await getSealedLedgerChain()).not.toBeNull();
	});

	it('no vault copy at all keeps the plain unanchored re-anchor', async () => {
		vaultWitnessJson(null);
		const records = randomRecords(makePrng(0x9401), 3);
		await reseatLedgerChainAfterSave(records as never, randomRecords(makePrng(0x9402), 4) as never);
		const sealed = await getSealedLedgerChain();
		expect(sealed).not.toBeNull();
		expect(sealed!.mode).toBeUndefined();
	});
});

describe('tri-home witness: the audit surfaces the vault verdict (night-frontier-Z7)', () => {
	it('unanchored + disagreeing vault = the tombstone-escape signature', async () => {
		const key = witnessKeyBytes(0x9501);
		await installWitnessKey(new Uint8Array(key));
		const original = randomRecords(makePrng(0x9502), 4);
		await sealLedgerChain(original as never);
		vaultWitnessJson(await getSealedLedgerChain());
		const tampered = original.map((r, i) => (i === 1 ? { ...r, bmi: r.bmi + 9 } : r));
		lsStore.set(HISTORY, JSON.stringify(tampered));
		dbState.meta.set(META_LEDGER_CHAIN, '');
		storageInvalidateAll();
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('unanchored');
		expect(audit.vaultEvidence).not.toBeNull();
		expect(audit.vaultEvidence!.agreesWithRecords).toBe(false);
		expect(audit.vaultEvidence!.length).toBe(4);
		expect(audit.vaultEvidence!.mode).toBe('keyed');
	});

	it('unanchored + agreeing vault carries the proof, not silence', async () => {
		const key = witnessKeyBytes(0x9601);
		await installWitnessKey(new Uint8Array(key));
		const records = randomRecords(makePrng(0x9602), 4);
		await sealLedgerChain(records as never);
		vaultWitnessJson(await getSealedLedgerChain());
		lsStore.set(HISTORY, JSON.stringify(records));
		dbState.meta.set(META_LEDGER_CHAIN, '');
		storageInvalidateAll();
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('unanchored');
		expect(audit.vaultEvidence!.agreesWithRecords).toBe(true);
	});

	it('a stale vault copy leaves the audit evidence silent', async () => {
		vaultWitnessJson({ head: 'b'.repeat(64), length: 99 });
		lsStore.set(HISTORY, JSON.stringify(randomRecords(makePrng(0x9701), 3)));
		storageInvalidateAll();
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('unanchored');
		expect(audit.vaultEvidence).toBeNull();
	});
});

describe('tri-home witness: the raw copy parser (night-frontier-Z7)', () => {
	it('pins the vault snapshot key to the live meta key', () => {
		expect(VAULT_WITNESS_META_KEY).toBe(META_LEDGER_CHAIN);
	});

	it('parses plain, keyed, damaged-keyed, unknown-mode, and garbage fail-closed', () => {
		expect(parseWitnessRaw(JSON.stringify({ head: 'a'.repeat(64), length: 2 }))).toEqual({
			head: 'a'.repeat(64),
			length: 2
		});
		const keyed = parseWitnessRaw(
			JSON.stringify({ head: 'b'.repeat(64), length: 3, mode: 'keyed', kf: 'f'.repeat(64) })
		);
		expect(keyed!.mode).toBe('keyed');
		expect(keyed!.kf).toBe('f'.repeat(64));
		// Damaged fingerprint: attestable-by-nothing, never plain.
		const damaged = parseWitnessRaw(
			JSON.stringify({ head: 'c'.repeat(64), length: 3, mode: 'keyed' })
		);
		expect(damaged!.mode).toBe('keyed');
		expect(damaged!.kf).toBeUndefined();
		// Unknown mode and malformed JSON read as no witness at all.
		expect(
			parseWitnessRaw(JSON.stringify({ head: 'd'.repeat(64), length: 1, mode: 'future' }))
		).toBeNull();
		expect(parseWitnessRaw('not json at all')).toBeNull();
		expect(parseWitnessRaw(JSON.stringify({ head: 42, length: 'x' }))).toBeNull();
	});
});
