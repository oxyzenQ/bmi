// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Tests for the per-key IndexedDB write queue / serializer in storage.ts.
 *
 * The queue guarantees that rapid same-key writes to IndexedDB are serialized:
 *   - The first write for a key calls dbSet immediately (synchronous).
 *   - Subsequent writes chain on the previous write's promise and run after it.
 *   - Superseded writes (whose sequence is no longer latest) are skipped entirely.
 *   - Final IndexedDB value always matches the latest storageSet() call.
 *
 * Uses a fake IndexedDB Map that only commits values when dbSet resolves,
 * so tests prove the actual IndexedDB final state — not just cache/localStorage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock $app/environment ──
vi.mock('$app/environment', () => ({
	browser: true,
	dev: false,
	building: false,
	version: 'test'
}));

// ── Fake IndexedDB: a Map that commits values only when dbSet resolves ──
const fakeIdb = new Map<string, string>();

// Track dbSet invocations for fine-grained control.
// Each entry represents a pending dbSet call that hasn't resolved yet.
interface PendingDbSet {
	key: string;
	value: string;
	resolve: () => void;
	reject: (err: Error) => void;
}
const pendingDbSets: PendingDbSet[] = [];

vi.mock('../db', () => ({
	isIndexedDbAvailable: vi.fn().mockReturnValue(true),
	dbGetAll: vi.fn().mockResolvedValue([]),
	dbRemove: vi.fn().mockImplementation(async (key: string) => {
		fakeIdb.delete(key);
	}),
	dbMetaGet: vi.fn().mockResolvedValue(null),
	dbMetaSet: vi.fn().mockResolvedValue(undefined),
	dbSet: vi.fn().mockImplementation((key: string, value: string) => {
		return new Promise<void>((resolve, reject) => {
			pendingDbSets.push({ key, value, resolve, reject });
		});
	})
}));

// ── Mock warn-dev ──
vi.mock('../warn-dev', () => ({
	warnDev: vi.fn(),
	warnDevOnce: vi.fn()
}));

import {
	storageSet,
	storageGet,
	storageInvalidateAll,
	STORAGE_KEYS,
	_resetIdbWriteSeqForTesting,
	_getIdbWriteSeq,
	_getIdbWriteQueue
} from '../storage';

beforeEach(() => {
	localStorage.clear();
	fakeIdb.clear();
	pendingDbSets.length = 0;
	storageInvalidateAll();
	_resetIdbWriteSeqForTesting();
});

