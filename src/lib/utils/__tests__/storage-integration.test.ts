// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Phase 3 — Regression Fortress: storage.ts integration tests
 *
 * Covers: storageGet, storageSet, storageRemove, storageGetJSON, storageSetJSON,
 * storageInvalidate, isStorageAvailable, isStorageInitialized.
 * Tests corruption recovery and cache behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false,
  building: false,
  version: 'test',
}));

// Mock db.ts
vi.mock('../db', () => ({
  isIndexedDbAvailable: vi.fn().mockReturnValue(false),
  dbGetAll: vi.fn().mockResolvedValue([]),
  dbSet: vi.fn().mockResolvedValue(undefined),
  dbRemove: vi.fn().mockResolvedValue(undefined),
  dbMetaGet: vi.fn().mockResolvedValue(null),
  dbMetaSet: vi.fn().mockResolvedValue(undefined),
}));

// Mock warn-dev
vi.mock('../warn-dev', () => ({
  warnDev: vi.fn(),
  warnDevOnce: vi.fn(),
}));

import {
  storageGet,
  storageSet,
  storageRemove,
  storageGetJSON,
  storageSetJSON,
  storageInvalidate,
  storageInvalidateAll,
  isStorageAvailable,
  isStorageInitialized,
  STORAGE_KEYS,
} from '../storage';

beforeEach(() => {
  localStorage.clear();
  // Reset storage initialization state
  storageInvalidateAll();
});

// ── STORAGE_KEYS ──

describe('STORAGE_KEYS', () => {
  it('has all required keys', () => {
    expect(STORAGE_KEYS.HISTORY).toBe('bmi.history');
    expect(STORAGE_KEYS.UNIT_SYSTEM).toBe('bmi.unitSystem');
    expect(STORAGE_KEYS.LOCALE).toBe('bmi.locale');
    expect(STORAGE_KEYS.BMI_GOAL).toBe('bmi.goal');
    expect(STORAGE_KEYS.BMI_GOAL_START).toBe('bmi.goal.start');
  });

  it('all keys start with bmi.', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key).toMatch(/^bmi\./);
    }
  });

  it('has unique values', () => {
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ── storageGet / storageSet ──

describe('storageGet / storageSet', () => {
  it('stores and retrieves a value', () => {
    storageSet('test.key', 'hello');
    expect(storageGet('test.key')).toBe('hello');
  });

  it('returns null for missing key', () => {
    expect(storageGet('nonexistent.key')).toBeNull();
  });

  it('overwrites existing value', () => {
    storageSet('test.key', 'first');
    storageSet('test.key', 'second');
    expect(storageGet('test.key')).toBe('second');
  });

  it('stores empty string', () => {
    storageSet('test.key', '');
    expect(storageGet('test.key')).toBe('');
  });

  it('returns true on successful write', () => {
    expect(storageSet('test.key', 'value')).toBe(true);
  });

  it('stores JSON strings as plain strings', () => {
    const data = JSON.stringify({ bmi: 24.5 });
    storageSet('test.key', data);
    expect(storageGet('test.key')).toBe(data);
  });
});

// ── storageRemove ──

describe('storageRemove', () => {
  it('removes a stored value', () => {
    storageSet('test.key', 'value');
    storageRemove('test.key');
    expect(storageGet('test.key')).toBeNull();
  });

  it('does not throw for nonexistent key', () => {
    expect(() => storageRemove('nonexistent.key')).not.toThrow();
  });
});

// ── storageGetJSON / storageSetJSON ──

describe('storageGetJSON / storageSetJSON', () => {
  it('stores and retrieves JSON object', () => {
    const data = { bmi: 24.5, category: 'Normal Weight' };
    storageSetJSON('test.key', data);
    expect(storageGetJSON('test.key', null)).toEqual(data);
  });

  it('stores and retrieves JSON array', () => {
    const data = [{ date: '2026-01-01', bmi: 22.5 }];
    storageSetJSON('test.key', data);
    expect(storageGetJSON('test.key', [])).toEqual(data);
  });

  it('returns fallback for missing key', () => {
    expect(storageGetJSON('nonexistent.key', 'fallback')).toBe('fallback');
  });

  it('returns fallback for invalid JSON', () => {
    storageSet('test.key', 'not-json');
    expect(storageGetJSON('test.key', 'fallback')).toBe('fallback');
  });

  it('returns fallback when stored value is null', () => {
    storageSet('test.key', 'null'); // JSON string "null"
    // JSON.parse('null') returns JS null, which is treated as missing
    expect(storageGetJSON('test.key', 'fallback')).toBe('fallback');
  });

  it('returns true on successful JSON write', () => {
    expect(storageSetJSON('test.key', { test: true })).toBe(true);
  });
});

// ── storageInvalidate / storageInvalidateAll ──

describe('storageInvalidate', () => {
  it('invalidates a specific cache entry', () => {
    storageSet('test.key', 'cached');
    storageInvalidate('test.key');
    // After invalidation, it reads from localStorage which still has the value
    expect(storageGet('test.key')).toBe('cached');
  });

  it('storageInvalidateAll clears all cache entries', () => {
    storageSet('test.a', 'value-a');
    storageSet('test.b', 'value-b');
    storageInvalidateAll();
    // Should still read from localStorage after cache clear
    expect(storageGet('test.a')).toBe('value-a');
    expect(storageGet('test.b')).toBe('value-b');
  });
});

// ── isStorageAvailable ──

describe('isStorageAvailable', () => {
  it('returns true when localStorage is available', () => {
    expect(isStorageAvailable()).toBe(true);
  });
});

// ── isStorageInitialized ──

describe('isStorageInitialized', () => {
  it('returns boolean', () => {
    expect(typeof isStorageInitialized()).toBe('boolean');
  });
});

// ── Storage edge cases ──

describe('storage edge cases', () => {
  it('handles special characters in keys', () => {
    storageSet('bmi.special-test_key.123', 'value');
    expect(storageGet('bmi.special-test_key.123')).toBe('value');
  });

  it('handles unicode in values', () => {
    storageSet('test.key', 'Hello 你好 こんにちは');
    expect(storageGet('test.key')).toBe('Hello 你好 こんにちは');
  });

  it('handles very long values', () => {
    const longValue = 'x'.repeat(10000);
    storageSet('test.key', longValue);
    expect(storageGet('test.key')).toBe(longValue);
  });
});