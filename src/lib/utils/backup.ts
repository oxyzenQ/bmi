/**
 * Auto Backup System for BMI Calculator.
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
    isIndexedDbAvailable,
} from './db';
import { STORAGE_KEYS, storageGet } from './storage';

// ── Constants ──
const MAX_BACKUPS = 3;
const APP_VERSION = '12.0.0';

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
export async function createBackup(_trigger: 'data_change' | 'before_import' = 'data_change'): Promise<boolean> {
  if (!browser || !isIndexedDbAvailable()) return false;

  try {
    // Snapshot all storage keys into a single JSON blob
    const snapshot: Record<string, string | null> = {};
    const keys = Object.values(STORAGE_KEYS);
    for (const key of keys) {
      snapshot[key] = storageGet(key);
    }

    // Count history records for metadata
    const historyRaw = snapshot[STORAGE_KEYS.HISTORY];
    let recordCount = 0;
    if (historyRaw) {
      try {
        const parsed = JSON.parse(historyRaw);
        if (Array.isArray(parsed)) recordCount = parsed.length;
      } catch { /* malformed — count as 0 */ }
    }

    const data = JSON.stringify(snapshot);

    await dbBackupSave({
      timestamp: Date.now(),
      appVersion: APP_VERSION,
      recordCount,
      data,
    });

    // Prune oldest backups if we exceed the limit
    await pruneOldBackups();

    return true;
  } catch {
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
    totalBackups: 0,
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
      totalBackups: all.length,
    };
  } catch {
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
  } catch {
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
    if (!latest) return false;

    const snapshot = JSON.parse(latest.data) as Record<string, string | null>;

    // Import dynamically to avoid circular dependency
    const { storageSet, storageRemove } = await import('./storage');

    // Restore all keys from snapshot
    for (const [key, value] of Object.entries(snapshot)) {
      if (value !== null) {
        storageSet(key, value);
      } else {
        storageRemove(key);
      }
    }

    return true;
  } catch {
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

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  // Fallback to date string
  return new Date(timestamp).toLocaleDateString();
}
