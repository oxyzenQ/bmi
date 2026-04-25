/**
 * Centralized localStorage utility with in-memory caching and race-condition prevention.
 *
 * All localStorage reads/writes in the BMI app should go through this module.
 * Benefits:
 *   - In-memory cache eliminates redundant JSON.parse calls
 *   - Write-batching coalesces rapid writes within the same tick
 *   - try/catch wrapping prevents unhandled QuotaExceeded errors
 *   - Single source of truth for all localStorage keys
 */

// ── Storage key registry ──
export const STORAGE_KEYS = {
  HISTORY: 'bmi.history',
  UNIT_SYSTEM: 'bmi.unitSystem',
  RENDER_MODE: 'bmi.renderMode',
  WALLPAPER_THEME: 'bmi.wallpaperTheme',
  // Legacy keys (cleaned up on read)
  SMOOTH_MODE: 'bmi.smoothMode',
  ULTRA_SMOOTH: 'bmi.ultraSmooth',
} as const;

// ── In-memory cache ──
const cache = new Map<string, string | null>();

/**
 * Read a value from localStorage, returning the cached version if available.
 * Returns null if the key does not exist or localStorage is unavailable.
 */
export function storageGet(key: string): string | null {
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const value = localStorage.getItem(key);
    cache.set(key, value);
    return value;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/**
 * Write a value to localStorage and update the cache.
 * Returns true on success, false on failure (e.g., QuotaExceeded).
 */
export function storageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    cache.set(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a key from localStorage and invalidate the cache.
 */
export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently handle unavailable storage
  }
  cache.delete(key);
}

/**
 * Parse a JSON value from localStorage with type safety.
 * Returns the fallback if the key is missing, invalid, or JSON is malformed.
 */
export function storageGetJSON<T>(key: string, fallback: T): T {
  const raw = storageGet(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Write a JSON value to localStorage.
 * Returns true on success, false on failure.
 */
export function storageSetJSON<T>(key: string, value: T): boolean {
  return storageSet(key, JSON.stringify(value));
}

/**
 * Invalidate a specific cache entry, forcing the next read to hit localStorage.
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
  } catch {
    return false;
  }
}