describe('per-key IndexedDB write queue', () => {
	it('assigns monotonically increasing sequence numbers for same-key writes', () => {
		storageSet('test.key', 'value-A');
		const seqA = _getIdbWriteSeq('test.key');

		storageSet('test.key', 'value-B');
		const seqB = _getIdbWriteSeq('test.key');

		expect(typeof seqA).toBe('number');
		expect(typeof seqB).toBe('number');
		expect(seqB as number).toBeGreaterThan(seqA as number);
	});

	it('different keys remain independent — each has its own queue', async () => {
		storageSet('key.a', 'val-a');
		storageSet('key.b', 'val-b');

		// Both keys should have their own queue promise
		expect(_getIdbWriteQueue('key.a')).toBeDefined();
		expect(_getIdbWriteQueue('key.b')).toBeDefined();

		// Both dbSet calls should be pending (first write for each key is immediate)
		expect(pendingDbSets).toHaveLength(2);

		// Resolve both
		for (const p of pendingDbSets) {
			fakeIdb.set(p.key, p.value);
			p.resolve();
		}
		pendingDbSets.length = 0;

		// Wait for both queues to settle
		await Promise.all([_getIdbWriteQueue('key.a'), _getIdbWriteQueue('key.b')]);

		expect(fakeIdb.get('key.a')).toBe('val-a');
		expect(fakeIdb.get('key.b')).toBe('val-b');
	});

	it('rapid same-key writes serialize so final IndexedDB value is latest', async () => {
		// Three rapid writes for the same key.
		// Only the first write (A) starts dbSet immediately.
		// Writes B and C chain on A's promise.
		// Since C supersedes B, B will be skipped when it runs.
		// A resolves → B's run() fires, seq stale → skipped → C's run() fires → dbSet(C).

		storageSet('race.key', 'value-A');
		// A's dbSet is called synchronously
		expect(pendingDbSets).toHaveLength(1);
		expect(pendingDbSets[0].value).toBe('value-A');

		storageSet('race.key', 'value-B');
		// B is queued behind A — dbSet not called yet
		expect(pendingDbSets).toHaveLength(1);

		storageSet('race.key', 'value-C');
		// C is also queued — still only A pending
		expect(pendingDbSets).toHaveLength(1);

		// Resolve A — B starts but is superseded by C, so B is skipped.
		// Then C starts (seq is latest).
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		// C's dbSet should be pending (B was skipped)
		await vi.waitFor(() => expect(pendingDbSets).toHaveLength(1));
		expect(pendingDbSets[0].value).toBe('value-C');

		// Resolve C
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		// Wait for queue to settle
		await _getIdbWriteQueue('race.key');

		// Fake IndexedDB must have the LATEST value (C)
		expect(fakeIdb.get('race.key')).toBe('value-C');
		// Cache and localStorage must also have the latest value
		expect(storageGet('race.key')).toBe('value-C');
		expect(localStorage.getItem('race.key')).toBe('value-C');
	});

	it('two rapid same-key writes: both serialize without skipping', async () => {
		// Two writes with no third superseding — both should commit in order.

		storageSet('two.key', 'value-A');
		expect(pendingDbSets).toHaveLength(1);

		storageSet('two.key', 'value-B');
		// B is queued behind A
		expect(pendingDbSets).toHaveLength(1);

		// Resolve A — B starts (B's seq is still latest since no third write)
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		await vi.waitFor(() => expect(pendingDbSets).toHaveLength(1));
		expect(pendingDbSets[0].value).toBe('value-B');

		// Resolve B
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		await _getIdbWriteQueue('two.key');

		// Both committed, final value is B
		expect(fakeIdb.get('two.key')).toBe('value-B');
	});

	it('newer write waits for older in-flight write, then commits latest', async () => {
		// Write A — starts immediately, dbSet pending
		storageSet('seq.key', 'value-A');
		expect(pendingDbSets).toHaveLength(1);

		// Write B — queued behind A, not yet started
		storageSet('seq.key', 'value-B');
		expect(pendingDbSets).toHaveLength(1);

		// Resolve A's dbSet
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		// B's dbSet should now start
		await vi.waitFor(() => expect(pendingDbSets).toHaveLength(1));
		expect(pendingDbSets[0].value).toBe('value-B');

		// Resolve B's dbSet
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		await _getIdbWriteQueue('seq.key');

		// Final IndexedDB value must be B (the latest write)
		expect(fakeIdb.get('seq.key')).toBe('value-B');
	});

	it('stale queued write is skipped when superseded before start', async () => {
		// Write A — starts immediately
		storageSet('skip.key', 'value-A');
		expect(pendingDbSets).toHaveLength(1);

		// Write B — queued behind A
		storageSet('skip.key', 'value-B');

		// Write C — queued behind B, supersedes B
		storageSet('skip.key', 'value-C');

		// Only A's dbSet is pending (B and C are queued)
		expect(pendingDbSets).toHaveLength(1);

		// Resolve A — B should start but its seq is stale (C superseded it), so B is SKIPPED.
		// Then C should start (its seq is latest).
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		// B was skipped, C's dbSet should now be pending
		await vi.waitFor(() => expect(pendingDbSets).toHaveLength(1));
		expect(pendingDbSets[0].value).toBe('value-C');

		// Resolve C
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		await _getIdbWriteQueue('skip.key');

		// Final IndexedDB must be C — B was never committed
		expect(fakeIdb.get('skip.key')).toBe('value-C');
	});

	it('import/history overwrite with skipBackup ends with imported value in IndexedDB', async () => {
		// Normal write
		storageSet(STORAGE_KEYS.HISTORY, JSON.stringify([{ id: 1 }]));
		expect(pendingDbSets).toHaveLength(1);

		// Import overwrites with skipBackup
		storageSet(STORAGE_KEYS.HISTORY, JSON.stringify([{ id: 2 }, { id: 3 }]), { skipBackup: true });
		// Import is queued behind normal write
		expect(pendingDbSets).toHaveLength(1);

		// Resolve normal write
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		// Import's dbSet should now start
		await vi.waitFor(() => expect(pendingDbSets).toHaveLength(1));
		expect(pendingDbSets[0].value).toBe(JSON.stringify([{ id: 2 }, { id: 3 }]));

		// Resolve import write
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		await _getIdbWriteQueue(STORAGE_KEYS.HISTORY);

		// IndexedDB must have the imported (latest) value
		expect(fakeIdb.get(STORAGE_KEYS.HISTORY)).toBe(JSON.stringify([{ id: 2 }, { id: 3 }]));
		expect(storageGet(STORAGE_KEYS.HISTORY)).toBe(JSON.stringify([{ id: 2 }, { id: 3 }]));
	});

	it('current (latest) IndexedDB failure triggers warning', async () => {
		const { warnDevOnce } = await import('../warn-dev');

		// Single write — no superseding write follows
		storageSet('fail.key', 'value-A');
		expect(pendingDbSets).toHaveLength(1);

		// Fail the dbSet — it's the current/latest write, should warn
		pendingDbSets[0].reject(new Error('IDB write error'));
		pendingDbSets.length = 0;

		await _getIdbWriteQueue('fail.key');

		const warnCalls = (warnDevOnce as ReturnType<typeof vi.fn>).mock.calls;
		const relevantWarns = warnCalls.filter(
			(args) => args[2] && (args[2] as string).includes('fail.key')
		);
		expect(relevantWarns).toHaveLength(1);
	});

	it('superseded write failure does not trigger warning (write was skipped)', async () => {
		const { warnDevOnce } = await import('../warn-dev');

		// Write A — starts immediately
		storageSet('stale.key', 'value-A');
		expect(pendingDbSets).toHaveLength(1);

		// Write B — queued behind A
		storageSet('stale.key', 'value-B');

		// Write C — supersedes B, queued behind A
		storageSet('stale.key', 'value-C');

		// Resolve A successfully
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		// B is skipped (superseded by C). C's dbSet starts.
		await vi.waitFor(() => expect(pendingDbSets).toHaveLength(1));
		expect(pendingDbSets[0].value).toBe('value-C');

		// Resolve C successfully
		fakeIdb.set(pendingDbSets[0].key, pendingDbSets[0].value);
		pendingDbSets[0].resolve();
		pendingDbSets.length = 0;

		await _getIdbWriteQueue('stale.key');

		// No warnings should have been emitted (A succeeded, B was skipped, C succeeded)
		const warnCalls = (warnDevOnce as ReturnType<typeof vi.fn>).mock.calls;
		const relevantWarns = warnCalls.filter(
			(args) => args[2] && (args[2] as string).includes('stale.key')
		);
		expect(relevantWarns).toHaveLength(0);
	});

	it('in-flight stale failure is suppressed; only latest failure warns', async () => {
		const { warnDevOnce } = await import('../warn-dev');

		// Write A — starts immediately
		storageSet('chain.key', 'value-A');
		expect(pendingDbSets).toHaveLength(1);

		// Write B — queued behind A (B is now the latest seq)
		storageSet('chain.key', 'value-B');

		// Fail A's dbSet — but B has already been called with a newer seq,
		// so A's seq is stale. A's failure warning is suppressed.
		pendingDbSets[0].reject(new Error('IDB error'));
		pendingDbSets.length = 0;

		// B's dbSet should start despite A's failure (promise chain continues via .catch)
		await vi.waitFor(() => expect(pendingDbSets).toHaveLength(1));
		expect(pendingDbSets[0].value).toBe('value-B');

		// Fail B's dbSet — B IS the latest, so it should warn
		pendingDbSets[0].reject(new Error('IDB error'));
		pendingDbSets.length = 0;

		await _getIdbWriteQueue('chain.key');

		const warnCalls = (warnDevOnce as ReturnType<typeof vi.fn>).mock.calls;
		const relevantWarns = warnCalls.filter(
			(args) => args[2] && (args[2] as string).includes('chain.key')
		);
		// Only B's failure should warn — A's was suppressed because it was stale
		expect(relevantWarns).toHaveLength(1);
	});
});
