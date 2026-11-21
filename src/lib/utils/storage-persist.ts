// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * Eviction resistance for the local ledger.
 *
 * Browsers may evict origin storage (IndexedDB + localStorage) silently
 * under disk pressure unless the origin is marked persistent. This module
 * requests persistence once per session and reports the result, so the
 * "ledger never lies" promise rests on an explicit browser-side grant
 * instead of an assumption.
 *
 * Honest semantics: persist() is a request, not a guarantee — browsers
 * auto-grant it for installed PWAs and engaged origins and may deny it
 * otherwise. A denial is surfaced through the status and a dev warning,
 * never swallowed, and the ledger keeps its own rolling backups either
 * way.
 */

import { browser } from '$app/environment';
import { warnDev } from './warn-dev';

export interface StoragePersistenceStatus {
	/** A StorageManager with a persist API exists in this context. */
	supported: boolean;
	/** The browser currently reports the origin as persistent. */
	persisted: boolean | null;
	/** persist() has been requested at least once this session. */
	requested: boolean;
}

let _requested = false;
let _lastKnown: boolean | null = null;

function storageManager(): StorageManager | null {
	if (!browser) return null;
	try {
		const nav = navigator as Navigator & { storage?: StorageManager };
		return nav.storage ?? null;
	} catch (err) {
		warnDev('storage-persist', 'storageManager', 'navigator.storage access failed', err);
		return null;
	}
}

/**
 * Request persistent storage once per session. Best-effort: resolves to
 * the grant result, null when unsupported or when the request fails.
 * Repeat calls return the cached result instead of re-asking the
 * browser, so the prompt never loops.
 */
export function requestStoragePersistence(): Promise<boolean | null> {
	const manager = storageManager();
	if (!manager || typeof manager.persist !== 'function') {
		return Promise.resolve(null);
	}
	if (_requested) {
		return Promise.resolve(_lastKnown);
	}
	_requested = true;
	return manager
		.persist()
		.then((granted) => {
			_lastKnown = granted;
			if (!granted) {
				warnDev(
					'storage-persist',
					'requestStoragePersistence',
					'persistent storage not granted — the ledger may be evicted under disk pressure'
				);
			}
			return granted;
		})
		.catch((err) => {
			warnDev('storage-persist', 'requestStoragePersistence', 'persist() request failed', err);
			return null;
		});
}

/** Synchronous snapshot of the last known persistence state. */
export function getStoragePersistenceStatus(): StoragePersistenceStatus {
	const manager = storageManager();
	return {
		supported: Boolean(manager && typeof manager.persist === 'function'),
		persisted: _lastKnown,
		requested: _requested
	};
}

/** Refresh from the browser's own persisted() report. */
export async function refreshStoragePersistenceStatus(): Promise<StoragePersistenceStatus> {
	const manager = storageManager();
	if (manager && typeof manager.persisted === 'function') {
		try {
			_lastKnown = await manager.persisted();
		} catch (err) {
			warnDev('storage-persist', 'refreshStoragePersistenceStatus', 'persisted() read failed', err);
		}
	}
	return getStoragePersistenceStatus();
}

/** Internal test-only reset. */
export function _resetStoragePersistenceForTesting(): void {
	_requested = false;
	_lastKnown = null;
}
