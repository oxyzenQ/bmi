// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * CSV export — the lightweight, human-readable history format.
 *
 * Moved verbatim out of history-io.ts (night-frontier-Z3) when the
 * envelope stack grew the v4 continuity anchor: history-io.ts sits on
 * its 600-line ratchet watermark, and RULES.md names the domain split
 * as the sanctioned move. No integrity chain here by design — CSV is a
 * convenience export for spreadsheets; the JSON envelope is the
 * integrity-bearing format.
 */

import { STORAGE_KEYS, storageGet } from './storage';
import { warnDev } from './warn-dev';
import { isValidRecord, toRecord } from './history-io';
import { classifyBmi, getCategoryLabel } from './bmi-category';

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
			const category = getCategoryLabel(classifyBmi(r.bmi));

			rows.push([
				date,
				time,
				bmi,
				String(r.height),
				String(r.weight),
				r.age ? String(r.age) : '',
				category
			]);
		}

		return rows
			.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
			.join('\n');
	} catch (err) {
		warnDev('history-csv', 'exportBmiHistoryCsv', 'CSV export failed', err);
		return null;
	}
}
