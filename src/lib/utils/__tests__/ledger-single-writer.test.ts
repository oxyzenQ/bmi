// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z5 — the Single-Writer Law two-realm battery.
//
// Two module graphs here are two browser tabs: each realm carries its
// own memory cache, per-key write queue, witness seal queue, and at-rest
// session state, while the stubbed localStorage and the mocked IndexedDB
// are the shared origin storage the browser gives both tabs. The shared
// lock manager stands in for navigator.locks, which is origin-scoped
// across realms exactly like the platform. Proves, in order of severity:
//   1. The Z5 race: a stale foreign realm merges over fresh state — the
//      union survives, the witness blesses every legit write, zero
//      record loss, audit ok.
//   2. Intra-realm concurrency: two overlapping saves serialize and the
//      audit reads ok.
//   3. Tamper evidence survives the law: an out-of-band writer holding
//      no lock still freezes the witness — the advisory lock never
//      weakened the night-frontier-Z3 freeze rule.
//   4. Clear coherence: a clear in one realm reads as cleared in a
//      stale foreign realm's next locked write, and the genesis seal
//      blesses the follow-up save instead of freezing it.

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
	kv: new Map<string, string>()
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
	dbClose: vi.fn()
}));

/** An origin-scoped exclusive lock manager, shared by both realms. */
function makeSharedLockManager() {
	const calls: Array<{ name: string; mode: string }> = [];
	let tail: Promise<unknown> = Promise.resolve();
	return {
		calls,
		request(
			name: string,
			options: { mode: 'exclusive' },
			callback: (lock: unknown) => Promise<unknown>
		): Promise<unknown> {
			calls.push({ name, mode: options.mode });
			const run = tail.then(
				() => callback(undefined),
				() => callback(undefined)
			);
			tail = run.catch(() => {});
			return run;
		}
	};
}

interface Realm {
	storage: typeof import('../storage');
	bmiHistory: typeof import('../bmi-history');
	continuity: typeof import('../ledger-continuity');
	ledgerLock: typeof import('../ledger-lock');
}

async function freshRealm(manager: ReturnType<typeof makeSharedLockManager>): Promise<Realm> {
	vi.resetModules();
	const storage = await import('../storage');
	const bmiHistory = await import('../bmi-history');
	const continuity = await import('../ledger-continuity');
	const ledgerLock = await import('../ledger-lock');
	ledgerLock._setLedgerLockManagerForTesting(manager);
	return { storage, bmiHistory, continuity, ledgerLock };
}

interface Spec {
	bmi: number;
	heightCm: number;
	weightKg: number;
	age: string;
}

const HISTORY_KEY = 'bmi.history';

const SPECS = {
	one: { bmi: 22.86, heightCm: 175, weightKg: 70, age: '30' },
	two: { bmi: 23.5, heightCm: 175, weightKg: 72, age: '30' },
	three: { bmi: 24.1, heightCm: 168, weightKg: 61, age: '28' }
} satisfies Record<string, Spec>;

/** Sequential legit saves in one realm, each drained before the next. */
async function saveSequence(realm: Realm, specs: Spec[]): Promise<string | null> {
	let signature: string | null = null;
	for (const spec of specs) {
		signature = realm.bmiHistory.saveBmiToHistory({
			bmi: spec.bmi,
			heightCm: spec.heightCm,
			weightKg: spec.weightKg,
			age: spec.age,
			lastSignature: signature
		});
		await realm.bmiHistory._drainLedgerWritesForTesting();
	}
	return signature;
}

beforeEach(() => {
	lsStore.clear();
	dbState.meta.clear();
	dbState.kv.clear();
});

