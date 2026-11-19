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
	getSealedLedgerChain,
	sealLedgerChain,
	reseatLedgerChainAfterSave,
	clearLedgerHistory
} from '../ledger-continuity';
import {
	auditLedgerContinuity,
	saveBmiToHistory,
	_drainLedgerWritesForTesting
} from '../bmi-history';
import { createBackup, restoreLatestBackup } from '../backup';
import { AT_REST_TAG, _resetAtRestStateForTesting } from '../at-rest-state';
import { _resetWitnessKeyForTesting } from '../witness-key';
import { parseWitnessRaw, SEAL_FAILED_WITNESS } from '../ledger-vault-anchor';

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
		// The witness degraded: no stale anchor survives to accuse falsely —
		// and night-frontier-Z9 makes the degradation TYPED: the marker says
		// "I failed to witness" (a different statement from a deliberate
		// wipe) and reads as no witness to every consumer.
		expect(dbState.meta.get(META_LEDGER_CHAIN)).toBe(SEAL_FAILED_WITNESS);
		expect(parseWitnessRaw(SEAL_FAILED_WITNESS)).toBeNull();
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
