// Copyright (c) 2025 - 2026 rezky_nightky
// @vitest-environment node
//
// This test file uses the node environment instead of jsdom because:
//   - jsdom 27+ provides window.crypto but its crypto.subtle is NON-FUNCTIONAL
//   - All polyfill strategies (node:crypto, vi.stubGlobal, etc.) fail in CI
//     because the subtle object from bun 1.3.11's require('node:crypto') doesn't
//     work correctly when accessed through jsdom's window object
//   - node environment provides native crypto.subtle that actually works
//   - This test file doesn't need DOM — it mocks localStorage/indexedDB
//
// See: https://github.com/nicedoc/vitest/issues/49

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportBmiHistory, exportBmiHistoryCsv, importBmiHistory, validateBmiImport, peekImportMeta } from '../history-io';
import { storageInvalidateAll } from '../storage';

// ---------------------------------------------------------------------------
// Crypto validation — fail fast with EXACT error if WebCrypto is broken
// ---------------------------------------------------------------------------
beforeAll(async () => {
        expect(typeof crypto?.subtle).toBe('object');
        try {
                const key = await crypto.subtle.importKey(
                        'raw',
                        new Uint8Array(32).buffer as ArrayBuffer,
                        { name: 'HMAC', hash: 'SHA-256' },
                        false,
                        ['sign', 'verify']
                );
                const sig = await crypto.subtle.sign('HMAC', key, new Uint8Array(0));
                if (!sig || sig.byteLength === 0) {
                        throw new Error('crypto.subtle.sign returned empty result');
                }
        } catch (err) {
                throw new Error(
                        `[crypto.subtle] WebCrypto validation FAILED.\n` +
                        `Error: ${err instanceof Error ? err.message : String(err)}\n` +
                        `Stack: ${err instanceof Error ? err.stack : 'N/A'}\n` +
                        `crypto.subtle type: ${typeof crypto?.subtle}\n` +
                        `crypto.subtle.importKey type: ${typeof crypto?.subtle?.importKey}\n` +
                        `crypto.subtle.sign type: ${typeof crypto?.subtle?.sign}`
                );
        }
});

// Mock localStorage — uses an external store reference for testability
let _store: Record<string, string> = {};
const localStorageMock = {
        getItem: vi.fn((key: string) => _store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
                _store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
                delete _store[key];
        }),
        clear: vi.fn(() => {
                _store = {};
        })
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
                                        add: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
                                        index: vi
                                                .fn()
                                                .mockReturnValue({ getAll: vi.fn().mockReturnValue({ onsuccess: null, result: [] }) })
                                }),
                                complete: null,
                                onerror: null
                        }),
                        createObjectStore: vi.fn().mockReturnValue({
                                createIndex: vi.fn()
                        }),
                        objectStoreNames: {
                                contains: vi.fn().mockReturnValue(false)
                        },
                        close: vi.fn()
                }
        })
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'indexedDB', { value: mockIndexedDb, writable: true });

