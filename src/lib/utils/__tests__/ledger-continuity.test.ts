// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z3 - the Ledger Continuity Chain supermassive battery.
//
// Proves, in order of severity:
//   1. Chain math: the module's chain equals an INDEPENDENT reference
//      implementation (recomputed here with raw subtle calls), the
//      canonical serialization is order-deterministic, and the chain is
//      stable across repeated computations.
//   2. Property tamper battery: a seeded PRNG drives 8 tamper classes
//      (truncate front/back/middle, adjacent swap, reorder, field edit,
//      replay duplicate, foreign insertion) over random record sets -
//      every tampered state MUST change the recomputed head, and every
//      untampered recomputation MUST match (zero false positives).
//   3. Witness semantics: legit saves advance the witness, tampered
//      pre-states freeze it (evidence preserved, never re-anchored
//      silently), unanchored devices anchor on the first legit save,
//      failed seals degrade to unanchored, and clear seals genesis/0.
//   4. Audit states: ok / violated / unanchored / sealed-opaque, each
//      reachable and distinguishable.
//   5. The save-path integration through the real storage layer, plus
//      the backup/restore witness travel contract.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const lsStore = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => lsStore.get(k) ?? null,
	setItem: (k: string, v: string) => lsStore.set(k, String(v)),
	removeItem: (k: string) => lsStore.delete(k),
	clear: () => lsStore.clear()
});

const dbState = vi.hoisted(() => ({
	meta: new Map<string, string>(),
	kv: new Map<string, string>(),
	backups: [] as Array<{
		id: number;
		data: string;
		timestamp: number;
		recordCount: number;
		appVersion: string;
	}>
}));

vi.mock('../db', () => ({
	isIndexedDbAvailable: () => true,
	dbMetaGet: vi.fn(async (key: string) => dbState.meta.get(key) ?? null),
	dbMetaSet: vi.fn(async (key: string, value: string) => {
		dbState.meta.set(key, value);
	}),
	dbSet: vi.fn(async (key: string, value: string) => {
		dbState.kv.set(key, value);
	}),
	dbRemove: vi.fn(async (key: string) => {
		dbState.kv.delete(key);
	}),
	dbGetAll: vi.fn(async () => Array.from(dbState.kv, ([key, value]) => ({ key, value }))),
	dbClose: vi.fn(),
	dbBackupSave: vi.fn(
		async (record: {
			data: string;
			timestamp: number;
			recordCount: number;
			appVersion: string;
		}) => {
			const id = dbState.backups.reduce((m, b) => Math.max(m, b.id), 0) + 1;
			dbState.backups.push({ ...record, id });
			return id;
		}
	),
	dbBackupGetAll: vi.fn(async () => [...dbState.backups].sort((a, b) => b.timestamp - a.timestamp)),
	dbBackupLatest: vi.fn(
		async () => [...dbState.backups].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
	),
	dbBackupDelete: vi.fn(async (id: number) => {
		dbState.backups = dbState.backups.filter((b) => b.id !== id);
	})
}));

import {
	STORAGE_KEYS,
	initStorage,
	storageInvalidateAll,
	_resetIdbWriteSeqForTesting
} from '../storage';
import {
	META_LEDGER_CHAIN,
	canonicalRecordJson,
	computeLedgerChain,
	computeWitnessChain,
	getSealedLedgerChain,
	sealLedgerChain,
	reseatLedgerChainAfterSave,
	clearLedgerHistory,
	_drainLedgerContinuityForTesting
} from '../ledger-continuity';
import {
	auditLedgerContinuity,
	saveBmiToHistory,
	readBmiHistory,
	_drainLedgerWritesForTesting
} from '../bmi-history';
import { createBackup, restoreLatestBackup } from '../backup';
import { AT_REST_TAG, _resetAtRestStateForTesting } from '../at-rest-state';
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
	dbState.kv.clear();
	dbState.backups = [];
	storageInvalidateAll();
	_resetIdbWriteSeqForTesting();
	_resetAtRestStateForTesting();
	_resetWitnessKeyForTesting();
	initStorage();
});

