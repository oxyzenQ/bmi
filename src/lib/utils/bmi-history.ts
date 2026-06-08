// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import { browser } from '$app/environment';
import { STORAGE_KEYS, storageGetJSON, storageRemove, storageSetJSON } from './storage';
import { warnDev } from './warn-dev';
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

export function saveBmiToHistory(input: SaveBmiHistoryInput): string | null {
	if (!browser) return input.lastSignature;

	const parsedAge = input.age !== '' ? parseInt(input.age) : undefined;
	const ageNum = Number.isFinite(parsedAge) ? parsedAge : undefined;
	const historySignature = buildHistorySignature(input.bmi, input.heightCm, input.weightKg, ageNum);
	if (input.lastSignature === historySignature) return input.lastSignature;

	let history: BmiRecord[] = [];
	try {
		history = storageGetJSON(STORAGE_KEYS.HISTORY, []);
	} catch (err) {
		warnDev('page', 'saveBmi', 'Failed to read history — corrupted data removed', err);
		storageRemove(STORAGE_KEYS.HISTORY);
	}

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
