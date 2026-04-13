import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportBmiHistory, validateBmiImport, importBmiHistory } from '../history-io';

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

    it('exports valid BMI records with SHA-256 checksum', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 },
        { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

      const result = await exportBmiHistory();
      expect(result).not.toBeNull();

      const parsed = JSON.parse(result!);
      expect(parsed.version).toBe(2);
      expect(parsed.source).toBe('bmi-calculator');
      expect(parsed.records).toHaveLength(2);
      expect(parsed.checksum).toHaveLength(64); // SHA-256 hex
      expect(parsed.exportedAt).toBeTruthy();
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

    it('rejects tampered data (bad checksum)', async () => {
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
      expect(result.error?.toLowerCase()).toContain('checksum');
    });

    it('accepts valid v2 export', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      const result = await validateBmiImport(exported!);
      expect(result.valid).toBe(true);
      expect(result.recordCount).toBe(1);
      expect(result.checksumVerified).toBe(true);
    });
  });

  describe('importBmiHistory', () => {
    it('rejects invalid data', async () => {
      const result = await importBmiHistory('bad');
      expect(result.success).toBe(false);
    });

    it('imports valid data and replaces existing', async () => {
      const records = [
        { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 },
        { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      const exported = await exportBmiHistory();

      const result = await importBmiHistory(exported!);
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.checksumVerified).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
});