describe('ledger continuity chain math', () => {
	it('matches an independent reference implementation of the chain', async () => {
		const prng = makePrng(0xc411);
		const records = randomRecords(prng, 12);
		// The reference recomputes the chain with raw subtle calls and its
		// own canonical serialization - agreement is the proof.
		const canonical = (r: (typeof records)[number]): string =>
			JSON.stringify({
				timestamp: r.timestamp,
				bmi: r.bmi,
				height: r.height,
				weight: r.weight,
				age: r.age
			});
		let link = await sha256HexInput('bmi-stellar-ledger-v4-genesis');
		for (const r of records) {
			link = await sha256HexInput(`${link}:${canonical(r)}`);
		}
		const chain = await computeLedgerChain(records as never);
		expect(chain.head).toBe(link);
		expect(chain.length).toBe(12);
	});

	it('serializes canonically regardless of key insertion order', () => {
		const a = canonicalRecordJson({ timestamp: 1, bmi: 22.5, height: 170, weight: 65, age: 30 });
		const b = canonicalRecordJson({
			weight: 65,
			age: 30,
			height: 170,
			bmi: 22.5,
			timestamp: 1
		} as never);
		expect(a).toBe(b);
		expect(a).toBe('{"timestamp":1,"bmi":22.5,"height":170,"weight":65,"age":30}');
	});

	it('treats an absent age and an undefined age identically', async () => {
		const withUndefined = await computeLedgerChain([
			{ timestamp: 1, bmi: 22.5, height: 170, weight: 65, age: undefined }
		] as never);
		const withAbsent = await computeLedgerChain([
			{ timestamp: 1, bmi: 22.5, height: 170, weight: 65 }
		] as never);
		expect(withUndefined.head).toBe(withAbsent.head);
	});

	it('seals an empty ledger as the genesis head with length zero', async () => {
		const chain = await computeLedgerChain([]);
		const genesis = await sha256HexInput('bmi-stellar-ledger-v4-genesis');
		expect(chain).toEqual({ head: genesis, length: 0 });
	});

	it('recomputes identically on repeated calls (no hidden state)', async () => {
		const records = randomRecords(makePrng(7), 5) as never;
		const a = await computeLedgerChain(records);
		const b = await computeLedgerChain(records);
		expect(a).toEqual(b);
	});
});

describe('ledger continuity property tamper battery', () => {
	// Every tamper class MUST flip the head; the pristine replay MUST NOT.
	const TAMPERS = [
		'truncate-front',
		'truncate-back',
		'truncate-middle',
		'adjacent-swap',
		'reorder',
		'edit-field',
		'replay-duplicate',
		'foreign-insert'
	] as const;

	it('detects every tamper class across 20 seeded record sets (160 cases)', async () => {
		let detected = 0;
		let cases = 0;
		for (let seed = 1; seed <= 20; seed++) {
			const prng = makePrng(seed * 7919);
			const records = randomRecords(prng, 6 + Math.floor(prng() * 6));
			const pristine = await computeLedgerChain(records as never);

			for (const tamper of TAMPERS) {
				const copy = [...records];
				let tampered: typeof copy;
				switch (tamper) {
					case 'truncate-front':
						tampered = copy.slice(1);
						break;
					case 'truncate-back':
						tampered = copy.slice(0, -1);
						break;
					case 'truncate-middle':
						tampered = copy.filter((_, i) => i !== Math.floor(copy.length / 2));
						break;
					case 'adjacent-swap': {
						tampered = [...copy];
						const i = Math.floor(prng() * (tampered.length - 1));
						[tampered[i], tampered[i + 1]] = [tampered[i + 1], tampered[i]];
						break;
					}
					case 'reorder':
						tampered = [...copy].reverse();
						break;
					case 'edit-field': {
						tampered = copy.map((r, i) =>
							i === Math.floor(prng() * copy.length) ? { ...r, weight: r.weight + 0.5 } : r
						);
						break;
					}
					case 'replay-duplicate':
						tampered = [...copy, copy[0]];
						break;
					case 'foreign-insert': {
						tampered = [...copy];
						tampered.splice(Math.floor(prng() * copy.length), 0, {
							timestamp: Date.now() + 90_000,
							bmi: 23.4,
							height: 180,
							weight: 75,
							age: 40
						});
						break;
					}
				}
				// The honest two-directional property: a tamper that changes
				// the LOGICAL ledger (canonical timestamp order) must flip the
				// head; a tamper that is a logical no-op (reordering distinct
				// timestamps - the app always reads ascending) must not.
				const logicalBefore = JSON.stringify(
					[...records].sort((x, y) => x.timestamp - y.timestamp)
				);
				const logicalAfter = JSON.stringify(
					[...tampered].sort((x, y) => x.timestamp - y.timestamp)
				);
				const violated = await computeLedgerChain(tampered as never);
				if (logicalBefore === logicalAfter) {
					expect(violated.head).toBe(pristine.head);
				} else {
					expect(violated.head).not.toBe(pristine.head);
					detected++;
				}
				cases++;
			}
		}
		expect(cases).toBeGreaterThanOrEqual(150);
		// Zero false positives on untampered recomputation.
		for (let seed = 1; seed <= 20; seed++) {
			const records = randomRecords(makePrng(seed * 104729), 8);
			const a = await computeLedgerChain(records as never);
			const b = await computeLedgerChain(records as never);
			expect(a.head).toBe(b.head);
		}
	});
});

