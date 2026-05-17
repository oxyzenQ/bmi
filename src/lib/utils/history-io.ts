// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * BMI History Export/Import utilities with HMAC-SHA256 integrity check.
 *
 * Export wraps records in a versioned envelope signed with HMAC-SHA256.
 * The signature helps detect accidental corruption and casual tampering.
 * A per-export random salt is mixed into the MAC computation so that even
 * identical records produce different signatures every time.
 *
 * The HMAC secret is split into two fragments and XOR-assembled at runtime
 * to raise the effort required for casual extraction from the JS bundle.
 * This is obfuscation, not true protection — a determined attacker with
 * JS inspection can still recover the key. For the BMI calculator use-case
 * this trade-off is acceptable: it provides checksum/signature-based
 * detection of accidental corruption and casual tampering while keeping
 * the system fully client-side.
 *
 * Envelope format:
 *   v0 (checksum 8-ch)  — FNV-1a 32-bit on records only        [legacy import only]
 *   v1 (checksum 16-ch) — FNV-1a+DJB2 64-bit on envelope       [legacy import only]
 *   v2 (checksum 64-ch) — SHA-256 256-bit on envelope           [legacy import only]
 *   v3 (signature 64-ch)— HMAC-SHA256 + salt + algorithm field  [current export]
 *
 * All four formats are accepted on import for backward compatibility.
 *
 * NOTE: All localStorage reads/writes go through the centralized storage.ts
 * module to ensure the in-memory cache stays consistent across the app.
 */

import { t } from '$lib/i18n';
import {
    STORAGE_KEYS,
    storageGet,
    storageSet
} from './storage';
import { warnDev } from './warn-dev';

// ---------------------------------------------------------------------------
// Import error codes — structured, specific, no silent failures
// ---------------------------------------------------------------------------

export type ImportError =
    | 'empty_file'
    | 'file_too_large'
    | 'invalid_json'
    | 'invalid_format'
    | 'unsupported_version'
    | 'encrypted_no_passphrase'
    | 'wrong_passphrase'
    | 'corrupted_file'
    | 'no_valid_records'
    | 'integrity_failed'
    | 'save_failed';

/** Max allowed import file size (5 MB) */
export const MAX_IMPORT_SIZE = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BmiRecord {
        timestamp: number;
        bmi: number;
        height: number;
        weight: number;
        age?: number;
}

/** Shape of the exported JSON file.
 *  v0–v2 use `checksum`; v3 uses `signature` + `algorithm` + `salt`.
 *  Legacy fields (`checksum`) are still read on import for backward compat.
 */
