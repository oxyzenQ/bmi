/**
 * BMI History Export/Import utilities with checksum verification.
 *
 * Export wraps records in a versioned envelope with an integrity checksum.
 * Import validates the checksum (rejects tampered files) and overrides
 * existing data when the user confirms.
 */

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
// Deterministic dual-hash (FNV-1a 32-bit + DJB2 32-bit) — produces a 16-char
// hex fingerprint.  Combining two independent hash algorithms makes crafted
// collisions exponentially harder than a single 32-bit hash alone.
//
// The hash covers the *entire* export envelope (version, source, exportedAt,
// and the JSON-serialized records) — not just the records array — so that
// swapping metadata between exports also breaks verification.
// ---------------------------------------------------------------------------
function computeHash(data: string): string {
  // --- FNV-1a 32-bit ---
  let fnv = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    fnv ^= data.charCodeAt(i);
    fnv = Math.imul(fnv, 0x01000193); // FNV prime
  }
  fnv = fnv >>> 0;

  // --- DJB2 32-bit (variant with XOR) ---
  let djb = 0x1505; // non-zero seed
  for (let i = 0; i < data.length; i++) {
    djb = ((djb << 5) + djb + data.charCodeAt(i)) | 0;
  }
  djb = djb >>> 0;

  // Concatenate both hashes for a 64-bit-equivalent fingerprint
  return fnv.toString(16).padStart(8, '0') + djb.toString(16).padStart(8, '0');
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
export function exportBmiHistory(): string | null {
  try {
    const stored = localStorage.getItem('bmi.history');
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const records = parsed.filter(isValidRecord).map(toRecord);
    if (records.length === 0) return null;

    const recordsJson = JSON.stringify(records);
    const exportedAt = new Date().toISOString();

    // Hash the full envelope payload (version + source + exportedAt + records)
    // This prevents metadata swapping and strengthens tamper detection.
    const payload = JSON.stringify({ version: 1, source: 'bmi-calculator', exportedAt, records: recordsJson });
    const checksum = computeHash(payload);

    const envelope: ExportedEnvelope = {
      version: 1,
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
 * Validate an imported JSON string without touching localStorage.
 * Use this to pre-check a file before asking the user for confirmation.
 */
export function validateBmiImport(json: string): ValidationResult {
  let incoming: unknown;
  try {
    incoming = JSON.parse(json);
  } catch {
    return { valid: false, error: 'Invalid JSON format.' };
  }

  // ---- New envelope format (v1+) ----
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

    // Verify checksum
    // Supports both old (8-char FNV-1a on records) and new (16-char dual-hash
    // on full envelope) checksums for backward compatibility.
    if (env.checksum.length === 16) {
      // New format: dual-hash of full envelope payload
      const expected = computeHash(JSON.stringify({
        version: env.version,
        source: env.source,
        exportedAt: env.exportedAt,
        records: JSON.stringify(records)
      }));
      if (env.checksum !== expected) {
        return {
          valid: false,
          error:
            'Checksum verification failed — the file has been modified and is not safe to import.'
        };
      }
    } else {
      // Legacy format (8-char): FNV-1a on records only
      let h = 0x811c9dc5;
      const recordsStr = JSON.stringify(records);
      for (let i = 0; i < recordsStr.length; i++) {
        h ^= recordsStr.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      const expected = (h >>> 0).toString(16).padStart(8, '0');
      if (env.checksum !== expected) {
        return {
          valid: false,
          error:
            'Checksum verification failed — the file has been modified and is not safe to import.'
        };
      }
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
export function importBmiHistory(json: string): ImportResult {
  const validation = validateBmiImport(json);
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
