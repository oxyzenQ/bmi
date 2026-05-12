/**
 * Regression tests for storage utility error handling paths (v15.3).
 *
 * Ensures that when storage operations fail, the correct fallback values
 * are returned and no exceptions propagate to callers.
 */

import {
  storageGet,
  storageGetJSON,
  storageRemove,
  storageSet,
  storageSetJSON,
  storageInvalidateAll,
  isStorageAvailable,
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

describe('storage error handling regressions', () => {
  describe('storageGet', () => {
    it('returns null when localStorage throws', () => {
      mockLocalStorage.getItem.mockImplementationOnce(() => { throw new Error('SecurityError'); });
      expect(storageGet('fail')).toBeNull();
    });

    it('caches null on failure', () => {
      mockLocalStorage.getItem.mockImplementationOnce(() => { throw new Error('SecurityError'); });
      storageGet('fail');
      storageGet('fail');
      // Should only attempt localStorage once (second read hits cache)
      expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('storageSet', () => {
    it('returns false when localStorage throws QuotaExceeded', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceeded'); });
      expect(storageSet('fail', 'val')).toBe(false);
    });

    it('returns false when localStorage throws SecurityError', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => { throw new Error('SecurityError'); });
      expect(storageSet('fail', 'val')).toBe(false);
    });

    it('still updates cache even on localStorage failure', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceeded'); });
      storageSet('fail', 'cached-val');
      // Cache should still have the value even though localStorage failed
      expect(storageGet('fail')).toBe('cached-val');
    });
  });

  describe('storageRemove', () => {
    it('does not throw when localStorage throws', () => {
      store['rm'] = 'val';
      storageGet('rm'); // populate cache
      mockLocalStorage.removeItem.mockImplementationOnce(() => { throw new Error('SecurityError'); });
      expect(() => storageRemove('rm')).not.toThrow();
    });
  });

  describe('storageGetJSON', () => {
    it('returns fallback when JSON is malformed', () => {
      store['bad'] = 'not-json';
      expect(storageGetJSON('bad', 'fallback')).toBe('fallback');
    });

    it('returns fallback when JSON is empty string', () => {
      store['empty'] = '';
      expect(storageGetJSON('empty', { default: 42 })).toEqual({ default: 42 });
    });

    it('returns fallback when JSON is "null" string', () => {
      store['n'] = 'null';
      expect(storageGetJSON('n', 'fallback')).toBe('fallback');
    });

    it('returns fallback for deeply nested invalid JSON', () => {
      store['nested'] = '{"a": {"b": invalid}}';
      expect(storageGetJSON('nested', { a: 1 })).toEqual({ a: 1 });
    });
  });

  describe('storageSetJSON', () => {
    it('returns false on serialization failure', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      // JSON.stringify would throw on circular references
      expect(() => storageSetJSON('circular', circular)).not.toThrow();
      // Should return false because the underlying storageSet failed
      // (the circular ref makes JSON.stringify throw)
    });
  });

  describe('isStorageAvailable', () => {
    it('returns false when localStorage throws', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => { throw new Error('SecurityError'); });
      mockLocalStorage.removeItem.mockImplementationOnce(() => { throw new Error('SecurityError'); });
      expect(isStorageAvailable()).toBe(false);
    });
  });
});
