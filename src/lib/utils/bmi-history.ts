// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
import { browser } from '$app/environment';
import { STORAGE_KEYS, storageGetJSON, storageSet, storageSetJSON } from './storage';
import { isValidRecord, toRecord } from './history-io';
import {
	computeWitnessChain,
	getSealedLedgerChain,
	isHistorySealedOpaque,
	reseatLedgerChainAfterSave,
	sealLedgerChain
} from './ledger-continuity';
import { getWitnessKeyFingerprint, getWitnessMac } from './witness-key';
import { withLedgerLock } from './ledger-lock';
import { refreshHealthKeysFromMirror } from './storage-coherence';
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

// night-frontier-Z5: the single-writer law. Every legit ledger write
// (save, import, restore, clear) holds the origin-wide ledger lock as
// one critical section: freshness refresh, validated read, merge,
// mirror write, and the witness reseat/seal drain. Inside the section
// the pre-state can never go stale, so the reseat blessing observes
// exactly the state the lock ordered.
let lastLedgerWrite: Promise<void> = Promise.resolve();

/** @internal Test-only: resolve when the last save's locked section drained. */
export function _drainLedgerWritesForTesting(): Promise<void> {
	return lastLedgerWrite;
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

	// Validated read + merge inside the locked section: the merge base is
	// always the freshest cross-tab state, never this realm's stale cache.
	const write = withLedgerLock(async () => {
		await refreshHealthKeysFromMirror();
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
		// of silently re-anchoring tampered content. The reseat drains inside
		// the section, so the lock release and the witness advance are one
		// ordered step cross-tab.
		await reseatLedgerChainAfterSave(history, filtered);
	});
	const settled = write.catch((err) => {
		warnDev(
			'bmi-history',
			'saveBmiToHistory',
			'Ledger write failed — the witness degrades honestly',
			err
		);
	});
	lastLedgerWrite = settled;
	void settled;

	// The signature returns synchronously: the caller's dedupe contract
	// is unchanged, only the merge moved under the lock.
	return historySignature;
}

/**
 * The import commit (night-frontier-Z5): freshness, the overwrite, and
 * the witness re-anchor travel under the ledger lock as one critical
 * section, so a concurrent legit save in another tab can never
 * interleave between the overwrite and the re-anchor. history-io
 * delegates its final write here through a dynamic import — this module
 * sits below history-io in the dependency graph and must never point
 * back at it statically.
 */
export async function commitImportedRecords(records: BmiRecord[]): Promise<boolean> {
	return withLedgerLock(async () => {
		await refreshHealthKeysFromMirror();
		const ok = storageSet(STORAGE_KEYS.HISTORY, JSON.stringify(records), { skipBackup: true });
		await sealLedgerChain(records);
		return ok;
	});
}

// ── Continuity audit (night-frontier-Z3) ──

export type ContinuityState = 'ok' | 'violated' | 'unanchored' | 'sealed-opaque' | 'witness-opaque';

export interface ContinuityAudit {
	state: ContinuityState;
	/** The sealed witness, when one exists and was readable. */
	sealed: { head: string; length: number; mode?: 'keyed'; kf?: string } | null;
	/** The chain recomputed from the validated records. */
	computed: { head: string; length: number } | null;
}

/**
 * Measure the ledger continuity: recompute the chain over the validated
 * records and compare it with the sealed witness.
 *
 *   ok             — the recomputed head matches the sealed witness
 *   violated       — a witness exists and disagrees with the records:
 *                    the history changed outside a legit write path
 *   unanchored     — no witness exists (fresh device, degraded seal, or
 *                    pre-Z3 data waiting for its first legit write)
 *   sealed-opaque  — the history is an at-rest envelope and the session
 *                    is locked; continuity cannot be measured through a
 *                    sealed value and must never be misread as tampered
 *   witness-opaque — a keyed witness (night-frontier-Z6) exists but the
 *                    attestation key is unavailable in this session
 *                    (locked edge, passphrase rotation): the witness can
 *                    neither bless nor accuse, and must never be misread
 *                    as violated by a recomputation the seal never ran
 *
 * Never throws.
 */
export async function auditLedgerContinuity(): Promise<ContinuityAudit> {
	if (isHistorySealedOpaque()) {
		return { state: 'sealed-opaque', sealed: null, computed: null };
	}
	const sealed = await getSealedLedgerChain();
	// Night-frontier-Z6: a keyed witness recomputes ONLY under its own
	// attestation key. Without it (or under a rotated key) the honest
	// answer is that continuity cannot be measured - not a violation.
	if (sealed?.mode === 'keyed') {
		const kf = getWitnessKeyFingerprint();
		if (!getWitnessMac() || kf !== sealed.kf) {
			return { state: 'witness-opaque', sealed, computed: null };
		}
	}
	const records = readBmiHistory();
	const computed = await computeWitnessChain(records, sealed?.mode === 'keyed' ? 'keyed' : 'plain');
	if (sealed === null) {
		return { state: 'unanchored', sealed: null, computed };
	}
	const ok = sealed.head === computed.head && sealed.length === computed.length;
	return { state: ok ? 'ok' : 'violated', sealed, computed };
}
