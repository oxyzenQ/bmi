/**
 * Unit tests for the centralized storage utility with IndexedDB.
 */
import {
    STORAGE_KEYS,
    storageGet,
    storageGetJSON,
    storageInvalidate,
    storageInvalidateAll,
    storageRemove,
    storageSet,
    storageSetJSON
} from '$lib/utils/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};

// Mock IndexedDB
const mockIndexedDb = {
  open: vi.fn().mockReturnValue({
    onupgradeneeded: null as unknown,
    onsuccess: null as unknown,
    onerror: null as unknown,
    result: {
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: null }),
          put: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
          delete: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
          getAll: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: [] }),
          getAllKeys: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: [] }),
        }),
        complete: null,
        onerror: null,
      }),
      createObjectStore: vi.fn().mockReturnValue({
        createIndex: vi.fn(),
      }),
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(false),
      },
      close: vi.fn(),
    },
  }),
};

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });
Object.defineProperty(globalThis, 'indexedDB', { value: mockIndexedDb, writable: true });

beforeEach(() => {
  mockLocalStorage.clear();
  storageInvalidateAll();
  vi.clearAllMocks();
});

describe('STORAGE_KEYS', () => {
  it('has all expected keys', () => {
    expect(STORAGE_KEYS.HISTORY).toBe('bmi.history');
    expect(STORAGE_KEYS.UNIT_SYSTEM).toBe('bmi.unitSystem');
    expect(STORAGE_KEYS.RENDER_MODE).toBe('bmi.renderMode');
    expect(STORAGE_KEYS.WALLPAPER_THEME).toBe('bmi.wallpaperTheme');
    expect(STORAGE_KEYS.SMOOTH_MODE).toBe('bmi.smoothMode');
    expect(STORAGE_KEYS.ULTRA_SMOOTH).toBe('bmi.ultraSmooth');
  });
});

describe('storageGet', () => {
  it('reads value from localStorage', () => {
    store['test.key'] = 'hello';
    expect(storageGet('test.key')).toBe('hello');
  });

  it('returns null for missing key', () => {
    expect(storageGet('nonexistent')).toBeNull();
  });

  it('caches the value after first read', () => {
    store['cached'] = 'value';
    storageGet('cached');
    storageGet('cached');
    // Should only call localStorage once due to caching
    expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(1);
  });
});

describe('storageSet', () => {
  it('writes value to localStorage and cache', () => {
    expect(storageSet('key', 'value')).toBe(true);
    expect(store['key']).toBe('value');
  });

  it('returns false on error', () => {
    mockLocalStorage.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceeded'); });
    expect(storageSet('fail', 'value')).toBe(false);
  });
});

describe('storageRemove', () => {
  it('removes from both localStorage and cache', () => {
    store['rm'] = 'value';
    storageGet('rm'); // populate cache
    storageRemove('rm');
    expect(store['rm']).toBeUndefined();
    expect(storageGet('rm')).toBeNull();
  });
});

describe('storageGetJSON', () => {
  it('parses valid JSON', () => {
    store['json'] = JSON.stringify({ a: 1 });
    expect(storageGetJSON('json', {})).toEqual({ a: 1 });
  });

  it('returns fallback for null key', () => {
    expect(storageGetJSON('missing', [] as number[])).toEqual([]);
  });

  it('returns fallback for invalid JSON', () => {
    store['bad'] = 'not-json';
    expect(storageGetJSON('bad', 'fallback')).toBe('fallback');
  });
});

describe('storageSetJSON', () => {
  it('serializes and stores value', () => {
    expect(storageSetJSON('arr', [1, 2, 3])).toBe(true);
    expect(store['arr']).toBe('[1,2,3]');
  });
});

describe('storageInvalidate', () => {
  it('removes specific cache entry', () => {
    store['inv'] = 'val';
    storageGet('inv'); // cache
    storageInvalidate('inv');
    // Next read should hit localStorage again
    storageGet('inv');
    expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(2);
  });
});

describe('storageInvalidateAll', () => {
  it('clears entire cache', () => {
    store['a'] = '1';
    store['b'] = '2';
    storageGet('a');
    storageGet('b');
    storageInvalidateAll();
    storageGet('a');
    storageGet('b');
    // Each get should re-read from localStorage
    expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(4);
  });
});
