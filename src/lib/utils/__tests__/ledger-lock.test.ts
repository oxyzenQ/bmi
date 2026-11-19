// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z5 — the Ledger Lock (single-writer primitive) battery.
//
// Proves, in order of severity:
//   1. Platform discipline: every critical section rides the pinned
//      origin-wide lock name in exclusive mode, and overlapping
//      sections in one realm serialize in request order — the platform
//      manager is the cross-tab mutex the per-realm queues cannot be.
//   2. Reentrancy: a nested locked call runs directly instead of
//      deadlocking on its own held lock (the fake manager here would
//      wedge the test suite forever if the guard were missing).
//   3. Honest fallback: engines without a lock manager degrade to the
//      per-realm promise queue — reported once, ordering still
//      guaranteed inside this realm, exactly pre-Z5 behavior.
//   4. Failure hygiene: a rejecting critical section propagates AND
//      releases the lock, so one failure can never wedge the ledger.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../warn-dev', () => ({
	warnDev: vi.fn(),
	warnDevOnce: vi.fn()
}));

import { LEDGER_LOCK_NAME, withLedgerLock, _setLedgerLockManagerForTesting } from '../ledger-lock';
import { warnDevOnce } from '../warn-dev';

/**
 * A minimal exclusive-mode stand-in for navigator.locks: requests queue
 * on a promise chain and run one at a time, mirroring the platform's
 * grant order for same-origin exclusive requests.
 */
function makeFakeLockManager() {
	const calls: Array<{ name: string; mode: string }> = [];
	let tail: Promise<unknown> = Promise.resolve();
	return {
		calls,
		request(
			name: string,
			options: { mode: 'exclusive' },
			callback: (lock: unknown) => Promise<void>
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

beforeEach(() => {
	vi.mocked(warnDevOnce).mockClear();
});

afterEach(() => {
	_setLedgerLockManagerForTesting(undefined);
});

describe('ledger lock platform discipline', () => {
	it('holds the pinned origin-wide lock in exclusive mode per section', async () => {
		const manager = makeFakeLockManager();
		_setLedgerLockManagerForTesting(manager);
		const value = await withLedgerLock(() => 'under-lock');
		expect(value).toBe('under-lock');
		expect(manager.calls).toEqual([{ name: LEDGER_LOCK_NAME, mode: 'exclusive' }]);
	});

	it('serializes overlapping critical sections in request order', async () => {
		const manager = makeFakeLockManager();
		_setLedgerLockManagerForTesting(manager);
		const events: string[] = [];
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const first = withLedgerLock(async () => {
			events.push('first-start');
			await gate;
			events.push('first-end');
			return 1;
		});
		const second = withLedgerLock(async () => {
			events.push('second-start');
			return 2;
		});
		// Let both requests register on the manager before the gate opens.
		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		expect(await first).toBe(1);
		expect(await second).toBe(2);
		expect(events).toEqual(['first-start', 'first-end', 'second-start']);
		expect(manager.calls).toEqual([
			{ name: LEDGER_LOCK_NAME, mode: 'exclusive' },
			{ name: LEDGER_LOCK_NAME, mode: 'exclusive' }
		]);
	});
});

describe('ledger lock reentrancy', () => {
	it('a nested locked call runs directly without deadlocking on its own lock', async () => {
		// The fake manager queues requests forever; without the reentrancy
		// guard this section would wait on itself and wedge the suite.
		_setLedgerLockManagerForTesting(makeFakeLockManager());
		const value = await withLedgerLock(() => withLedgerLock(() => 'nested-inner'));
		expect(value).toBe('nested-inner');
	});
});

describe('ledger lock honest fallback', () => {
	it('degrades to the per-realm queue and reports once when no manager exists', async () => {
		_setLedgerLockManagerForTesting(null);
		const value = await withLedgerLock(() => 'fallback-value');
		expect(value).toBe('fallback-value');
		expect(warnDevOnce).toHaveBeenCalledWith(
			'ledger-lock',
			'unavailable',
			expect.stringContaining('Web Locks API unavailable')
		);
	});

	it('the fallback queue serializes overlapping sections in call order', async () => {
		_setLedgerLockManagerForTesting(null);
		const events: string[] = [];
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const first = withLedgerLock(async () => {
			events.push('first-start');
			await gate;
			events.push('first-end');
			return 'a';
		});
		const second = withLedgerLock(() => {
			events.push('second-start');
			return Promise.resolve('b');
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		expect(await first).toBe('a');
		expect(await second).toBe('b');
		expect(events).toEqual(['first-start', 'first-end', 'second-start']);
	});
});

describe('ledger lock failure hygiene', () => {
	it('propagates the critical section failure and releases the lock', async () => {
		const manager = makeFakeLockManager();
		_setLedgerLockManagerForTesting(manager);
		await expect(
			withLedgerLock(async () => {
				throw new Error('critical failure');
			})
		).rejects.toThrow('critical failure');
		// The released lock admits the next writer — one failure can
		// never wedge the ledger.
		const after = await withLedgerLock(() => 'after-failure');
		expect(after).toBe('after-failure');
		expect(manager.calls.length).toBe(2);
	});
});
