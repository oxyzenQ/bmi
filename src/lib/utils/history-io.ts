/**
 * BMI History Export/Import utilities
 */

interface BmiRecord {
  timestamp: number;
  bmi: number;
  height: number;
  weight: number;
  age?: number;
}

/**
 * Export BMI history from localStorage as a formatted JSON string.
 * Returns null if no history exists or data is invalid.
 */
export function exportBmiHistory(): string | null {
  try {
    const stored = localStorage.getItem('bmi.history');
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

/**
 * Import BMI history from a JSON string, merging with existing data.
 * Deduplicates by timestamp and keeps only the last year of records.
 */
export function importBmiHistory(
  json: string
): { success: boolean; count: number; error?: string } {
  // Parse the JSON string
  let incoming: unknown;
  try {
    incoming = JSON.parse(json);
  } catch {
    return { success: false, count: 0, error: 'Invalid JSON format.' };
  }

  // Validate it's an array
  if (!Array.isArray(incoming)) {
    return { success: false, count: 0, error: 'Expected a JSON array of BMI records.' };
  }

  // Validate each entry has required fields
  const validRecords: BmiRecord[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const entry = incoming[i];
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.timestamp === 'number' &&
      typeof entry.bmi === 'number' &&
      typeof entry.height === 'number' &&
      typeof entry.weight === 'number'
    ) {
      validRecords.push({
        timestamp: entry.timestamp as number,
        bmi: entry.bmi as number,
        height: entry.height as number,
        weight: entry.weight as number,
        age: typeof entry.age === 'number' ? (entry.age as number) : undefined
      });
    }
  }

  if (validRecords.length === 0) {
    return { success: false, count: 0, error: 'No valid BMI records found in the file.' };
  }

  // Read existing history
  let existing: BmiRecord[] = [];
  try {
    const stored = localStorage.getItem('bmi.history');
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        existing = parsed as BmiRecord[];
      }
    }
  } catch {
    // Corrupted data — start fresh
    existing = [];
  }

  // Merge: use a Map keyed by timestamp to skip duplicates
  const merged = new Map<number, BmiRecord>();

  for (const record of existing) {
    merged.set(record.timestamp, record);
  }

  let importedCount = 0;
  for (const record of validRecords) {
    if (!merged.has(record.timestamp)) {
      merged.set(record.timestamp, record);
      importedCount++;
    }
  }

  // Keep only last year of data
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const filtered = Array.from(merged.values()).filter(
    (r) => r.timestamp > oneYearAgo
  );

  // Sort by timestamp
  filtered.sort((a, b) => a.timestamp - b.timestamp);

  // Save back to localStorage
  try {
    localStorage.setItem('bmi.history', JSON.stringify(filtered));
  } catch {
    return { success: false, count: 0, error: 'Failed to save history to storage.' };
  }

  return { success: true, count: importedCount };
}
