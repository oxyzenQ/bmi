// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Tests for the per-key IndexedDB write sequence guard in storage.ts.
 *
 * Ensures that rapid same-key writes to IndexedDB cannot race:
 * the latest write for a key must always win, even if async timing
 * resolves out of order. An older pending write must not overwrite
 * a newer value (e.g. import/restore overwriting imported history).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true,
	dev: false,
	building: false,
	version: 'test'
}));

// Track the order and values that dbSet is called with
const dbSetCalls: Array<{ key: string; value: string }> = [];
let dbSetCallIndex = 0;
const dbSetResolvers: Array<{
	key: string;
	value: string;
	resolve: () => void;
	reject: (err: Error) => void;
}> = [];

// Mock db.ts with controllable async behavior
vi.mock('../db', () => ({
	isIndexedDbAvailable: vi.fn().mockReturnValue(true),
	dbGetAll: vi.fn().mockResolvedValue([]),
	dbRemove: vi.fn().mockResolvedValue(undefined),
	dbMetaGet: vi.fn().mockResolvedValue(null),
	dbMetaSet: vi.fn().mockResolvedValue(undefined),
	dbSet: vi.fn().mockImplementation((key: string, value: string) => {
		dbSetCalls.push({ key, value });
		// Return a promise that we can resolve/reject manually for race testing
		return new Promise<void>((resolve, reject) => {
			dbSetResolvers.push({ key, value, resolve, reject });
		});
	})
}));

// Mock warn-dev
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
	_getIdbWriteSeq
} from '../storage';

beforeEach(() => {
	localStorage.clear();
	dbSetCalls.length = 0;
	dbSetCallIndex = 0;
	dbSetResolvers.length = 0;
	storageInvalidateAll();
	_resetIdbWriteSeqForTesting();
});

describe('storage write sequence guard', () => {
	it('assigns monotonically increasing sequence numbers for same-key writes', () => {
		storageSet('test.key', 'value-A');
		const seqA = _getIdbWriteSeq('test.key');

		storageSet('test.key', 'value-B');
		const seqB = _getIdbWriteSeq('test.key');

		expect(typeof seqA).toBe('number');
		expect(typeof seqB).toBe('number');
		expect(seqB as number).toBeGreaterThan(seqA as number);
	});

	it('different keys get independent sequence numbers', () => {
		storageSet('key.a', 'val-a');
		storageSet('key.b', 'val-b');

		const seqA = _getIdbWriteSeq('key.a');
		const seqB = _getIdbWriteSeq('key.b');

		// Both should have the global counter's latest value,
		// but tracked independently per key
		expect(seqA).toBeDefined();
		expect(seqB).toBeDefined();
		expect(seqB as number).toBeGreaterThan(seqA as number);
	});

	it('only the latest same-key write wins when older writes resolve later', async () => {
		// Write A (older) — don't resolve yet
		storageSet('race.key', 'value-A');
		expect(dbSetResolvers).toHaveLength(1);

		// Write B (newer) — don't resolve yet
		storageSet('race.key', 'value-B');
		expect(dbSetResolvers).toHaveLength(2);

		// Both async dbSet calls are pending.
		// Resolve B first (newer)
		dbSetResolvers[1].resolve();
		// Resolve A second (older) — this should still succeed (IndexedDB put is idempotent)
		// but the point is the sequence tracker ensures B's value is the one that matters.
		dbSetResolvers[0].resolve();

		// Allow microtasks to complete
		await vi.waitFor(() => expect(dbSetCalls).toHaveLength(2));

		// The cache should have the latest value (B)
		expect(storageGet('race.key')).toBe('value-B');
		expect(localStorage.getItem('race.key')).toBe('value-B');

		// dbSet was called for both, but B was the last to resolve
		expect(dbSetCalls[0].value).toBe('value-A');
		expect(dbSetCalls[1].value).toBe('value-B');
	});

	it('import write (skipBackup) still uses sequence guard', () => {
		// Simulate a normal write followed by an import-style overwrite
		storageSet(STORAGE_KEYS.HISTORY, JSON.stringify([{ id: 1 }]));

		// Import overwrites with skipBackup — should still increment sequence
		storageSet(STORAGE_KEYS.HISTORY, JSON.stringify([{ id: 2 }, { id: 3 }]), { skipBackup: true });

		const seq = _getIdbWriteSeq(STORAGE_KEYS.HISTORY);
		expect(seq).toBeDefined();
		expect(seq as number).toBeGreaterThan(0);

		// Cache should have the imported value
		expect(storageGet(STORAGE_KEYS.HISTORY)).toBe(JSON.stringify([{ id: 2 }, { id: 3 }]));
	});

	it('stale IndexedDB failure for superseded write does not trigger warning', async () => {
		const { warnDevOnce } = await import('../warn-dev');

		// Write A
		storageSet('warn.key', 'value-A');
		// Write B (supersedes A)
		storageSet('warn.key', 'value-B');

		// Fail A's dbSet (stale — already superseded by B)
		dbSetResolvers[0].reject(new Error('IDB error'));
		// Succeed B's dbSet (current)
		dbSetResolvers[1].resolve();

		await vi.waitFor(() => expect(dbSetCalls).toHaveLength(2));

		// warnDevOnce should NOT be called for A's failure since it's superseded
		// It may be called for other reasons but not for the stale A write
		const warnCalls = (warnDevOnce as ReturnType<typeof vi.fn>).mock.calls;
		const staleWarns = warnCalls.filter(
			(args) => args[2] && (args[2] as string).includes('warn.key')
		);
		expect(staleWarns).toHaveLength(0);
	});

	it('current IndexedDB failure still triggers warning', async () => {
		const { warnDevOnce } = await import('../warn-dev');

		// Write A
		storageSet('fail.key', 'value-A');

		// Fail A's dbSet — this is the CURRENT write, so it should warn
		dbSetResolvers[0].reject(new Error('IDB error'));

		await vi.waitFor(() => expect(dbSetCalls).toHaveLength(1));

		const warnCalls = (warnDevOnce as ReturnType<typeof vi.fn>).mock.calls;
		const relevantWarns = warnCalls.filter(
			(args) => args[2] && (args[2] as string).includes('fail.key')
		);
		expect(relevantWarns).toHaveLength(1);
	});
});
