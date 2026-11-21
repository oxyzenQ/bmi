// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * Cross-tab storage coherence (night-frontier-Z5).
 *
 * Physics gap this closes: the escalator's memory cache is a per-realm
 * view of origin storage. A foreign tab writes through its own realm —
 * the localStorage mirror lands in this realm's browser storage, but the
 * memory cache keeps serving the stale pre-state. A stale pre-state is
 * exactly what poisons the continuity reseat blessing (a legit save can
 * freeze the witness as a false accusation) and what lets a save
 * overwrite a foreign record. Two doors close the gap:
 *
 *   - installForeignTabCoherence(): the storage event names every key a
 *     foreign tab changed; health keys drop their cache entry so UI
 *     reads see the mirror again.
 *   - refreshHealthKeysFromMirror(): the deterministic door — every
 *     locked ledger-write critical section calls it first, so the
 *     read-modify-write always merges over fresh cross-tab state
 *     regardless of event timing. Sealed mirrors re-open into an
 *     unlocked realm's cache; a locked realm keeps its locked-read
 *     semantics (envelopes stay invisible, never destroyed).
 *
 * Health keys only: the unit-system listener stays in the page; this
 * leaf never touches presentation state.
 */

import { browser } from '$app/environment';
import { STORAGE_KEYS, storageInvalidate, storageRefreshAtRestCache } from './storage';
import { warnDev } from './warn-dev';

/** The keys whose staleness can corrupt a ledger write or a display read. */
const HEALTH_STORAGE_KEYS: readonly string[] = [
	STORAGE_KEYS.HISTORY,
	STORAGE_KEYS.BMI_GOAL,
	STORAGE_KEYS.BMI_GOAL_START
];

function isHealthKey(key: string | null): boolean {
	return key === null || HEALTH_STORAGE_KEYS.includes(key);
}

/**
 * Invalidate the per-realm cache for foreign-tab health-key writes.
 * Returns the unsubscribe function; SSR returns a no-op.
 */
export function installForeignTabCoherence(): () => void {
	if (!browser) return () => {};
	const onStorage = (event: StorageEvent) => {
		if (!isHealthKey(event.key)) return;
		const keys = event.key === null ? HEALTH_STORAGE_KEYS : [event.key];
		for (const key of keys) storageInvalidate(key);
		void refreshHealthKeysFromMirror();
	};
	window.addEventListener('storage', onStorage);
	return () => window.removeEventListener('storage', onStorage);
}

/**
 * Deterministic freshness for a locked ledger-write critical section:
 * drop the cached health values and re-read the mirror, re-opening any
 * sealed envelope the session can open. Never throws — a failed refresh
 * degrades to the pre-Z5 read path (cache or mirror), reported honestly.
 */
export async function refreshHealthKeysFromMirror(): Promise<void> {
	if (!browser) return;
	for (const key of HEALTH_STORAGE_KEYS) storageInvalidate(key);
	try {
		await storageRefreshAtRestCache();
	} catch (err) {
		warnDev(
			'storage-coherence',
			'refreshHealthKeysFromMirror',
			'At-rest cache refresh failed — reads degrade to the mirror path',
			err
		);
	}
}
