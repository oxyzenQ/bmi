// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Auto Backup System for BMI Stellar.
 *
 * Implements rolling local backups stored in IndexedDB:
 *   - Keeps last 3 backups (oldest auto-deleted on new backup)
 *   - Triggered on data change and before import overwrite
 *   - Each backup includes timestamp, app version, record count
 *
 * UX:
 *   - getBackupStatus() provides "Last backup: X time ago" info
 *   - "Data stored locally" indicator via isLocalBackupAvailable()
 */

import { browser } from '$app/environment';
import {
	dbBackupDelete,
	dbBackupGetAll,
	dbBackupLatest,
	dbBackupSave,
	dbMetaGet,
	dbMetaSet,
	isIndexedDbAvailable
} from './db';
import { t } from '$lib/i18n';
import { META_LEDGER_CHAIN } from './ledger-continuity';
import { withLedgerLock } from './ledger-lock';
import { mirrorVaultSnapshot, readVaultSnapshot } from './vault-backup';
import { STORAGE_KEYS, storageGetRaw } from './storage';
import { warnDev } from './warn-dev';
import { getAppVersionRaw } from './app-version';

// ── Constants ──
const MAX_BACKUPS = 3;

// ── Types ──
export interface BackupStatus {
	/** Whether at least one backup exists */
	hasBackup: boolean;
	/** ISO timestamp of the most recent backup */
	lastBackupTimestamp: string | null;
	/** Human-readable relative time (e.g., "5 minutes ago") */
	lastBackupAgo: string | null;
	/** Number of records in the latest backup */
	lastBackupRecordCount: number;
	/** App version that created the latest backup */
	lastBackupAppVersion: string | null;
	/** Total number of backups stored */
	totalBackups: number;
}

// ── Core backup logic ──

/**
 * Create a backup of all current storage data.
 * Called on data change and before import overwrite.
 * Automatically prunes oldest backups when count exceeds MAX_BACKUPS.
 */
export async function createBackup(
	_trigger: 'data_change' | 'before_import' = 'data_change'
): Promise<boolean> {
	if (!browser || !isIndexedDbAvailable()) return false;

	try {
		// Snapshot all storage keys into a single JSON blob.
		// Raw reads: a sealed at-rest ledger must back up sealed, so a
		// locked session still produces a restorable snapshot.
		const snapshot: Record<string, string | null> = {};
		const keys = Object.values(STORAGE_KEYS);
		for (const key of keys) {
			snapshot[key] = storageGetRaw(key);
		}

		// Count history records for metadata
		const historyRaw = snapshot[STORAGE_KEYS.HISTORY];
		let recordCount = 0;
		if (historyRaw) {
			try {
				const parsed = JSON.parse(historyRaw);
				if (Array.isArray(parsed)) recordCount = parsed.length;
			} catch (err) {
				warnDev('backup', 'createBackup', 'Failed to parse history for record count', err);
			}
		}

		// night-frontier-Z3: the continuity witness travels with the
		// snapshot, so a restore re-installs the head that matches the
		// restored history (a locked restore still lands both).
		snapshot[META_LEDGER_CHAIN] = await dbMetaGet(META_LEDGER_CHAIN);

		const data = JSON.stringify(snapshot);

		await dbBackupSave({
			timestamp: Date.now(),
			appVersion: getAppVersionRaw(),
			recordCount,
			data
		});

		// night-frontier-Z4: the vault tier — the same snapshot mirrors
		// into OPFS through the flush worker (write, FLUSH, close), the
		// second durable home. Fire-and-forget: the backup's outcome and
		// timing never depend on the mirror.
		void mirrorVaultSnapshot(data)
			.then((r) => {
				if (!r.ok) warnDev('backup', 'createBackup', `Vault mirror skipped: ${String(r.reason)}`);
			})
			.catch((err) => warnDev('backup', 'createBackup', 'Vault mirror failed', err));

		// Prune oldest backups if we exceed the limit
		await pruneOldBackups();

		return true;
	} catch (err) {
		warnDev('backup', 'createBackup', 'Backup creation failed', err);
		return false;
	}
}

/**
 * Remove oldest backups beyond MAX_BACKUPS.
 */
async function pruneOldBackups(): Promise<void> {
	const all = await dbBackupGetAll();
	// all is sorted newest-first
	if (all.length > MAX_BACKUPS) {
		const toDelete = all.slice(MAX_BACKUPS);
		for (const backup of toDelete) {
			if (backup.id !== undefined) {
				await dbBackupDelete(backup.id);
			}
		}
	}
}

/**
 * Get the current backup status for UX display.
 */