describe('the single-writer law across two realms', () => {
	it('a stale foreign realm merges over fresh state — zero record loss, audit ok', async () => {
		const manager = makeSharedLockManager();
		const realmA = await freshRealm(manager);
		const realmB = await freshRealm(manager);
		await realmA.storage.initStorage();
		await realmB.storage.initStorage();

		// Realm B caches an empty ledger view; realm A then lands two records.
		expect(realmB.bmiHistory.readBmiHistory()).toEqual([]);
		await saveSequence(realmA, [SPECS.one, SPECS.two]);
		expect(realmA.bmiHistory.readBmiHistory()).toHaveLength(2);
		// Realm B's cache never heard about them (no event reached this realm).
		expect(realmB.bmiHistory.readBmiHistory()).toHaveLength(0);

		// Realm B saves with the stale view: the locked section refreshes
		// from the mirror first, so the merge lands on fresh state.
		realmB.bmiHistory.saveBmiToHistory({ ...SPECS.three, lastSignature: null });
		await realmB.bmiHistory._drainLedgerWritesForTesting();

		// The union survived — the pre-Z5 path would have overwritten the
		// mirror with [three] alone and frozen the witness as a false
		// accusation.
		expect(realmB.bmiHistory.readBmiHistory()).toHaveLength(3);
		// Realm A's own cache is still stale here — in the browser its
		// coherence listener invalidates the health keys on B's mirror
		// write; simulate exactly that event effect, then A reads the union.
		realmA.storage.storageInvalidate(HISTORY_KEY);
		expect(realmA.bmiHistory.readBmiHistory()).toHaveLength(3);
		const audit = await realmB.bmiHistory.auditLedgerContinuity();
		expect(audit.state).toBe('ok');
		expect(audit.computed!.length).toBe(3);
		// Every legit write held the origin-wide lock in exclusive mode.
		expect(manager.calls).toHaveLength(3);
		for (const call of manager.calls) {
			expect(call.name).toBe('bmi-ledger-write');
			expect(call.mode).toBe('exclusive');
		}
	});

	it('overlapping saves in one realm serialize and land as a blessed union', async () => {
		const manager = makeSharedLockManager();
		const realmA = await freshRealm(manager);
		await realmA.storage.initStorage();

		const first = realmA.bmiHistory.saveBmiToHistory({ ...SPECS.one, lastSignature: null });
		const second = realmA.bmiHistory.saveBmiToHistory({ ...SPECS.two, lastSignature: first });
		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
		await realmA.bmiHistory._drainLedgerWritesForTesting();

		expect(realmA.bmiHistory.readBmiHistory()).toHaveLength(2);
		const audit = await realmA.bmiHistory.auditLedgerContinuity();
		expect(audit.state).toBe('ok');
	});

	it('tamper evidence survives the law — the freeze rule still fires lock-free', async () => {
		const manager = makeSharedLockManager();
		const realmA = await freshRealm(manager);
		const realmB = await freshRealm(manager);
		await realmA.storage.initStorage();
		await realmB.storage.initStorage();
		await saveSequence(realmA, [SPECS.one, SPECS.two]);
		const witnessBefore = await realmB.continuity.getSealedLedgerChain();
		expect(witnessBefore).not.toBeNull();

		// Out-of-band tamper: rewrite the mirror directly, bypassing every
		// legit path AND the lock — the exact night-frontier-Z3 tamper model.
		const records = realmA.bmiHistory.readBmiHistory();
		const tampered = records.map((r, i) => (i === 0 ? { ...r, weight: r.weight + 30 } : r));
		lsStore.set('bmi.history', JSON.stringify(tampered));

		// A legit save follows: freshness re-reads the tampered mirror, the
		// merge preserves the valid-but-edited records, and the reseat must
		// REFUSE to bless — witness frozen, evidence intact.
		realmA.bmiHistory.saveBmiToHistory({ ...SPECS.three, lastSignature: null });
		await realmA.bmiHistory._drainLedgerWritesForTesting();

		const witnessAfter = await realmB.continuity.getSealedLedgerChain();
		expect(witnessAfter).toEqual(witnessBefore);
		const audit = await realmA.bmiHistory.auditLedgerContinuity();
		expect(audit.state).toBe('violated');
		// Data preservation: the save itself still persisted over the
		// tampered base — the freeze is evidence discipline, not data loss.
		expect(realmA.bmiHistory.readBmiHistory()).toHaveLength(3);
	});

	it('a clear reads as cleared everywhere and the genesis seal blesses the next save', async () => {
		const manager = makeSharedLockManager();
		const realmA = await freshRealm(manager);
		const realmB = await freshRealm(manager);
		await realmA.storage.initStorage();
		await realmB.storage.initStorage();
		await saveSequence(realmA, [SPECS.one, SPECS.two]);

		await realmA.continuity.clearLedgerHistory();
		// Same-realm honesty: cleared reads as cleared immediately.
		expect(realmA.bmiHistory.readBmiHistory()).toEqual([]);
		const cleared = await realmA.bmiHistory.auditLedgerContinuity();
		expect(cleared.state).toBe('ok');
		expect(cleared.computed!.length).toBe(0);

		// A stale foreign realm saves next: the locked section refreshes,
		// sees the cleared ledger, merges over it — and the genesis witness
		// BLESSES the write (pre-Z5 would have resurrected the cleared
		// records and frozen the witness against honest use).
		realmB.bmiHistory.saveBmiToHistory({ ...SPECS.three, lastSignature: null });
		await realmB.bmiHistory._drainLedgerWritesForTesting();
		expect(realmB.bmiHistory.readBmiHistory()).toHaveLength(1);
		const audit = await realmB.bmiHistory.auditLedgerContinuity();
		expect(audit.state).toBe('ok');
		expect(audit.computed!.length).toBe(1);
	});
});
