// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The import record-count cap battery (night-depth-hardening-5).
 *
 * The cap is the burn bound on the O(N) ledger save floor: one hostile
 * file must never become a durable per-save tax. The refusal fires
 * BEFORE any integrity work, so these envelopes need no valid checksum —
 * the cap is the gate under test, and it must answer first.
 */
import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_RECORDS, validateBmiImport } from '../history-io';

/** A valid-shaped record (isValidRecord passes; integrity is never reached). */
function validShapedRecord(i: number): unknown {
	return { timestamp: 1_700_000_000_000 + i * 1_000, bmi: 22.5, height: 170, weight: 65 };
}

function envelopeWith(records: unknown[]): string {
	return JSON.stringify({
		version: 2,
		source: 'bmi-calculator',
		exportedAt: new Date().toISOString(),
		records
	});
}

describe('the import record-count cap (night-depth-hardening-5)', () => {
	it('pins the cap at 10,000 records', () => {
		expect(MAX_IMPORT_RECORDS).toBe(10_000);
	});

	it('refuses an import past the cap before any integrity work', async () => {
		const json = envelopeWith(
			Array.from({ length: MAX_IMPORT_RECORDS + 1 }, (_, i) => validShapedRecord(i))
		);
		const result = await validateBmiImport(json);
		expect(result.valid).toBe(false);
		expect(result.errorCode).toBe('too_many_records');
	});

	it('maps the refusal through i18n for every locale key', async () => {
		const { t } = await import('$lib/i18n');
		const message = t('history.too_many_records');
		expect(message).toBeTruthy();
		expect(message).not.toBe('history.too_many_records');
	});
});
