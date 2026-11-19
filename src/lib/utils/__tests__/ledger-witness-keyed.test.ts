// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
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

	it('steps the witness aside (tombstone) when the attestation key is gone', async () => {
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
		// A legit write without the key: the witness neither blesses nor
		// accuses - it steps aside to honestly unanchored.
		const next = randomRecords(makePrng(0xd111), 4) as never;
		await reseatLedgerChainAfterSave(records, next);
		expect(await getSealedLedgerChain()).toBeNull();
		// The next legit save re-anchors - plain, because no key exists.
		await reseatLedgerChainAfterSave(next, randomRecords(makePrng(0xe111), 5) as never);
		expect((await getSealedLedgerChain())!.mode).toBeUndefined();
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