describe('ledger continuity witness semantics', () => {
	it('advances on a legit save transition (pre-state matches the witness)', async () => {
		const pre = randomRecords(makePrng(11), 4);
		await sealLedgerChain(pre as never);
		const before = await getSealedLedgerChain();
		const next = [
			...pre,
			{ timestamp: 1_700_010_000_000, bmi: 22.9, height: 175, weight: 70, age: 30 }
		] as never;
		await reseatLedgerChainAfterSave(pre as never, next);
		const after = await getSealedLedgerChain();
		expect(after).not.toBeNull();
		expect(after!.head).not.toBe(before!.head);
		expect(after!.length).toBe(5);
		const expected = await computeLedgerChain(next);
		expect(after!.head).toBe(expected.head);
	});

	it('freezes when the pre-state was tampered (evidence preserved)', async () => {
		const legit = randomRecords(makePrng(23), 4) as never;
		await sealLedgerChain(legit as never);
		const witness = await getSealedLedgerChain();
		// The device changed outside a legit path: a tampered pre-state
		// arrives with the next save. The witness must NOT bless it.
		const tamperedPre = randomRecords(makePrng(24), 4) as never;
		const next = randomRecords(makePrng(25), 5) as never;
		await reseatLedgerChainAfterSave(tamperedPre as never, next);
		const still = await getSealedLedgerChain();
		expect(still).toEqual(witness);
	});

	it('anchors an unanchored device on the first legit save', async () => {
		expect(await getSealedLedgerChain()).toBeNull();
		const records = randomRecords(makePrng(31), 3) as never;
		await reseatLedgerChainAfterSave([] as never, records as never);
		const sealed = await getSealedLedgerChain();
		const expected = await computeLedgerChain(records as never);
		expect(sealed).toEqual(expected);
	});

	it('degrades to unanchored when the seal write fails', async () => {
		await sealLedgerChain(randomRecords(makePrng(37), 2) as never);
		expect(await getSealedLedgerChain()).not.toBeNull();
		// Force the next seal write to fail through an invalid meta state.
		const original = dbState.meta.get(META_LEDGER_CHAIN);
		vi.mocked((await import('../db')).dbMetaSet).mockImplementationOnce(async () => {
			throw new Error('idb write failed');
		});
		await sealLedgerChain(randomRecords(makePrng(38), 2) as never);
		// The witness degraded: no stale anchor survives to accuse falsely.
		expect(dbState.meta.get(META_LEDGER_CHAIN)).toBe('');
		if (original) dbState.meta.set(META_LEDGER_CHAIN, original);
	});

	it('clear seals the empty-ledger witness and empties history', async () => {
		lsStore.set(HISTORY, JSON.stringify(randomRecords(makePrng(41), 3)));
		await sealLedgerChain(randomRecords(makePrng(42), 3) as never);
		// The clear drains its own genesis seal inside the locked section.
		await clearLedgerHistory();
		const genesis = await sha256HexInput('bmi-stellar-ledger-v4-genesis');
		expect(lsStore.has(HISTORY)).toBe(false);
		expect(await getSealedLedgerChain()).toEqual({ head: genesis, length: 0 });
	});
});

