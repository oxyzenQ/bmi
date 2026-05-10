/**
 * Centralized storage utility with in-memory caching, IndexedDB durability,
 * and automatic localStorage → IndexedDB migration.
 *
 * Architecture:
 *   - In-memory cache: fast synchronous reads (no JSON.parse on every call)
 *   - localStorage: sync fallback / write-through mirror
 *   - IndexedDB: durable primary store (via db.ts)
 *
 * All storage reads/writes in the BMI app should go through this module.
 * Call initStorage() once on app startup (in onMount) to populate the cache
 * from IndexedDB and run any pending migrations.
 */

import { browser } from '$app/environment';
import {
    dbGetAll,
    dbMetaGet,
    dbMetaSet,
    dbRemove,
    dbSet,
    isIndexedDbAvailable
} from './db';
import { warnDev, warnDevOnce } from './warn-dev';

// ── Storage key registry ──
export const STORAGE_KEYS = {
  HISTORY: 'bmi.history',
  UNIT_SYSTEM: 'bmi.unitSystem',
  RENDER_MODE: 'bmi.renderMode',
  WALLPAPER_THEME: 'bmi.wallpaperTheme',
  LOCALE: 'bmi.locale',
  BMI_GOAL: 'bmi.goal',
  BMI_GOAL_START: 'bmi.goal.start',
  // Legacy keys (cleaned up on read)
  SMOOTH_MODE: 'bmi.smoothMode',
  ULTRA_SMOOTH: 'bmi.ultraSmooth',
} as const;

/** Current storage schema version (bumped when structure changes). */
const SCHEMA_VERSION = 1;
const META_SCHEMA_KEY = '__schema_version';
const META_MIGRATED_KEY = '__migrated_from_ls';

// ── In-memory cache ──
const cache = new Map<string, string | null>();

/** Whether initStorage() has completed. */
let _initialized = false;

// ── Debounced backup trigger ──
let _backupTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Trigger a debounced backup. Coalesces rapid writes within 2 seconds
 * so that multiple history updates in the same tick produce only one backup.
 */
function triggerBackup(reason: 'data_change' | 'before_import'): void {
  if (_backupTimer) clearTimeout(_backupTimer);
  const delay = reason === 'before_import' ? 0 : 2000;
  _backupTimer = setTimeout(() => {
    import('./backup').then(({ createBackup }) => {
      void createBackup(reason);
    }).catch((err) => {
      warnDevOnce('storage', 'triggerBackup', 'Backup creation failed', err);
    });
    _backupTimer = null;
  }, delay);
}

/**
 * Initialize storage: populate cache from IndexedDB, run migration if needed.
 * Must be called once in onMount before any data-dependent logic.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initStorage(): Promise<void> {
  if (!browser || _initialized) return;

  // If IndexedDB is unavailable, fall back to localStorage-only mode
  if (!isIndexedDbAvailable()) {
    _initialized = true;
    return;
  }

  try {
    // Check if migration from localStorage is needed
    const migrated = await dbMetaGet(META_MIGRATED_KEY);

    if (migrated !== '1') {
      // First time: migrate localStorage → IndexedDB
      await migrateFromLocalStorage();
    }

    // Populate in-memory cache from IndexedDB
    const entries = await dbGetAll();
    cache.clear();
    for (const { key, value } of entries) {
      cache.set(key, value);
    }

    // Also sync to localStorage so sync fallback works
    for (const { key, value } of entries) {
      try { localStorage.setItem(key, value); } catch { /* quota — warnDev intentionally skipped for perf */ }
    }

    // Ensure schema version is recorded
    const currentSchema = await dbMetaGet(META_SCHEMA_KEY);
    if (currentSchema !== String(SCHEMA_VERSION)) {
      await dbMetaSet(META_SCHEMA_KEY, String(SCHEMA_VERSION));
    }

    _initialized = true;
  } catch (err) {
    // IndexedDB failed — fall back to localStorage-only mode
    warnDev('storage', 'initStorage', 'IndexedDB init failed, falling back to localStorage-only mode', err);
    _initialized = true;
  }
}

