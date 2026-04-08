/**
 * BMI History Export/Import utilities with BLAKE3 checksum verification.
 *
 * Export wraps records in a versioned envelope with a cryptographic checksum
 * (BLAKE3 — fastest production-grade hash, 256-bit / 64-char hex).
 * Import validates the checksum (rejects tampered files) and overrides
 * existing data when the user confirms.
 *
 * Checksum evolution:
 *   v0 (8-char)  — FNV-1a 32-bit on records only      [legacy, no longer exported]
 *   v1 (16-char) — FNV-1a+DJB2 64-bit on full envelope  [legacy, no longer exported]
 *   v2 (64-char) — BLAKE3 256-bit on full envelope       [current]
 * All three formats are still accepted on import for backward compatibility.
 */

import { blake3 } from 'hash-wasm';

interface BmiRecord {
  timestamp: number;
  bmi: number;
  height: number;
  weight: number;
  age?: number;
}

/** Shape of the exported JSON file */
interface ExportedEnvelope {
  version: number;
  source: string;
  exportedAt: string;
  checksum: string;
  records: BmiRecord[];
}

// ---------------------------------------------------------------------------
// BLAKE3 hash — covers the *entire* export envelope (version, source,
// exportedAt, and the JSON-serialized records).  Swapping any field —
// including metadata — breaks the checksum.
// ---------------------------------------------------------------------------
async function computeHash(data: string): Promise<string> {
  return blake3(data);
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
    age: typeof r.age === 'number' ? (r.age as number) : undefined
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export BMI history from localStorage as a checksummed JSON string.
 * Returns `null` if no history exists or data is invalid.
 */
export async function exportBmiHistory(): Promise<string | null> {
  try {
    const stored = localStorage.getItem('bmi.history');
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const records = parsed.filter(isValidRecord).map(toRecord);
    if (records.length === 0) return null;

    const recordsJson = JSON.stringify(records);
    const exportedAt = new Date().toISOString();

    // BLAKE3 hash of the full envelope payload
    const payload = JSON.stringify({ version: 2, source: 'bmi-calculator', exportedAt, records: recordsJson });
    const checksum = await computeHash(payload);

    const envelope: ExportedEnvelope = {
      version: 2,
      source: 'bmi-calculator',
      exportedAt,
      checksum,
      records
    };

    return JSON.stringify(envelope, null, 2);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validate (no side-effects)
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  recordCount?: number;
  checksumVerified?: boolean;
  error?: string;
}

/**
 * Build the envelope payload string for checksum verification.
 * For v2 (BLAKE3, 64-char): full envelope with JSON-stringified records.
 * For v1 (dual-hash, 16-char): full envelope with JSON-stringified records.
 * For v0 (FNV-1a, 8-char): records only (legacy).
 */
function buildPayload(version: number, source: string, exportedAt: string, recordsJson: string): string {
  if (version === 0) {
    // Legacy v0: only records were hashed
    return recordsJson;
  }
  // v1 and v2: full envelope was hashed
  return JSON.stringify({ version, source, exportedAt, records: recordsJson });
}

/**
 * Verify a checksum with backward compatibility for all three formats:
 *   64-char → BLAKE3 256-bit (current)
 *   16-char → FNV-1a + DJB2 64-bit (v1 legacy)
 *    8-char → FNV-1a 32-bit     (v0 legacy)
 */
async function verifyChecksum(
  checksum: string,
  version: number,
  source: string,
  exportedAt: string,
  recordsJson: string
): Promise<boolean> {
  if (checksum.length === 64) {
    // v2: BLAKE3 on full envelope
    const payload = buildPayload(version, source, exportedAt, recordsJson);
    const expected = await computeHash(payload);
    return checksum === expected;
  }

  if (checksum.length === 16) {
    // v1: dual-hash on full envelope
    const payload = buildPayload(version, source, exportedAt, recordsJson);
    const expected = dualHash(payload);
    return checksum === expected;
  }

  if (checksum.length === 8) {
    // v0: FNV-1a on records only
    const expected = fnv1a(recordsJson);
    return checksum === expected;
  }

  return false;
}

/**
 * Validate an imported JSON string without touching localStorage.
 * Use this to pre-check a file before asking the user for confirmation.
 */
export async function validateBmiImport(json: string): Promise<ValidationResult> {
  let incoming: unknown;
  try {
    incoming = JSON.parse(json);
  } catch {
    return { valid: false, error: 'Invalid JSON format.' };
  }

  // ---- Envelope format (v0/v1/v2) ----
  if (
    typeof incoming === 'object' &&
    incoming !== null &&
    typeof (incoming as ExportedEnvelope).version === 'number' &&
    (incoming as ExportedEnvelope).source === 'bmi-calculator' &&
    Array.isArray((incoming as ExportedEnvelope).records)
  ) {
    const env = incoming as ExportedEnvelope;
    const records = env.records.filter(isValidRecord).map(toRecord);

    if (records.length === 0) {
      return { valid: false, error: 'No valid BMI records found in the file.' };
    }

    const recordsJson = JSON.stringify(records);
    const valid = await verifyChecksum(env.checksum, env.version, env.source, env.exportedAt, recordsJson);

    if (!valid) {
      return {
        valid: false,
        error:
          'Checksum verification failed — the file has been modified and is not safe to import.'
      };
    }

    return { valid: true, recordCount: records.length, checksumVerified: true };
  }

  // No legacy fallback — only envelope format with checksum is accepted
  return {
    valid: false,
    error: 'Invalid file format. This file was not exported by BMI Calculator or has been modified. Please export a new file and try again.'
  };
}

// ---------------------------------------------------------------------------
// Import (writes to localStorage — call only after user confirmation)
// ---------------------------------------------------------------------------

export interface ImportResult {
  success: boolean;
  count: number;
  checksumVerified?: boolean;
  error?: string;
}

/**
 * Import BMI history from a JSON string, **replacing** all existing data.
 * The caller is responsible for having already validated and confirmed with the user.
 */
export async function importBmiHistory(json: string): Promise<ImportResult> {
  const validation = await validateBmiImport(json);
  if (!validation.valid) {
    return { success: false, count: 0, error: validation.error };
  }

  // Extract records (only envelope format accepted)
  const incoming = JSON.parse(json) as ExportedEnvelope;
  const records = incoming.records.filter(isValidRecord).map(toRecord);

  if (records.length === 0) {
    return { success: false, count: 0, error: 'No valid BMI records found.' };
  }

  // Sort by timestamp
  records.sort((a, b) => a.timestamp - b.timestamp);

  // Override (replace) existing data
  try {
    localStorage.setItem('bmi.history', JSON.stringify(records));
  } catch {
    return { success: false, count: 0, error: 'Failed to save history to storage.' };
  }

  return {
    success: true,
    count: records.length,
    checksumVerified: validation.checksumVerified
  };
}