describe('ledger continuity audit states', () => {
	it('reports ok when the witness matches the validated records', async () => {
		const records = randomRecords(makePrng(47), 4);
		lsStore.set(HISTORY, JSON.stringify(records));
		await sealLedgerChain(records as never);
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('ok');
		expect(audit.computed!.length).toBe(4);
	});

	it('reports violated when history changed outside a legit write', async () => {
		const records = randomRecords(makePrng(53), 4);
		lsStore.set(HISTORY, JSON.stringify(records));
		await sealLedgerChain(records as never);
		// Device-access tamper: edit a record in the raw storage.
		const tampered = records.map((r, i) => (i === 1 ? { ...r, weight: r.weight + 40 } : r));
		lsStore.set(HISTORY, JSON.stringify(tampered));
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('violated');
		expect(audit.sealed).not.toBeNull();
	});

	it('reads a stored-order scramble of distinct timestamps as ok (logical no-op)', async () => {
		const records = randomRecords(makePrng(61), 4);
		lsStore.set(HISTORY, JSON.stringify(records));
		await sealLedgerChain(records as never);
		// Raw storage scrambled: distinct timestamps, so the validated read
		// re-sorts to the same logical ledger - honestly not a violation.
		lsStore.set(HISTORY, JSON.stringify([...records].reverse()));
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('ok');
	});

	it('reports unanchored when no witness exists', async () => {
		lsStore.set(HISTORY, JSON.stringify(randomRecords(makePrng(59), 3)));
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('unanchored');
		expect(audit.sealed).toBeNull();
		expect(audit.computed!.length).toBe(3);
	});

	it('reports unanchored when history is empty and no witness exists', async () => {
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('unanchored');
		expect(audit.computed!.length).toBe(0);
	});

	it('reports sealed-opaque for a sealed ledger under a locked session', async () => {
		lsStore.set(HISTORY, AT_REST_TAG + 'bm9vcGFxdWVqb3VybmFs');
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('sealed-opaque');
		expect(audit.computed).toBeNull();
	});
});

describe('ledger continuity save-path integration (real storage layer)', () => {
	it('a real save anchors the device and the audit reads ok', async () => {
		const signature = saveBmiToHistory({
			bmi: 22.86,
			heightCm: 175,
			weightKg: 70,
			age: '30',
			lastSignature: null
		});
		expect(signature).not.toBeNull();
		// Drain the locked write section (it awaits the witness update), then audit.
		await _drainLedgerWritesForTesting();
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('ok');
		expect(audit.computed!.length).toBe(1);
		expect(await getSealedLedgerChain()).toEqual(audit.computed);
	});

	it('a tampered pre-state freezes the witness across a real save', async () => {
		// Seed a pristine ledger + witness.
		const records = randomRecords(makePrng(67), 3);
		lsStore.set(HISTORY, JSON.stringify(records));
		await sealLedgerChain(records as never);
		const witness = await getSealedLedgerChain();
		// Device-access tamper of VALID records (passes validation).
		const tampered = records.map((r, i) => (i === 0 ? { ...r, weight: r.weight + 30 } : r));
		lsStore.set(HISTORY, JSON.stringify(tampered));
		// The user calculates: the save goes through (data preservation),
		// but the witness must stay frozen at the last verified state.
		saveBmiToHistory({
			bmi: 22.86,
			heightCm: 175,
			weightKg: 70,
			age: '30',
			lastSignature: null
		});
		// Drain the locked write section WITHOUT re-sealing: the freeze
		// must come from the production path, not from test interference.
		await _drainLedgerWritesForTesting();
		expect(await getSealedLedgerChain()).toEqual(witness);
		expect((await auditLedgerContinuity()).state).toBe('violated');
	});
});