export async function getBackupStatus(): Promise<BackupStatus> {
	const fallback: BackupStatus = {
		hasBackup: false,
		lastBackupTimestamp: null,
		lastBackupAgo: null,
		lastBackupRecordCount: 0,
		lastBackupAppVersion: null,
		totalBackups: 0
	};

	if (!browser || !isIndexedDbAvailable()) return fallback;

	try {
		const all = await dbBackupGetAll();
		const latest = all[0] ?? null;

		if (!latest) return fallback;

		return {
			hasBackup: true,
			lastBackupTimestamp: new Date(latest.timestamp).toISOString(),
			lastBackupAgo: relativeTime(latest.timestamp),
			lastBackupRecordCount: latest.recordCount,
			lastBackupAppVersion: latest.appVersion,
			totalBackups: all.length
		};
	} catch (err) {
		warnDev('backup', 'getBackupStatus', 'Failed to read backup status', err);
		return fallback;
	}
}

/**
 * Check if a local backup is available (for "Data stored locally" indicator).
 */
export async function isLocalBackupAvailable(): Promise<boolean> {
	if (!browser || !isIndexedDbAvailable()) return false;
	try {
		const latest = await dbBackupLatest();
		return latest !== null;
	} catch (err) {
		warnDev('backup', 'isLocalBackupAvailable', 'Failed to check backup availability', err);
		return false;
	}
}

/**
 * Restore the most recent backup.
 * Returns true if restore succeeded, false otherwise.
 * NOTE: This replaces all current data — caller should confirm with user.
 */
export async function restoreLatestBackup(): Promise<boolean> {
	if (!browser || !isIndexedDbAvailable()) return false;

	try {
		const latest = await dbBackupLatest();

		// night-frontier-Z4: the vault tier is the fallback home — when
		// the IndexedDB rotation is empty or unreadable, the latest
		// flushed OPFS snapshot still restores. IDB stays primary.
		let data: string | null = latest?.data ?? null;
		if (data === null) {
			data = await readVaultSnapshot();
			if (data !== null) {
				warnDev(
					'backup',
					'restoreLatestBackup',
					'IndexedDB rotation empty — restoring from the OPFS vault fallback'
				);
			}
		}
		if (data === null) return false;

		const snapshot = JSON.parse(data) as Record<string, string | null>;

		// Import dynamically to avoid circular dependency
		const { storageSet, storageRemove, setRestoreMode } = await import('./storage');

		// night-frontier-Z5: the restore is a legit ledger write — the key
		// sweep and the witness re-install hold the origin-wide ledger lock
		// as one critical section, so a concurrent legit save in another
		// tab can never interleave between the restore and the witness it
		// belongs to.
		await withLedgerLock(async () => {
			// Suppress backup triggers during restore to prevent recursive backup creation
			setRestoreMode(true);

			try {
				// Restore only registry keys from the snapshot. The blob lives in
				// IndexedDB, which a same-origin compromise could have reshaped;
				// the allowlist keeps the restore surface inside the keys the app
				// owns, so unknown keys can never be injected into storage.
				const restoreKeys = new Set<string>(Object.values(STORAGE_KEYS));
				for (const [key, value] of Object.entries(snapshot)) {
					if (!restoreKeys.has(key)) continue;
					if (value !== null) {
						storageSet(key, value);
					} else {
						storageRemove(key);
					}
				}
			} finally {
				// Always re-enable backup after restore
				setRestoreMode(false);
			}

			// night-frontier-Z3: re-install the witness that belongs to the
			// restored history. A pre-Z3 snapshot carries no head — tombstone
			// it (an empty meta value reads as unanchored) so a stale head can
			// never accuse the restored ledger falsely; the next legit write
			// re-anchors. The restore-key allowlist above skips the meta key,
			// so this is the only path it travels.
			const witness = snapshot[META_LEDGER_CHAIN];
			await dbMetaSet(META_LEDGER_CHAIN, typeof witness === 'string' ? witness : '');
		});

		// If an at-rest session is unlocked, re-open any sealed snapshot
		// values into the cache so reads turn plaintext again. Sealed
		// values that fail to open stay sealed — never destroyed.
		const { storageRefreshAtRestCache } = await import('./storage');
		await storageRefreshAtRestCache();

		return true;
	} catch (err) {
		warnDev('backup', 'restoreLatestBackup', 'Backup restore failed', err);
		return false;
	}
}

// ── Helpers ──

/**
 * Format a timestamp as a human-readable relative time string.
 */
function relativeTime(timestamp: number): string {
	const now = Date.now();
	const diffMs = now - timestamp;
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHr = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHr / 24);

	if (diffSec < 60) return t('time.just_now');
	if (diffMin < 60) return t('time.minutes_ago', { n: diffMin });
	if (diffHr < 24) return t('time.hours_ago', { n: diffHr });
	if (diffDay < 30) return t('time.days_ago', { n: diffDay });

	// Fallback to date string
	return new Date(timestamp).toLocaleDateString();
}