/**
 * Migrate all bmi.* keys from localStorage to IndexedDB.
 * Called once on first load after upgrade.
 */
async function migrateFromLocalStorage(): Promise<void> {
  const keysToMigrate = Object.values(STORAGE_KEYS);

  for (const key of keysToMigrate) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        await dbSet(key, value);
      }
    } catch (err) { warnDev('storage', 'migrateFromLocalStorage', `Failed to migrate key: ${key}`, err); }
  }

  // Mark migration as complete
  await dbMetaSet(META_MIGRATED_KEY, '1');
}

/**
 * Read a value from cache (populated from IndexedDB on init).
 * Falls back to localStorage if cache is empty (pre-init or IndexedDB unavailable).
 * Returns null if the key does not exist.
 */
export function storageGet(key: string): string | null {
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const value = localStorage.getItem(key);
    cache.set(key, value);
    return value;
  } catch (err) {
    warnDev('storage', 'storageGet', `Failed to read key: ${key}`, err);
    cache.set(key, null);
    return null;
  }
}

/**
 * Write a value to cache + localStorage (sync) and IndexedDB (async fire-and-forget).
 * Returns true on success (sync write), false on sync failure.
 */
export function storageSet(key: string, value: string): boolean {
  let success = true;
  try {
    localStorage.setItem(key, value);
    cache.set(key, value);
  } catch (err) {
    // localStorage write failed — still update cache but report failure
    warnDev('storage', 'storageSet', `Failed to write key: ${key}`, err);
    success = false;
    cache.set(key, value);
  }

  // Async write to IndexedDB (fire-and-forget, non-blocking)
  if (browser && isIndexedDbAvailable()) {
    dbSet(key, value).catch((err) => {
      warnDevOnce('storage', 'storageSet:db', `IndexedDB write failed for key: ${key}`, err);
    });
  }

  // Auto-backup on history data change
  if (key === STORAGE_KEYS.HISTORY && browser) {
    triggerBackup('data_change');
  }

  return success;
}

/**
 * Remove a key from cache, localStorage, and IndexedDB.
 */
export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    warnDev('storage', 'storageRemove', `Failed to remove key: ${key}`, err);
  }
  cache.delete(key);

  // Async remove from IndexedDB
  if (browser && isIndexedDbAvailable()) {
    dbRemove(key).catch((err) => {
      warnDevOnce('storage', 'storageRemove:db', `IndexedDB remove failed for key: ${key}`, err);
    });
  }
}

/**
 * Parse a JSON value from storage with type safety.
 * Returns the fallback if the key is missing, invalid, or JSON is malformed.
 */
export function storageGetJSON<T>(key: string, fallback: T): T {
  const raw = storageGet(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    warnDev('storage', 'storageGetJSON', `Failed to parse JSON for key: ${key}`, err);
    return fallback;
  }
}

/**
 * Write a JSON value to storage.
 * Returns true on success, false on failure.
 */
export function storageSetJSON<T>(key: string, value: T): boolean {
  return storageSet(key, JSON.stringify(value));
}

/**
 * Invalidate a specific cache entry, forcing the next read to hit storage.
 * Useful after cross-tab storage events.
 */
export function storageInvalidate(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all cache entries.
 */
export function storageInvalidateAll(): void {
  cache.clear();
}

/**
 * Check if localStorage is available in this context.
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, '1');
    localStorage.removeItem(test);
    return true;
  } catch (err) {
    warnDev('storage', 'isStorageAvailable', 'localStorage test failed', err);
    return false;
  }
}

/**
 * Check if storage has been initialized (initStorage completed).
 */
export function isStorageInitialized(): boolean {
  return _initialized;
}