interface ExportedEnvelope {
        version: number;
        source: string;
        exportedAt: string;
        /** v0–v2 only: hash/checksum string */
        checksum?: string;
        /** v3: HMAC-SHA256 hex signature */
        signature?: string;
        /** v3: algorithm identifier (e.g. "HMAC-SHA256") */
        algorithm?: string;
        /** v3: random 32-char hex nonce */
        salt?: string;
        records: BmiRecord[];
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 — primary integrity mechanism (v3+)
// ---------------------------------------------------------------------------
//
// Secret key is split into two base64 fragments and XOR-assembled at runtime.
// Neither fragment alone is the real key. This is obfuscation, not security —
// the assembled key still exists in memory at runtime.

const _FRAG_A = 'MEKV+5tbi5OA8YWGUdNl3FTLQ0tw1SyStvC1tnRvQkE=';
const _FRAG_B = '7arCbOk0/5qzGwk8EXwg4vvkEPm5E8i7i8hO0LejM4c=';
// Neither fragment alone is the real HMAC key.
// At runtime the two are XOR-assembled: key = FRAG_A ^ FRAG_B.
// This raises the effort for casual bundle inspection without adding dependencies.

function assembleKey(): Uint8Array {
        const a = Uint8Array.from(atob(_FRAG_A), (c) => c.charCodeAt(0));
        const b = Uint8Array.from(atob(_FRAG_B), (c) => c.charCodeAt(0));
        const raw = new Uint8Array(a.length);
        for (let i = 0; i < a.length; i++) raw[i] = a[i] ^ b[i];
        return raw;
}

let _hmacKey: CryptoKey | null = null;

async function getHmacKey(): Promise<CryptoKey> {
        if (_hmacKey) return _hmacKey;
        const raw = assembleKey();
        _hmacKey = await crypto.subtle.importKey(
                'raw',
                raw.buffer as ArrayBuffer,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign', 'verify']
        );
        return _hmacKey;
}

/** Generate a cryptographically random 16-byte salt (32 hex chars). */
function generateSalt(): string {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compute HMAC-SHA256(salt || payload). Returns 64-char hex. */
async function computeHmac(payload: string, salt: string): Promise<string> {
        const key = await getHmacKey();
        const data = new TextEncoder().encode(salt + payload);
        const sig = await crypto.subtle.sign('HMAC', key, data);
        return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Verify an HMAC-SHA256 signature. Uses crypto.subtle.verify for constant-time comparison. */
async function verifyHmac(signature: string, payload: string, salt: string): Promise<boolean> {
        try {
                const key = await getHmacKey();
                const data = new TextEncoder().encode(salt + payload);
                const sigBytes = new Uint8Array(
                        signature.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []
                );
                return await crypto.subtle.verify('HMAC', key, sigBytes, data);
        } catch (err) {
                warnDev('history-io', 'verifyHmac', 'HMAC verification failed', err);
                return false;
        }
}

// ---------------------------------------------------------------------------
// SHA-256 hash — legacy v2 verification (no secret key)
// ---------------------------------------------------------------------------
async function computeHash(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = new Uint8Array(hashBuffer);
        return Array.from(hashArray, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Legacy hash helpers (kept for backward compatibility when importing
// old exports with 8-char or 16-char checksums)
// ---------------------------------------------------------------------------
function fnv1a(data: string): string {
        let h = 0x811c9dc5;
        for (let i = 0; i < data.length; i++) {
                h ^= data.charCodeAt(i);
                h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16).padStart(8, '0');
}

function dualHash(data: string): string {
        let fnv = 0x811c9dc5;
        let djb = 0x1505;
        for (let i = 0; i < data.length; i++) {
                const c = data.charCodeAt(i);
                fnv = Math.imul(fnv ^ c, 0x01000193);
                djb = ((djb << 5) + djb + c) | 0;
        }
        return (fnv >>> 0).toString(16).padStart(8, '0') + (djb >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Helpers to validate individual record fields
// ---------------------------------------------------------------------------
function isValidRecord(entry: unknown): entry is BmiRecord {
        if (typeof entry !== 'object' || entry === null) return false;
        const r = entry as Record<string, unknown>;
        return (
                typeof r.timestamp === 'number' &&
                typeof r.bmi === 'number' &&
                typeof r.height === 'number' &&
                typeof r.weight === 'number'
        );
}

function toRecord(entry: unknown): BmiRecord {
        const r = entry as Record<string, unknown>;
        return {
                timestamp: r.timestamp as number,
                bmi: r.bmi as number,
                height: r.height as number,
                weight: r.weight as number,
                age: typeof r.age === 'number' ? r.age : undefined
        };
}

/** Check if parsed JSON matches the envelope shape. */
function isEnvelope(obj: unknown): obj is ExportedEnvelope {
        if (typeof obj !== 'object' || obj === null) return false;
        const e = obj as Record<string, unknown>;
        return (
                typeof e.version === 'number' &&
                e.source === 'bmi-calculator' &&
                Array.isArray(e.records)
        );
}

// ---------------------------------------------------------------------------
// Internal parse + validate (single JSON.parse, shared by public API)
// ---------------------------------------------------------------------------

interface ParsedImportResult {
        valid: boolean;
        envelope: ExportedEnvelope;
        records: BmiRecord[];
        validation: ValidationResult;
}

async function parseAndValidate(json: string): Promise<ParsedImportResult | InvalidResult> {
        let incoming: unknown;
        try {
                incoming = JSON.parse(json);
        } catch (err) {
                warnDev('history-io', 'parseAndValidate', 'Failed to parse import JSON', err);
                return { valid: false, validation: { valid: false, error: t('history.invalid_json'), errorCode: 'invalid_json' } };
        }

        if (!isEnvelope(incoming)) {
                return { valid: false, validation: { valid: false, error: t('history.invalid_format'), errorCode: 'invalid_format' } };
        }

        const env = incoming;

        // Version guard — only v0–v3 are known formats
        if (typeof env.version === 'number' && env.version > 3) {
                return { valid: false, validation: { valid: false, error: t('history.unsupported_version'), errorCode: 'unsupported_version' } };
        }

        const records = env.records.filter(isValidRecord).map(toRecord);

        if (records.length === 0) {
                return { valid: false, validation: { valid: false, error: t('history.no_records'), errorCode: 'no_valid_records' } };
        }

        const recordsJson = JSON.stringify(records);
        const result = await verifyIntegrity(env, recordsJson);

        if (!result.valid) {
                return {
                        valid: false,
                        validation: { valid: false, error: t('history.integrity_failed'), errorCode: 'integrity_failed' }
                };
        }

        return {
                valid: true,
                envelope: env,
                records,
                validation: {
                        valid: true,
                        recordCount: records.length,
                        integrityVerified: true,
                        integrityVersion: result.integrityVersion,
                        algorithm: result.algorithm
                }
        };
}

interface InvalidResult {
        valid: false;
        validation: ValidationResult;
}

// ---------------------------------------------------------------------------
// Export — produces v3 (HMAC-SHA256) envelopes
// ---------------------------------------------------------------------------

/**
 * Export BMI history from storage as an HMAC-signed JSON string.
 * Returns `null` if no history exists or data is invalid.
 *
 * Each export includes a unique random salt so that re-exporting the
 * same records produces a different (but still valid) signature.
 *
 * If a passphrase is provided, the envelope is additionally encrypted
 * with AES-256-GCM before being returned.
 */
export async function exportBmiHistory(passphrase?: string): Promise<string | null> {
        try {
                const stored = storageGet(STORAGE_KEYS.HISTORY);
                if (!stored) return null;

                const parsed: unknown = JSON.parse(stored);
                if (!Array.isArray(parsed) || parsed.length === 0) return null;

                const records = parsed.filter(isValidRecord).map(toRecord);
                if (records.length === 0) return null;

                const recordsJson = JSON.stringify(records);
                const exportedAt = new Date().toISOString();

                // v3: HMAC-SHA256 with random salt
                const salt = generateSalt();
                const payload = JSON.stringify({ version: 3, source: 'bmi-calculator', exportedAt, records: recordsJson });
                const signature = await computeHmac(payload, salt);

                const envelope: ExportedEnvelope = {
                        version: 3,
                        source: 'bmi-calculator',
                        exportedAt,
                        algorithm: 'HMAC-SHA256',
                        salt,
                        signature,
                        records
                };

                const envelopeJson = JSON.stringify(envelope, null, 2);

                // Optional encryption — embed metadata outside encrypted payload for preview
                if (passphrase) {
                        const { encrypt } = await import('./crypto');
                        return await encrypt(envelopeJson, passphrase, {
                                exportedAt,
                                recordCount: records.length,
                                version: 3,
                        });
                }

                return envelopeJson;
        } catch (err) {
                warnDev('history-io', 'exportBmiHistory', 'Export failed', err);
                return null;
        }
}

// ---------------------------------------------------------------------------
// Validate (no side-effects)
// ---------------------------------------------------------------------------

export interface ValidationResult {
        valid: boolean;
        recordCount?: number;
        integrityVerified?: boolean;
        integrityVersion?: number; // 0, 1, 2, or 3
        algorithm?: string;
        error?: string;
        /** Structured error code for UI mapping */
        errorCode?: ImportError;
}

/**
 * Build the envelope payload string for integrity verification.
 * For v0 (FNV-1a, 8-char): records only (legacy).
 * For v1/v2/v3: full envelope with JSON-stringified records.
 */
function buildPayload(version: number, source: string, exportedAt: string, recordsJson: string): string {
        if (version === 0) {
                // Legacy v0: only records were hashed
                return recordsJson;
        }
        // v1, v2, v3: full envelope was hashed
        return JSON.stringify({ version, source, exportedAt, records: recordsJson });
}

/**
 * Verify integrity with backward compatibility for all four formats:
 *   v3 + salt          → HMAC-SHA256 with random salt  (current)
 *   v2 (checksum 64-ch)→ SHA-256 on full envelope       (legacy)
 *   v1 (checksum 16-ch)→ FNV-1a + DJB2 on full envelope (legacy)
 *   v0 (checksum  8-ch)→ FNV-1a on records only         (legacy)
 */
async function verifyIntegrity(
        env: ExportedEnvelope,
        recordsJson: string
): Promise<{ valid: boolean; integrityVersion: number; algorithm?: string }> {
        const { version, source, exportedAt } = env;

        // v3: HMAC-SHA256 with per-export salt
        if (version === 3 && env.salt && env.signature && env.signature.length === 64) {
                const payload = buildPayload(version, source, exportedAt, recordsJson);
                const ok = await verifyHmac(env.signature, payload, env.salt);
                return { valid: ok, integrityVersion: 3, algorithm: env.algorithm };
        }

        // Legacy v0/v1/v2: fall back to `checksum` field
        const checksum = env.checksum ?? '';
        if (!checksum) return { valid: false, integrityVersion: -1 };

        // v2: SHA-256 on full envelope (no salt)
        if (checksum.length === 64) {
                const payload = buildPayload(version, source, exportedAt, recordsJson);
                const expected = await computeHash(payload);
                return { valid: checksum === expected, integrityVersion: 2 };
        }

        // v1: dual-hash on full envelope
        if (checksum.length === 16) {
                const payload = buildPayload(version, source, exportedAt, recordsJson);
                const expected = dualHash(payload);
                return { valid: checksum === expected, integrityVersion: 1 };
        }

        // v0: FNV-1a on records only
        if (checksum.length === 8) {
                const expected = fnv1a(recordsJson);
                return { valid: checksum === expected, integrityVersion: 0 };
        }

        return { valid: false, integrityVersion: -1 };
}

/**
 * Validate an imported JSON string without touching storage.
 * Use this to pre-check a file before asking the user for confirmation.
 */
export async function validateBmiImport(json: string, passphrase?: string): Promise<ValidationResult> {
        // Size guard — reject files exceeding MAX_IMPORT_SIZE before any processing
        if (json.length > MAX_IMPORT_SIZE) {
                return { valid: false, error: t('history.file_too_large'), errorCode: 'file_too_large' };
        }

        // Auto-detect encrypted payload
        let content = json;
        const { isEncrypted } = await import('./crypto');
        if (isEncrypted(json)) {
                if (!passphrase) {
                        return { valid: false, error: t('history.encrypted_no_passphrase'), errorCode: 'encrypted_no_passphrase' };
                }
                const { decrypt } = await import('./crypto');
                const result = await decrypt(json, passphrase);
                if (result === null) {
                        return { valid: false, error: t('history.wrong_passphrase'), errorCode: 'wrong_passphrase' };
                }
                if (!result.integrityOk) {
                        return { valid: false, error: t('history.tampered_file'), errorCode: 'integrity_failed' };
                }
                content = result.plaintext;
        }

        const result = await parseAndValidate(content);
        return result.validation;
}

// ---------------------------------------------------------------------------
// Import (writes to storage — call only after user confirmation)
// ---------------------------------------------------------------------------

export interface ImportResult {
        success: boolean;
        count: number;
        integrityVerified?: boolean;
        integrityVersion?: number;
        algorithm?: string;
        error?: string;
        /** Structured error code for UI mapping */
        errorCode?: ImportError;
}

/** Lightweight metadata extracted from an import file without full parsing/decryption. */
export interface ImportFileMeta {
        encrypted: boolean;
        format?: string;
        exportedAt?: string;
        recordCount?: number;
        version?: number;
}

/**
 * Peek at import file metadata without decrypting or parsing records.
 * For encrypted files with embedded meta, exportedAt/recordCount/version are available.
 * For encrypted files without meta (legacy), only format and encrypted status are available.
 * For plain files, exportedAt, version, and recordCount are also extracted.
 *
 * Metadata fields are sanitized — values are not trusted blindly.
 */
export function peekImportMeta(json: string): ImportFileMeta {
        try {
                const parsed = JSON.parse(json);

                // Encrypted payload — meta is stored unencrypted for preview
                if (parsed?.format === 'bmi-encrypted-v1') {
                        return {
                                encrypted: true,
                                format: parsed.format,
                                exportedAt: typeof parsed.meta?.exportedAt === 'string' ? parsed.meta.exportedAt : undefined,
                                recordCount: typeof parsed.meta?.recordCount === 'number' && parsed.meta.recordCount >= 0 ? parsed.meta.recordCount : undefined,
                                version: typeof parsed.meta?.version === 'number' && parsed.meta.version >= 0 ? parsed.meta.version : undefined,
                        };
                }

                // Plain envelope
                if (typeof parsed?.version === 'number' && Array.isArray(parsed?.records)) {
                        return {
                                encrypted: false,
                                exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
                                version: parsed.version >= 0 ? parsed.version : undefined,
                                recordCount: parsed.records.length,
                        };
                }

                // Bare array (legacy)
                if (Array.isArray(parsed)) {
                        return {
                                encrypted: false,
                                recordCount: parsed.length,
                        };
                }

                return { encrypted: false };
        } catch (err) {
                warnDev('history-io', 'peekImportMeta', 'Failed to peek import metadata', err);
                return { encrypted: false };
        }
}

/**
 * Import BMI history from a JSON string, **replacing** all existing data.
 * The caller is responsible for having already validated and confirmed with the user.
 *
 * If a passphrase is provided and the content is encrypted, it will be decrypted.
 *
 * Performance: JSON is parsed exactly once (shared between validation and extraction).
 */
export async function importBmiHistory(json: string, passphrase?: string): Promise<ImportResult> {
        // ── Pre-parse guards ──
        if (!json || json.trim().length === 0) {
                return { success: false, count: 0, error: t('history.empty_file'), errorCode: 'empty_file' };
        }

        // Size guard — reject files exceeding MAX_IMPORT_SIZE before parsing
        if (json.length > MAX_IMPORT_SIZE) {
                return { success: false, count: 0, error: t('history.file_too_large'), errorCode: 'file_too_large' };
        }

        // Auto-detect and decrypt if encrypted and passphrase provided
        let content = json;
        const { isEncrypted } = await import('./crypto');
        if (isEncrypted(json)) {
                if (!passphrase) {
                        return { success: false, count: 0, error: t('history.encrypted_no_passphrase'), errorCode: 'encrypted_no_passphrase' };
                }
                // Validate encrypted payload structure before attempting decryption
                let payload: Record<string, unknown>;
                try {
                        payload = JSON.parse(json);
                } catch (err) {
                        warnDev('history-io', 'importBmiHistory', 'Failed to parse encrypted payload for validation', err);
                        return { success: false, count: 0, error: t('history.corrupted_file'), errorCode: 'corrupted_file' };
                }
                if (!payload.salt || !payload.iv || !payload.data) {
                        return { success: false, count: 0, error: t('history.corrupted_file'), errorCode: 'corrupted_file' };
                }
                const { decrypt } = await import('./crypto');
                const result = await decrypt(json, passphrase);
                if (result === null) {
                        return { success: false, count: 0, error: t('history.wrong_passphrase'), errorCode: 'wrong_passphrase' };
                }
                if (!result.integrityOk) {
                        return { success: false, count: 0, error: t('history.tampered_file'), errorCode: 'integrity_failed' };
                }
                content = result.plaintext;
        }

        const result = await parseAndValidate(content);

        if (!result.valid) {
                const code = result.validation.errorCode ?? 'invalid_format';
                return { success: false, count: 0, error: result.validation.error, errorCode: code };
        }

        const { records, validation } = result;

        if (records.length === 0) {
                return { success: false, count: 0, error: t('history.no_valid_records'), errorCode: 'no_valid_records' };
        }

        // Sort by timestamp
        records.sort((a, b) => a.timestamp - b.timestamp);

        // Create backup before overwriting existing data (fire-and-forget, don't block)
        try {
                import('./backup').then(({ createBackup }) => {
                        void createBackup('before_import');
                }).catch((err) => {
                        warnDev('history-io', 'importBmiHistory', 'Pre-import backup failed', err);
                });
        } catch (err) { warnDev('history-io', 'importBmiHistory', 'Pre-import backup block failed', err); }

        // Override (replace) existing data via centralized storage
        // skipBackup: true — we already created a backup above
        const ok = storageSet(STORAGE_KEYS.HISTORY, JSON.stringify(records), { skipBackup: true });
        if (!ok) {
                return { success: false, count: 0, error: t('history.save_failed'), errorCode: 'save_failed' };
        }

        return {
                success: true,
                count: records.length,
                integrityVerified: validation.integrityVerified,
                integrityVersion: validation.integrityVersion,
                algorithm: validation.algorithm
        };
}

// ---------------------------------------------------------------------------
// CSV Export — lightweight, no integrity check (human-readable format)
// ---------------------------------------------------------------------------

/**
 * Export BMI history as a CSV string suitable for spreadsheet apps.
 * Columns: Date, Time, BMI, Height (cm), Weight (kg), Age, Category
 * Returns `null` if no history exists.
 */
export function exportBmiHistoryCsv(): string | null {
        try {
                const stored = storageGet(STORAGE_KEYS.HISTORY);
                if (!stored) return null;

                const parsed: unknown = JSON.parse(stored);
                if (!Array.isArray(parsed) || parsed.length === 0) return null;

                const records = parsed.filter(isValidRecord).map(toRecord);
                if (records.length === 0) return null;

                const rows: string[][] = [
                        ['Date', 'Time', 'BMI', 'Height (cm)', 'Weight (kg)', 'Age', 'Category']
                ];

                for (const r of records) {
                        const d = new Date(r.timestamp);
                        const date = d.toISOString().split('T')[0];
                        const time = d.toTimeString().split(' ')[0].slice(0, 5);
                        const bmi = r.bmi.toFixed(1);
                        const category = getBmiCategoryName(r.bmi);

                        rows.push([date, time, bmi, String(r.height), String(r.weight), r.age ? String(r.age) : '', category]);
                }

                return rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
        } catch (err) {
                warnDev('history-io', 'exportBmiHistoryCsv', 'CSV export failed', err);
                return null;
        }
}

function getBmiCategoryName(bmi: number): string {
        if (bmi < 18.5) return t('category.underweight');
        if (bmi < 25) return t('category.normal');
        if (bmi < 30) return t('category.overweight');
        return t('category.obese');
}