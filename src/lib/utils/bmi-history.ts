// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
import { browser } from '$app/environment';
import { STORAGE_KEYS, storageGetJSON, storageSetJSON } from './storage';
import { isValidRecord, toRecord } from './history-io';
import type { BmiRecord } from '$lib/types/bmi-record';

interface SaveBmiHistoryInput {
	bmi: number;
	heightCm: number;
	weightKg: number;
	age: string;
	lastSignature: string | null;
}

export function buildHistorySignature(
	bmi: number,
	heightCm: number,
	weightKg: number,
	ageNum?: number
): string {
	return [bmi.toFixed(4), heightCm.toFixed(2), weightKg.toFixed(2), ageNum ?? ''].join('|');
}

/**
 * Single validated read path for BMI history.
 *
 * Storage contents are never trusted: every record must pass the same
 * isValidRecord guard the import path uses (finite numbers, calculator
 * bounds, timestamp sanity). This neutralizes poison that predates the
 * import hardening or enters via IndexedDB backup restore, and it means
 * display components never see non-finite values.
 *
 * Never throws: malformed JSON, non-array payloads, and invalid records
 * all degrade to a shorter (possibly empty) ascending-sorted list.
 */
export function readBmiHistory(): BmiRecord[] {
	if (!browser) return [];
	const raw: unknown = storageGetJSON<unknown>(STORAGE_KEYS.HISTORY, []);
	if (!Array.isArray(raw)) return [];
	const records = raw.filter(isValidRecord).map(toRecord);
	records.sort((a, b) => a.timestamp - b.timestamp);
	return records;
}

export function saveBmiToHistory(input: SaveBmiHistoryInput): string | null {
	if (!browser) return input.lastSignature;

	const parsedAge = input.age !== '' ? parseInt(input.age) : undefined;
	const ageNum = Number.isFinite(parsedAge) ? parsedAge : undefined;
	const historySignature = buildHistorySignature(input.bmi, input.heightCm, input.weightKg, ageNum);
	if (input.lastSignature === historySignature) return input.lastSignature;

	// Validated read — poisoned records are dropped here, so the write below
	// replaces storage contents with clean data (self-healing on every save).
	const history = readBmiHistory();

	const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
	const filtered = history.filter((record) => record.timestamp > oneYearAgo);
	filtered.push({
		timestamp: Date.now(),
		bmi: input.bmi,
		height: input.heightCm,
		weight: input.weightKg,
		age: ageNum
	});
	filtered.sort((a, b) => a.timestamp - b.timestamp);

	storageSetJSON(STORAGE_KEYS.HISTORY, filtered);
	return historySignature;
}