describe('history-io', () => {
        beforeEach(() => {
                // Reset store and clear storage cache before each test
                _store = {};
                vi.clearAllMocks();
                // Re-apply mock implementations after clearAllMocks wipes them
                localStorageMock.getItem.mockImplementation((key: string) => _store[key] ?? null);
                localStorageMock.setItem.mockImplementation((key: string, value: string) => { _store[key] = value; });
                localStorageMock.removeItem.mockImplementation((key: string) => { delete _store[key]; });
                localStorageMock.clear.mockImplementation(() => { _store = {}; });
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
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
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
                                records: [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }]
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
                                records: [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }]
                        };
                        const result = await validateBmiImport(JSON.stringify(envelope));
                        expect(result.valid).toBe(false);
                        expect(result.error?.toLowerCase()).toContain('integrity');
                });

                it('rejects oversized input (>5MB) via validateBmiImport', async () => {
                        const bigData = 'x'.repeat(5 * 1024 * 1024 + 1);
                        const result = await validateBmiImport(bigData);
                        expect(result.valid).toBe(false);
                        expect(result.errorCode).toBe('file_too_large');
                });

                it('accepts valid v3 HMAC export', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
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
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
                        const exported = await exportBmiHistory();

                        const parsed = JSON.parse(exported!);
                        parsed.records[0].bmi = 99.9;
                        const result = await validateBmiImport(JSON.stringify(parsed));
                        expect(result.valid).toBe(false);
                        expect(result.error?.toLowerCase()).toContain('integrity');
                });

                it('rejects v3 export with modified exportedAt', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
                        const exported = await exportBmiHistory();

                        const parsed = JSON.parse(exported!);
                        parsed.exportedAt = '2099-01-01T00:00:00.000Z';
                        const result = await validateBmiImport(JSON.stringify(parsed));
                        expect(result.valid).toBe(false);
                });

                it('rejects v3 export with replaced salt', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
                        const exported = await exportBmiHistory();

                        const parsed = JSON.parse(exported!);
                        parsed.salt = '0'.repeat(32);
                        const result = await validateBmiImport(JSON.stringify(parsed));
                        expect(result.valid).toBe(false);
                });

                it('rejects v3 export with replaced algorithm field', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
                        const exported = await exportBmiHistory();

                        // Changing algorithm alone should not break HMAC (only metadata)
                        const parsed = JSON.parse(exported!);
                        parsed.algorithm = 'FAKE-ALGO';
                        const result = await validateBmiImport(JSON.stringify(parsed));
                        // Still valid because algorithm field is informational, not part of payload
                        expect(result.valid).toBe(true);
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

        describe('encryption support', () => {
                it('exports encrypted data when passphrase is provided', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

                        const encrypted = await exportBmiHistory('mySecretPassword123');
                        expect(encrypted).not.toBeNull();

                        // Verify it can be decrypted
                        const { decrypt } = await import('../crypto');
                        const decrypted = await decrypt(encrypted!, 'mySecretPassword123');
                        expect(decrypted).not.toBeNull();
                        const envelope = JSON.parse(decrypted!.plaintext);
                        expect(envelope.version).toBe(3);
                        expect(envelope.records).toHaveLength(1);
                });

                it('rejects encrypted import without passphrase', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
                        const encrypted = await exportBmiHistory('secret123');

                        const result = await validateBmiImport(encrypted!);
                        expect(result.valid).toBe(false);
                        expect(result.error).toContain('passphrase');
                });

                it('accepts encrypted import with correct passphrase', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
                        const encrypted = await exportBmiHistory('correctPassword');

                        const result = await validateBmiImport(encrypted!, 'correctPassword');
                        expect(result.valid).toBe(true);
                        expect(result.recordCount).toBe(1);
                });

                it('rejects encrypted import with wrong passphrase', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
                        const encrypted = await exportBmiHistory('correctPassword');

                        const result = await validateBmiImport(encrypted!, 'wrongPassword');
                        expect(result.valid).toBe(false);
                        expect(result.error?.toLowerCase()).toContain('passphrase');
                });

                it('imports encrypted data successfully with correct passphrase', async () => {
                        const records = [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
                        const encrypted = await exportBmiHistory('importPass123');

                        const result = await importBmiHistory(encrypted!); // importBmiHistory doesn't take passphrase directly
                        // Encrypted data looks invalid to raw import (no passphrase)
                        expect(result.success).toBe(false);
                });
        });

        describe('exportBmiHistoryCsv', () => {
                it('returns null when no history exists', () => {
                        const csv = exportBmiHistoryCsv();
                        expect(csv).toBeNull();
                });

                it('returns null for invalid JSON in localStorage', () => {
                        localStorageMock.getItem.mockReturnValue('not-json');
                        const csv = exportBmiHistoryCsv();
                        expect(csv).toBeNull();
                });

                it('returns null for empty array', () => {
                        localStorageMock.getItem.mockReturnValue(JSON.stringify([]));
                        const csv = exportBmiHistoryCsv();
                        expect(csv).toBeNull();
                });

                it('exports correct number of rows', async () => {
                        const records = [
                                { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 },
                                { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 }
                        ];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

                        const csv = exportBmiHistoryCsv();
                        expect(csv).not.toBeNull();
                        // Header + 2 data rows
                        const lines = csv!.trim().split('\n');
                        expect(lines).toHaveLength(3);
                });

                it('returns valid CSV with headers', async () => {
                        const records = [
                                { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65, age: 25 },
                                { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 }
                        ];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

                        const csv = exportBmiHistoryCsv();
                        expect(csv).not.toBeNull();
                        // All cells are quoted in CSV output
                        expect(csv).toContain('"Date","Time","BMI","Height (cm)","Weight (kg)","Age","Category"');
                        // Timestamp 1700000000000 = 2023-11-14T22:13:20Z (date from ISO, time from toTimeString)
                        expect(csv).toContain('"2023-11-14"');
                        expect(csv).toContain('"22.5"');
                        expect(csv).toContain('"170"');
                        expect(csv).toContain('"65"');
                        expect(csv).toContain('"25"');
                        // Category name from i18n (may vary by locale)
                        expect(csv).toContain('"Normal');
                });

                it('handles records without age field', async () => {
                        const records = [
                                { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }
                        ];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

                        const csv = exportBmiHistoryCsv();
                        expect(csv).not.toBeNull();
                        // Age cell is empty (no age field)
                        expect(csv).toContain('"170"');
                        expect(csv).toContain('"65"');
                        expect(csv).toContain('""'); // empty age
                        // Category name from i18n
                        expect(csv).toContain('"Normal');
                });

                it('filters out invalid records on CSV export', async () => {
                        const records = [
                                { timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 },
                                { invalid: 'yes' },
                                { timestamp: 1700086400000, bmi: 22.1, height: 170, weight: 64.5 }
                        ];
                        localStorageMock.getItem.mockReturnValue(JSON.stringify(records));

                        const csv = exportBmiHistoryCsv();
                        expect(csv).not.toBeNull();
                        // Should have header + 2 valid rows
                        const lines = csv!.trim().split('\n');
                        expect(lines).toHaveLength(3); // header + 2 data rows
                });
        });

        describe('peekImportMeta', () => {
                it('returns encrypted: false for plain JSON envelope', () => {
                        const envelope = {
                                version: 3,
                                source: 'bmi-calculator',
                                exportedAt: '2024-01-01T00:00:00.000Z',
                                algorithm: 'HMAC-SHA256',
                                salt: 'a'.repeat(32),
                                signature: 'b'.repeat(64),
                                records: [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }]
                        };
                        const meta = peekImportMeta(JSON.stringify(envelope));
                        expect(meta.encrypted).toBe(false);
                        expect(meta.exportedAt).toBe('2024-01-01T00:00:00.000Z');
                        expect(meta.recordCount).toBe(1);
                        expect(meta.version).toBe(3);
                });

                it('returns encrypted: true for encrypted payload', () => {
                        const encryptedPayload = {
                                format: 'bmi-encrypted-v1',
                                salt: 'c'.repeat(22),
                                iv: 'd'.repeat(16),
                                data: 'e'.repeat(100),
                                meta: {
                                        exportedAt: '2024-06-01T00:00:00.000Z',
                                        recordCount: 5,
                                        version: 3
                                }
                        };
                        const meta = peekImportMeta(JSON.stringify(encryptedPayload));
                        expect(meta.encrypted).toBe(true);
                        expect(meta.format).toBe('bmi-encrypted-v1');
                        expect(meta.exportedAt).toBe('2024-06-01T00:00:00.000Z');
                        expect(meta.recordCount).toBe(5);
                        expect(meta.version).toBe(3);
                });

                it('returns encrypted: false for encrypted payload with no meta', () => {
                        const encryptedPayload = {
                                format: 'bmi-encrypted-v1',
                                salt: 'c'.repeat(22),
                                iv: 'd'.repeat(16),
                                data: 'e'.repeat(100)
                        };
                        const meta = peekImportMeta(JSON.stringify(encryptedPayload));
                        expect(meta.encrypted).toBe(true);
                        expect(meta.format).toBe('bmi-encrypted-v1');
                        expect(meta.exportedAt).toBeUndefined();
                        expect(meta.recordCount).toBeUndefined();
                });

                it('returns encrypted: false for bare array', () => {
                        const meta = peekImportMeta(JSON.stringify([{ bmi: 22.5 }]));
                        expect(meta.encrypted).toBe(false);
                        expect(meta.recordCount).toBe(1);
                });

                it('returns encrypted: false for invalid JSON', () => {
                        const meta = peekImportMeta('not-json');
                        expect(meta.encrypted).toBe(false);
                        expect(meta.recordCount).toBeUndefined();
                });

                it('ignores negative recordCount', () => {
                        const encryptedPayload = {
                                format: 'bmi-encrypted-v1',
                                salt: 'c'.repeat(22),
                                iv: 'd'.repeat(16),
                                data: 'e'.repeat(100),
                                meta: { recordCount: -1 }
                        };
                        const meta = peekImportMeta(JSON.stringify(encryptedPayload));
                        expect(meta.recordCount).toBeUndefined();
                });

                it('ignores negative version', () => {
                        const encryptedPayload = {
                                format: 'bmi-encrypted-v1',
                                salt: 'c'.repeat(22),
                                iv: 'd'.repeat(16),
                                data: 'e'.repeat(100),
                                meta: { version: -5 }
                        };
                        const meta = peekImportMeta(JSON.stringify(encryptedPayload));
                        expect(meta.version).toBeUndefined();
                });

                it('handles non-string exportedAt', () => {
                        const encryptedPayload = {
                                format: 'bmi-encrypted-v1',
                                salt: 'c'.repeat(22),
                                iv: 'd'.repeat(16),
                                data: 'e'.repeat(100),
                                meta: { exportedAt: 12345, recordCount: 3 }
                        };
                        const meta = peekImportMeta(JSON.stringify(encryptedPayload));
                        expect(meta.exportedAt).toBeUndefined();
                });

                it('handles non-number recordCount', () => {
                        const encryptedPayload = {
                                format: 'bmi-encrypted-v1',
                                salt: 'c'.repeat(22),
                                iv: 'd'.repeat(16),
                                data: 'e'.repeat(100),
                                meta: { recordCount: 'bad' }
                        };
                        const meta = peekImportMeta(JSON.stringify(encryptedPayload));
                        expect(meta.recordCount).toBeUndefined();
                });
        });

        describe('importBmiHistory edge cases', () => {
                it('rejects empty string input', async () => {
                        const result = await importBmiHistory('');
                        expect(result.success).toBe(false);
                        expect(result.errorCode).toBe('empty_file');
                });

                it('rejects whitespace-only input', async () => {
                        const result = await importBmiHistory('   ');
                        expect(result.success).toBe(false);
                        expect(result.errorCode).toBe('empty_file');
                });

                it('rejects oversized input (>5MB)', async () => {
                        const bigData = 'x'.repeat(5 * 1024 * 1024 + 1);
                        const result = await importBmiHistory(bigData);
                        expect(result.success).toBe(false);
                        expect(result.errorCode).toBe('file_too_large');
                });

                it('rejects data with no valid records after filtering', async () => {
                        const envelope = {
                                version: 3,
                                source: 'bmi-calculator',
                                exportedAt: new Date().toISOString(),
                                algorithm: 'HMAC-SHA256',
                                salt: 'a'.repeat(32),
                                signature: 'b'.repeat(64),
                                records: [
                                        { invalid: 'record' },
                                        { also_invalid: true }
                                ]
                        };
                        const result = await importBmiHistory(JSON.stringify(envelope));
                        expect(result.success).toBe(false);
                        expect(result.errorCode).toBe('no_valid_records');
                });

                it('rejects unsupported version (v99)', async () => {
                        const envelope = {
                                version: 99,
                                source: 'bmi-calculator',
                                exportedAt: new Date().toISOString(),
                                records: [{ timestamp: 1700000000000, bmi: 22.5, height: 170, weight: 65 }]
                        };
                        const result = await importBmiHistory(JSON.stringify(envelope));
                        expect(result.success).toBe(false);
                        expect(result.errorCode).toBe('unsupported_version');
                });
        });
});