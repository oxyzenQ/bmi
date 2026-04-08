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
// Deterministic hash (FNV-1a 32-bit) — fast, synchronous, collision-resistant
// enough for tamper-detection on small datasets.
// ---------------------------------------------------------------------------
function computeHash(data: string): string {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return (h >>> 0).toString(16).padStart(8, '0');
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
    const checksum = computeHash(recordsJson);

    const envelope: ExportedEnvelope = {
      version: 1,
      source: 'bmi-calculator',
      exportedAt: new Date().toISOString(),
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
    const expected = computeHash(JSON.stringify(records));
    if (env.checksum !== expected) {
      return {
        valid: false,
        error:
          'Checksum verification failed — the file has been modified and is not safe to import.'
      };
    }

    return { valid: true, recordCount: records.length, checksumVerified: true };
  }

  // ---- Legacy format: bare array (backward compat) ----
  if (Array.isArray(incoming)) {
    const records = (incoming as unknown[]).filter(isValidRecord).map(toRecord);
    if (records.length === 0) {
      return { valid: false, error: 'No valid BMI records found in the file.' };
    }
    return { valid: true, recordCount: records.length, checksumVerified: false };
  }

  return {
    valid: false,
    error: 'Invalid file format. Expected a BMI Calculator export file.'
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

  // Extract records
  const incoming = JSON.parse(json);
  let records: BmiRecord[];

  if (
    typeof incoming === 'object' &&
    incoming !== null &&
    Array.isArray((incoming as ExportedEnvelope).records)
  ) {
    records = (incoming as ExportedEnvelope).records.filter(isValidRecord).map(toRecord);
  } else if (Array.isArray(incoming)) {
    records = (incoming as unknown[]).filter(isValidRecord).map(toRecord);
  } else {
    return { success: false, count: 0, error: 'Could not extract records from file.' };
  }

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
