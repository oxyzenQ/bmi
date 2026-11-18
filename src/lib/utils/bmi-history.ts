// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
import { browser } from '$app/environment';
import { STORAGE_KEYS, storageGetJSON, storageSetJSON } from './storage';
import { isValidRecord, toRecord } from './history-io';
import {
	computeLedgerChain,
	getSealedLedgerChain,
	isHistorySealedOpaque,
	reseatLedgerChainAfterSave
} from './ledger-continuity';
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

	// Continuity witness (night-frontier-Z3): the save is a legit write,
	// but the blessing is conditional — the witness advances only when the
	// pre-save state matched the sealed head. History that changed outside
	// a legit path leaves the witness frozen (evidence preserved) instead
	// of silently re-anchoring tampered content.
	void reseatLedgerChainAfterSave(history, filtered);

	return historySignature;
}

// ── Continuity audit (night-frontier-Z3) ──

export type ContinuityState = 'ok' | 'violated' | 'unanchored' | 'sealed-opaque';

export interface ContinuityAudit {
	state: ContinuityState;
	/** The sealed witness, when one exists and was readable. */
	sealed: { head: string; length: number } | null;
	/** The chain recomputed from the validated records. */
	computed: { head: string; length: number } | null;
}

/**
 * Measure the ledger continuity: recompute the chain over the validated
 * records and compare it with the sealed witness.
 *
 *   ok            — the recomputed head matches the sealed witness
 *   violated      — a witness exists and disagrees with the records:
 *                   the history changed outside a legit write path
 *   unanchored    — no witness exists (fresh device, degraded seal, or
 *                   pre-Z3 data waiting for its first legit write)
 *   sealed-opaque — the history is an at-rest envelope and the session
 *                   is locked; continuity cannot be measured through a
 *                   sealed value and must never be misread as tampered
 *
 * Never throws.
 */
export async function auditLedgerContinuity(): Promise<ContinuityAudit> {
	if (isHistorySealedOpaque()) {
		return { state: 'sealed-opaque', sealed: null, computed: null };
	}
	const sealed = await getSealedLedgerChain();
	const records = readBmiHistory();
	const computed = await computeLedgerChain(records);
	if (sealed === null) {
		return { state: 'unanchored', sealed: null, computed };
	}
	const ok = sealed.head === computed.head && sealed.length === computed.length;
	return { state: ok ? 'ok' : 'violated', sealed, computed };
}