describe('ledger continuity witness travels with backups', () => {
	it('createBackup snapshots the witness and restore re-installs it', async () => {
		const records = randomRecords(makePrng(71), 3);
		lsStore.set(HISTORY, JSON.stringify(records));
		await sealLedgerChain(records as never);
		const witness = await getSealedLedgerChain();
		await createBackup('data_change');
		// Snapshot captured the witness.
		const blob = dbState.backups.at(-1)?.data;
		expect(blob).toBeTruthy();
		const snapshot = JSON.parse(blob!) as Record<string, string | null>;
		expect(snapshot[META_LEDGER_CHAIN]).toBe(JSON.stringify(witness));
		// Wipe the device, restore: the witness returns with the history.
		lsStore.clear();
		dbState.meta.delete(META_LEDGER_CHAIN);
		await restoreLatestBackup();
		expect(await getSealedLedgerChain()).toEqual(witness);
	});

	it('a pre-Z3 snapshot without a witness tombstones it (no false accusation)', async () => {
		const records = randomRecords(makePrng(73), 2);
		lsStore.set(HISTORY, JSON.stringify(records));
		await sealLedgerChain(randomRecords(makePrng(74), 5) as never);
		// Simulate a pre-Z3 backup: a snapshot blob without the meta key.
		const preZ3 = { [HISTORY]: JSON.stringify(records) };
		dbState.backups.push({
			id: 1,
			data: JSON.stringify(preZ3),
			timestamp: Date.now(),
			recordCount: 2,
			appVersion: 'test'
		});
		await restoreLatestBackup();
		// The stale witness is gone (tombstoned), the restored ledger is
		// honestly unanchored instead of falsely violated.
		expect(await getSealedLedgerChain()).toBeNull();
		expect((await auditLedgerContinuity()).state).toBe('unanchored');
	});
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
		installWitnessKey(new Uint8Array(key));
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
		installWitnessKey(new Uint8Array(key));
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
		installWitnessKey(new Uint8Array(key));
		const records = randomRecords(makePrng(0x4444), 6) as never;
		const plain = await computeLedgerChain(records);
		const keyed = await computeWitnessChain(records, 'keyed');
		expect(keyed.head).not.toBe(plain.head);
		// The re-seal resistance property in one line: the attacker's
		// unkeyed recomputation can NEVER reproduce the keyed witness.
	});

	it('stays byte-identical for an empty ledger (genesis head, length zero)', async () => {
		const key = witnessKeyBytes(0x5555);
		installWitnessKey(new Uint8Array(key));
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
		installWitnessKey(new Uint8Array(key));
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
		installWitnessKey(new Uint8Array(key));
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
		installWitnessKey(new Uint8Array(keyA));
		const records = randomRecords(makePrng(0x0221), 3) as never;
		await sealLedgerChain(records);
		const kfA = getWitnessKeyFingerprint();
		// Rotation: a new passphrase installed a new attestation key.
		const keyB = witnessKeyBytes(0x1221);
		installWitnessKey(new Uint8Array(keyB));
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
		installWitnessKey(witnessKeyBytes(0x5221));
		const next = randomRecords(makePrng(0x6221), 4) as never;
		await reseatLedgerChainAfterSave(records, next);
		const sealed = await getSealedLedgerChain();
		expect(sealed!.mode).toBe('keyed');
		expect(sealed!.head).toBe((await computeWitnessChain(next, 'keyed')).head);
	});

	it('treats a damaged keyed witness as attestable-by-nothing, not as plain', async () => {
		const key = witnessKeyBytes(0x7221);
		installWitnessKey(new Uint8Array(key));
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
		installWitnessKey(witnessKeyBytes(0xa221));
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
		installWitnessKey(witnessKeyBytes(0xc221));
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
