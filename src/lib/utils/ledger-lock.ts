// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The Ledger Lock — the single-writer law (night-frontier-Z5).
 *
 * Physics gap this closes: every serialization primitive the ledger
 * already had (the per-key IndexedDB write queue in storage.ts, the
 * witness seal queue in ledger-continuity.ts) lives inside ONE JavaScript
 * realm. Two tabs of the same app are two realms racing on the same
 * origin storage, so overlapping legit writes could interleave: a stale
 * read-modify-write could silently drop a foreign record and leave the
 * continuity witness frozen as a false accusation — the ledger would lie
 * about honest use. The Web Locks API is the browser's own origin-scoped
 * mutex; this module holds it in exclusive mode across every legit
 * ledger write critical section (save, import, restore, clear).
 *
 * Threat model, stated honestly:
 *   - The lock is advisory: out-of-band writers (the tamper model of
 *     night-frontier-Z3) bypass it entirely — and must. The witness
 *     freeze rule stays the tamper guard; the lock only removes the
 *     legit-writer race, never weakens tamper evidence.
 *   - Engines without navigator.locks degrade to the per-realm
 *     discipline (per-key queues + seal queue), reported once per realm.
 *     The fallback behavior is exactly pre-Z5, not an invention.
 *
 * This module is a dependency leaf: warn-dev only. Callers run their
 * critical section under the lock; the reseat/seal internals stay
 * lock-free because they only ever execute inside a held section.
 */

import { warnDevOnce } from './warn-dev';

/** The origin-scoped lock every ledger write holds in exclusive mode. */
export const LEDGER_LOCK_NAME = 'bmi-ledger-write';

/** Structural surface of the Web Locks manager this module needs. */
interface LedgerLockManager {
	request(
		name: string,
		options: { mode: 'exclusive' },
		callback: (lock: unknown) => Promise<unknown>
	): Promise<unknown>;
}

/**
 * Test-only injection seam: when defined it replaces the navigator
 * lookup (node and jsdom test realms ship no navigator.locks). Never
 * set by production code; `undefined` clears the injection.
 */
let injectedManager: LedgerLockManager | null | undefined;

/** @internal Test-only: inject a lock manager, or clear with undefined. */
export function _setLedgerLockManagerForTesting(
	manager: LedgerLockManager | null | undefined
): void {
	injectedManager = manager;
}

function getLockManager(): LedgerLockManager | null {
	if (injectedManager !== undefined) return injectedManager;
	const nav = typeof navigator === 'undefined' ? null : navigator;
	const locks = (nav as { locks?: LedgerLockManager } | null)?.locks;
	return locks ?? null;
}

// Reentrancy flag: a critical section that reaches another locked entry
// point must run directly — requesting the same named lock from the
// realm that already holds it would wait forever. The seal queue and the
// per-key write queues serialize beneath the lock, so nested sections
// keep their ordering discipline. No production path nests today; the
// guard is defensive by design.
let lockHeld = false;

// Fallback queue: without a platform manager this realm serializes its
// own critical sections on a promise chain — the same discipline the
// witness seal queue uses. This restores the intra-realm ordering the
// synchronous pre-Z5 write path had for free.
let fallbackTail: Promise<unknown> = Promise.resolve();

/**
 * Run `critical` while holding the origin-wide ledger lock in exclusive
 * mode. The lock machinery itself never throws; the critical section's
 * rejection propagates and the lock is released either way.
 */
export async function withLedgerLock<T>(critical: () => Promise<T> | T): Promise<T> {
	if (lockHeld) return await critical();
	const manager = getLockManager();
	if (manager) {
		return (await manager.request(LEDGER_LOCK_NAME, { mode: 'exclusive' }, async () => {
			lockHeld = true;
			try {
				return await critical();
			} finally {
				lockHeld = false;
			}
		})) as T;
	}
	warnDevOnce(
		'ledger-lock',
		'unavailable',
		'Web Locks API unavailable — ledger writes degrade to per-realm serialization only'
	);
	const step = async (): Promise<T> => {
		lockHeld = true;
		try {
			return await critical();
		} finally {
			lockHeld = false;
		}
	};
	const run = fallbackTail.then(step, step);
	fallbackTail = run.catch(() => {});
	return run;
}
