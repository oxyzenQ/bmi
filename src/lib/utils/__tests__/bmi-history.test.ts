// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it } from 'vitest';
import { buildHistorySignature, readBmiHistory, saveBmiToHistory } from '../bmi-history';
import { STORAGE_KEYS, storageInvalidateAll, storageSetJSON } from '../storage';

const now = Date.now();
const validRecord = { timestamp: now - 60_000, bmi: 24.2, height: 170, weight: 70, age: 30 };

beforeEach(() => {
	storageInvalidateAll();
	localStorage.clear();
});

describe('readBmiHistory (validated read path)', () => {
	it('keeps only finite, in-bounds records and sorts ascending', () => {
		// Raw 1e999 JSON literal — parses to Infinity, the exact pre-hardening vector
		localStorage.setItem(
			STORAGE_KEYS.HISTORY,
			`[{"timestamp":${now - 60_000},"bmi":1e999,"height":170,"weight":70,"age":30},{"timestamp":${now - 120_000},"bmi":24.2,"height":170,"weight":70,"age":30}]`
		);
		storageInvalidateAll();

		storageSetJSON(STORAGE_KEYS.HISTORY, [
			validRecord,
			{ ...validRecord, timestamp: now - 120_000 }, // older, must sort first
			{ ...validRecord, weight: -80 }, // out of bounds
			{ ...validRecord, height: 0 }, // zero height
			'garbage', // wrong shape
			null, // wrong shape
			{ ...validRecord, timestamp: 0 } // zero timestamp
		]);

		const records = readBmiHistory();
		expect(records).toHaveLength(2);
		expect(records[0].timestamp).toBeLessThan(records[1].timestamp);
		expect(records[1].bmi).toBeCloseTo(24.2);
	});

	it('degrades to an empty list when the stored value is not an array', () => {
		storageSetJSON(STORAGE_KEYS.HISTORY, 'not-an-array');
		expect(readBmiHistory()).toEqual([]);
	});

	it('degrades to an empty list when storage is missing or malformed', () => {
		expect(readBmiHistory()).toEqual([]);
		localStorage.setItem(STORAGE_KEYS.HISTORY, '{broken json');
		storageInvalidateAll();
		expect(readBmiHistory()).toEqual([]);
	});

	it('accepts a legacy record without an age field', () => {
		storageSetJSON(STORAGE_KEYS.HISTORY, [
			{ timestamp: now - 1, bmi: 22, height: 175, weight: 67 }
		]);
		const records = readBmiHistory();
		expect(records).toHaveLength(1);
		expect(records[0].age).toBeUndefined();
	});
});

describe('saveBmiToHistory self-healing write', () => {
	it('purges poisoned records from storage on the next save', () => {
		localStorage.setItem(
			STORAGE_KEYS.HISTORY,
			`[{"timestamp":${now - 60_000},"bmi":1e999,"height":170,"weight":70,"age":30}]`
		);
		storageInvalidateAll();

		const signature = saveBmiToHistory({
			bmi: 25.1,
			heightCm: 172,
			weightKg: 74,
			age: '31',
			lastSignature: null
		});
		expect(signature).not.toBeNull();

		const stored = readBmiHistory();
		expect(stored).toHaveLength(1); // poison gone, only the new record remains
		for (const record of stored) {
			expect(Number.isFinite(record.bmi)).toBe(true);
			expect(Number.isFinite(record.timestamp)).toBe(true);
		}
	});

	it('dedupes identical consecutive saves via the history signature', () => {
		const lastSignature = buildHistorySignature(25.1, 172, 74, 31);
		const signature = saveBmiToHistory({
			bmi: 25.1,
			heightCm: 172,
			weightKg: 74,
			age: '31',
			lastSignature
		});
		expect(signature).toBe(lastSignature);
	});
});
