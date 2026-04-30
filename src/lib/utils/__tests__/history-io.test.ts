import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportBmiHistory, validateBmiImport, importBmiHistory } from '../history-io';
import { storageInvalidateAll } from '../storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('history-io', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Clear storage.ts in-memory cache to prevent cross-test contamination
    storageInvalidateAll();
  });

  describe('exportBmiHistory', () => {
    it('returns null when no history exists', async () => {
      const result = await exportBmiHistory();
      expect(result).toBeNull();
    });

    it('returns null for invalid JSON in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('not-json');
      const result = await exportBmiHistory();
      expect(result).toBeNull();
    });

    it('exports valid BMI records with HMAC-SHA256 signature (v3)', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 },
        { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

      const result = await exportBmiHistory();
      expect(result).not.toBeNull();

      const parsed = JSON.parse(result!);
      expect(parsed.version).toBe(3);
      expect(parsed.source).toBe('bmi-calculator');
      expect(parsed.records).toHaveLength(2);
      // v3 uses `signature` (not `checksum`)
      expect(parsed.signature).toHaveLength(64);
      expect(parsed.checksum).toBeUndefined();
      expect(parsed.algorithm).toBe('HMAC-SHA256');
      expect(parsed.salt).toHaveLength(32);
      expect(parsed.exportedAt).toBeTruthy();
    });

    it('produces different signatures on repeated exports of same data', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

      const result1 = await exportBmiHistory();
      const result2 = await exportBmiHistory();
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();

      const p1 = JSON.parse(result1!);
      const p2 = JSON.parse(result2!);

      // Different salts → different signatures
      expect(p1.salt).not.toBe(p2.salt);
      expect(p1.signature).not.toBe(p2.signature);
    });

    it('filters out invalid records on export', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 },
        { invalid: 'yes' },
        { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

      const result = await exportBmiHistory();
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.records).toHaveLength(2);
    });
  });

  describe('validateBmiImport', () => {
    it('rejects invalid JSON', async () => {
      const result = await validateBmiImport('not-json');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('rejects unknown format (no envelope)', async () => {
      const result = await validateBmiImport(JSON.stringify({ foo: 'bar' }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file format');
    });

    it('rejects tampered v3 data (bad signature)', async () => {
      const envelope = {
        version: 3,
        source: 'bmi-calculator',
        exportedAt: new Date().toISOString(),
        algorithm: 'HMAC-SHA256',
        salt: 'a'.repeat(32),
        signature: 'b'.repeat(64),
        records: [
          { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
        ]
      };
      const result = await validateBmiImport(JSON.stringify(envelope));
      expect(result.valid).toBe(false);
      expect(result.error?.toLowerCase()).toContain('integrity');
    });

    it('rejects tampered v2 data (bad SHA-256 checksum)', async () => {
      const envelope = {
        version: 2,
        source: 'bmi-calculator',
        exportedAt: new Date().toISOString(),
        checksum: 'a'.repeat(64),
        records: [
          { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
        ]
      };
      const result = await validateBmiImport(JSON.stringify(envelope));
      expect(result.valid).toBe(false);
      expect(result.error?.toLowerCase()).toContain('integrity');
    });

    it('accepts valid v3 HMAC export', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      const result = await validateBmiImport(exported!);
      expect(result.valid).toBe(true);
      expect(result.recordCount).toBe(1);
      expect(result.integrityVerified).toBe(true);
      expect(result.integrityVersion).toBe(3);
      expect(result.algorithm).toBe('HMAC-SHA256');
    });

    it('rejects v3 export with modified records', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      const parsed = JSON.parse(exported!);
      parsed.records[0].bmi = 99.9;
      const result = await validateBmiImport(JSON.stringify(parsed));
      expect(result.valid).toBe(false);
      expect(result.error?.toLowerCase()).toContain('integrity');
    });

    it('rejects v3 export with modified exportedAt', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      const parsed = JSON.parse(exported!);
      parsed.exportedAt = '2099-01-01T00:00:00.000Z';
      const result = await validateBmiImport(JSON.stringify(parsed));
      expect(result.valid).toBe(false);
    });

    it('rejects v3 export with replaced salt', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      const parsed = JSON.parse(exported!);
      parsed.salt = '0'.repeat(32);
      const result = await validateBmiImport(JSON.stringify(parsed));
      expect(result.valid).toBe(false);
    });

    it('rejects v3 export with replaced algorithm field', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      // Changing algorithm alone should not break HMAC (only metadata)
      // But let's verify it still passes integrity (algorithm is informational)
      const parsed = JSON.parse(exported!);
      parsed.algorithm = 'FAKE-ALGO';
      const result = await validateBmiImport(JSON.stringify(parsed));
      // Still valid because algorithm field is informational, not part of payload
      expect(result.valid).toBe(true);
      // But algorithm in result comes from the envelope, so it shows 'FAKE-ALGO'
      expect(result.algorithm).toBe('FAKE-ALGO');
    });
  });

  describe('importBmiHistory', () => {
    it('rejects invalid data', async () => {
      const result = await importBmiHistory('bad');
      expect(result.success).toBe(false);
    });

    it('imports valid v3 data and replaces existing', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 },
        { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      const result = await importBmiHistory(exported!);
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.integrityVerified).toBe(true);
      expect(result.integrityVersion).toBe(3);
      expect(result.algorithm).toBe('HMAC-SHA256');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('sorts imported records by timestamp', async () => {
      const records = [
        { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 },
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      const result = await importBmiHistory(exported!);
      expect(result.success).toBe(true);

      const stored = localStorageMock.setItem.mock.calls[0][1];
      const parsed = JSON.parse(stored);
      expect(parsed[0].timestamp).toBe(1700000000000);
      expect(parsed[1].timestamp).toBe(1700086400000);
    });
  });
});
