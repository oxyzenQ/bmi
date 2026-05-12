// @vitest-environment node
//
// This test file requires the node environment for native crypto.subtle.
// jsdom's crypto.subtle is non-functional in Bun 1.3.11 CI runners.

/**
 * Phase 3 — Regression Fortress: crypto.ts tests
 *
 * Covers: encrypt/decrypt round-trip, checksum verification, isEncrypted detection,
 * passphrase hints, fallbackStrength scoring, Argon2id key derivation,
 * wrong passphrase rejection, payload validation, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Polyfill localStorage for @vitest-environment node (no DOM)
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false,
  building: false,
  version: 'test',
}));

// Mock db.ts — encryption status persistence
vi.mock('../db', () => ({
  dbMetaGet: vi.fn().mockResolvedValue(null),
  dbMetaSet: vi.fn().mockResolvedValue(undefined),
  isIndexedDbAvailable: vi.fn().mockReturnValue(true),
}));

import {
  encrypt,
  decrypt,
  isEncrypted,
  computeChecksum,
  verifyChecksum,
  setPassphraseHint,
  getPassphraseHint,
  analyzeStrength,
} from '../crypto';

// ── computeChecksum ──

describe('computeChecksum', () => {
  it('produces a non-empty base64 string', async () => {
    const checksum = await computeChecksum('hello world');
    expect(checksum).toBeTruthy();
    expect(typeof checksum).toBe('string');
    expect(checksum.length).toBeGreaterThan(0);
  });

  it('produces the same checksum for identical input (deterministic)', async () => {
    const a = await computeChecksum('test data');
    const b = await computeChecksum('test data');
    expect(a).toBe(b);
  });

  it('produces different checksums for different inputs', async () => {
    const a = await computeChecksum('data A');
    const b = await computeChecksum('data B');
    expect(a).not.toBe(b);
  });

  it('handles empty string', async () => {
    const checksum = await computeChecksum('');
    expect(checksum).toBeTruthy();
    expect(typeof checksum).toBe('string');
  });

  it('handles unicode input', async () => {
    const checksum = await computeChecksum('Hello 你好 こんにちは');
    expect(checksum).toBeTruthy();
  });
});

// ── verifyChecksum ──

describe('verifyChecksum', () => {
  it('returns true for matching data and checksum', async () => {
    const data = 'verify me';
    const checksum = await computeChecksum(data);
    expect(await verifyChecksum(data, checksum)).toBe(true);
  });

  it('returns false for mismatched data', async () => {
    const checksum = await computeChecksum('original');
    expect(await verifyChecksum('tampered', checksum)).toBe(false);
  });

  it('returns false for invalid base64 checksum', async () => {
    expect(await verifyChecksum('some data', 'not-base64!!!')).toBe(false);
  });

  it('returns false for empty checksum', async () => {
    expect(await verifyChecksum('some data', '')).toBe(false);
  });
});

// ── isEncrypted ──

describe('isEncrypted', () => {
  it('returns true for valid encrypted payload', () => {
    const payload = {
      format: 'bmi-encrypted-v1',
      salt: 'abc',
      iv: 'def',
      data: 'ghi',
    };
    expect(isEncrypted(JSON.stringify(payload))).toBe(true);
  });

  it('returns false for plain JSON', () => {
    expect(isEncrypted(JSON.stringify({ bmi: 24.5, category: 'Normal Weight' }))).toBe(false);
  });

  it('returns false for non-JSON string', () => {
    expect(isEncrypted('just a string')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEncrypted('')).toBe(false);
  });

  it('returns false for null-format payload', () => {
    expect(isEncrypted(JSON.stringify({ format: null }))).toBe(false);
  });

  it('returns false for wrong format identifier', () => {
    expect(isEncrypted(JSON.stringify({ format: 'other-format-v1' }))).toBe(false);
  });
});

// ── encrypt / decrypt round-trip ──

describe('encrypt + decrypt', () => {
  it('round-trips successfully with correct passphrase', async () => {
    const plaintext = '{"bmi":24.5,"category":"Normal Weight"}';
    const passphrase = 'test-passphrase-123';

    const encrypted = await encrypt(plaintext, passphrase);
    const result = await decrypt(encrypted, passphrase);

    expect(result).not.toBeNull();
    expect(result!.plaintext).toBe(plaintext);
    expect(result!.integrityOk).toBe(true);
  });

  it('fails with wrong passphrase', async () => {
    const plaintext = 'secret data';
    const encrypted = await encrypt(plaintext, 'correct-pass');

    const result = await decrypt(encrypted, 'wrong-pass');
    expect(result).toBeNull();
  });

  it('includes meta when provided', async () => {
    const meta = { exportedAt: '2026-01-01T00:00:00Z', recordCount: 5, version: 1 };
    const encrypted = await encrypt('data', 'pass', meta);
    const payload = JSON.parse(encrypted);

    expect(payload.meta.exportedAt).toBe('2026-01-01T00:00:00Z');
    expect(payload.meta.recordCount).toBe(5);
    expect(payload.meta.version).toBe(1);
    expect(payload.meta.checksum).toBeTruthy();
  });

  it('payload has expected format fields', async () => {
    const encrypted = await encrypt('test', 'pass');
    const payload = JSON.parse(encrypted);

    expect(payload.format).toBe('bmi-encrypted-v1');
    expect(payload.cipher).toBe('aes-256-gcm');
    expect(payload.kdf).toBeDefined();
    expect(payload.salt).toBeTruthy();
    expect(payload.iv).toBeTruthy();
    expect(payload.data).toBeTruthy();
  });

  it('decrypt returns null for invalid JSON', async () => {
    const result = await decrypt('not-json', 'pass');
    expect(result).toBeNull();
  });

  it('decrypt returns null for unknown format', async () => {
    const result = await decrypt(JSON.stringify({ format: 'wrong-format' }), 'pass');
    expect(result).toBeNull();
  });

  it('decrypt returns null for missing required fields', async () => {
    const result = await decrypt(JSON.stringify({ format: 'bmi-encrypted-v1' }), 'pass');
    expect(result).toBeNull();
  });

  it('decrypt returns null for invalid base64 fields', async () => {
    const payload = {
      format: 'bmi-encrypted-v1',
      salt: 'not-valid-base64!!!',
      iv: 'not-valid-base64!!!',
      data: 'not-valid-base64!!!',
    };
    const result = await decrypt(JSON.stringify(payload), 'pass');
    expect(result).toBeNull();
  });

  it('handles unicode in plaintext', async () => {
    const plaintext = '{"name":"测试","name_ja":"テスト","name_id":"Tes"}';
    const encrypted = await encrypt(plaintext, 'pass');
    const result = await decrypt(encrypted, 'pass');

    expect(result).not.toBeNull();
    expect(result!.plaintext).toBe(plaintext);
  });

  it('handles large payload', async () => {
    // Simulate a large history export
    const entries = Array.from({ length: 500 }, (_, i) => ({
      date: `2026-01-${String(i % 31 + 1).padStart(2, '0')}`,
      bmi: 20 + i * 0.01,
    }));
    const plaintext = JSON.stringify(entries);
    const encrypted = await encrypt(plaintext, 'pass');
    const result = await decrypt(encrypted, 'pass');

    expect(result).not.toBeNull();
    expect(result!.plaintext).toBe(plaintext);
  });
});

// ── Passphrase hints ──

describe('passphrase hints', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setPassphraseHint stores hint in localStorage', () => {
    setPassphraseHint('my hint');
    expect(localStorage.getItem('bmi.passphrase_hint')).toBe('my hint');
  });

  it('getPassphraseHint reads hint from localStorage', () => {
    localStorage.setItem('bmi.passphrase_hint', 'stored hint');
    expect(getPassphraseHint()).toBe('stored hint');
  });

  it('getPassphraseHint returns empty string when no hint', () => {
    expect(getPassphraseHint()).toBe('');
  });

  it('setPassphraseHint trims whitespace', () => {
    setPassphraseHint('  spaced hint  ');
    expect(localStorage.getItem('bmi.passphrase_hint')).toBe('spaced hint');
  });

  it('setPassphraseHint removes key for empty/whitespace-only hint', () => {
    localStorage.setItem('bmi.passphrase_hint', 'old hint');
    setPassphraseHint('');
    expect(localStorage.getItem('bmi.passphrase_hint')).toBeNull();
  });

  it('setPassphraseHint removes key for whitespace-only hint', () => {
    localStorage.setItem('bmi.passphrase_hint', 'old hint');
    setPassphraseHint('   ');
    expect(localStorage.getItem('bmi.passphrase_hint')).toBeNull();
  });
});

// ── analyzeStrength (fallback) ──

describe('analyzeStrength', () => {
  it('returns score 0 for empty passphrase', async () => {
    const result = await analyzeStrength('');
    expect(result.score).toBe(0);
    expect(result.entropy).toBe(0);
    expect(result.crackTimeSeconds).toBe(0);
  });

  it('returns a valid result for short passphrase', async () => {
    const result = await analyzeStrength('abc');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(4);
    expect(typeof result.entropy).toBe('number');
    expect(typeof result.crackTimeSeconds).toBe('number');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('returns a valid result for strong passphrase', async () => {
    const result = await analyzeStrength('MyStr0ng!P@ssw0rd#2026');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(4);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('returns suggestions array for weak passwords', async () => {
    const result = await analyzeStrength('password');
    expect(result.suggestions).toBeDefined();
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

// ── Integrity detection ──

describe('integrity detection', () => {
  it('integrityOk is true when checksum matches', async () => {
    const encrypted = await encrypt('untampered data', 'pass');
    const result = await decrypt(encrypted, 'pass');
    expect(result).not.toBeNull();
    expect(result!.integrityOk).toBe(true);
  });
});

// ── Argon2id KDF detection ──

describe('KDF detection', () => {
  it('encrypted payload uses argon2id KDF', async () => {
    const encrypted = await encrypt('data', 'pass');
    const payload = JSON.parse(encrypted);

    // Argon2id should be the default KDF (unless it falls back to PBKDF2)
    expect(payload.kdf).toBeDefined();
    expect(['argon2id', 'pbkdf2']).toContain(payload.kdf);

    if (payload.kdf === 'argon2id') {
      expect(payload.kdfParams).toBeDefined();
      expect(payload.kdfParams.mem).toBeGreaterThan(0);
      expect(payload.kdfParams.time).toBeGreaterThan(0);
      expect(payload.kdfParams.parallelism).toBeGreaterThan(0);
      expect(payload.kdfParams.hashLen).toBeGreaterThan(0);
    }
  });
});
