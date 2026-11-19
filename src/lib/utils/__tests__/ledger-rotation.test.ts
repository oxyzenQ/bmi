// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z9 - the rotation continuity battery.
//
// The gap this pins shut: enableEncryption() with a new passphrase used
// to clear the session first, so the witness tombstoned at the NEXT save
// (the blind window) and every value sealed under the old key became
// permanent-opaque (the lockout). Pinned here:
//   1. Unlocked rotation re-seals: every value sealed under the old key
//      opens under the NEW session with the same plaintext — no lockout.
//   2. Unlocked rotation re-anchors: the witness carries the NEW key
//      fingerprint and reproduces the verified records — no blind window
//      (the very first post-rotation save rides a verified witness).
//   3. A tampered ledger at rotation stays FROZEN: the witness keeps the
//      old fingerprint and its head (evidence preserved), the values
//      still re-seal (persistence is not blessing), and the audit reads
//      the state as witness-opaque, never violated.
//   4. A rotation while LOCKED keeps the honest route byte-identical:
//      the witness is untouched by the rotation itself and the sealed
//      values stay sealed (the purge guard still protects them).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Polyfill localStorage for @vitest-environment node (no DOM)
const lsStore = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => lsStore.get(k) ?? null,
	setItem: (k: string, v: string) => lsStore.set(k, String(v)),
	removeItem: (k: string) => lsStore.delete(k),
	clear: () => lsStore.clear()
});

// In-memory IndexedDB stand-in: the meta store (salt, verifier, witness)
// and the key-value store, so the full persistence stack runs.
const dbState = vi.hoisted(() => ({
	meta: new Map<string, string>(),
	kv: new Map<string, string>()
}));

vi.mock('../db', () => ({
	isIndexedDbAvailable: () => true,
	dbMetaGet: vi.fn(async (key: string) => dbState.meta.get(key) ?? null),
	dbMetaSet: vi.fn(async (key: string, value: string) => {
		dbState.meta.set(key, value);
		return undefined;
	}),
	dbSet: vi.fn(async (key: string, value: string) => {
		dbState.kv.set(key, value);
	}),
	dbRemove: vi.fn(async (key: string) => {
		dbState.kv.delete(key);
	}),
	dbGetAll: vi.fn(async () => Array.from(dbState.kv, ([key, value]) => ({ key, value }))),
	dbClose: vi.fn(),
	dbBackupSave: vi.fn(async (record: { data: string }) => {
		dbState.meta.set('__last_backup', record.data);
		return 1;
	}),
	dbBackupGetAll: vi.fn(async () => []),
	dbBackupLatest: vi.fn(async () => null),
	dbBackupDelete: vi.fn(async () => {})
}));

vi.mock('../app-version', () => ({
	getAppVersionRaw: () => '80.0.7'
}));

import { _resetAtRestStateForTesting, getAtRestSessionKey, isAtRestTagged } from '../at-rest-state';
import { _resetSealKeyForTesting } from '../seal-key';
import { _resetWitnessKeyForTesting, getWitnessKeyFingerprint } from '../witness-key';
import { isAtRestUnlocked } from '../at-rest';
import { disableEncryption, enableEncryption, getEncryptionStatus } from '../crypto';
import {
	STORAGE_KEYS,
	_resetIdbWriteSeqForTesting,
	_getIdbWriteQueue,
	storageGet,
	storageGetRaw,
	storageInvalidateAll,
	storageSet,
	setRestoreMode,
	initStorage
} from '../storage';
import { commitImportedRecords } from '../bmi-history';
import { toRecord } from '../history-io';
import { auditLedgerContinuity } from '../bmi-history';
import { _drainLedgerContinuityForTesting, META_LEDGER_CHAIN } from '../ledger-continuity';
import { parseWitnessRaw } from '../ledger-vault-anchor';

const PW_ONE = 'rotation passphrase one';
const PW_TWO = 'rotation passphrase two';

const HISTORY = STORAGE_KEYS.HISTORY;
const GOAL = STORAGE_KEYS.BMI_GOAL;

const HISTORY_RECORDS = [
	{ timestamp: 1_700_000_000_000, bmi: 22.5, height: 175, weight: 70, age: 30 },
	{ timestamp: 1_700_086_400_000, bmi: 23.1, height: 176, weight: 71 }
];
const HISTORY_JSON = JSON.stringify(HISTORY_RECORDS);

function sampleGoal(): string {
	return JSON.stringify({ targetBmi: 22.4 });
}

/** Simulate the cold locked load: the volatile session and cache are gone. */
function coldLockedLoad(): void {
	_resetSealKeyForTesting(getAtRestSessionKey());
	_resetAtRestStateForTesting();
	_resetWitnessKeyForTesting();
	storageInvalidateAll();
}

/** Wait until the mirror carries the sealed envelope, then drain the queues
 * (the seal promise may still be in flight after the commit returns — the
 * same determinism law the at-rest battery's awaitSealed follows). */
async function awaitSealedEnvelope(key: string): Promise<string> {
	await vi.waitFor(() => expect(isAtRestTagged(lsStore.get(key) ?? null)).toBe(true), {
		timeout: 8000,
		interval: 50
	});
	await _getIdbWriteQueue(key);
	await _drainLedgerContinuityForTesting();
	return lsStore.get(key)!;
}

beforeEach(() => {
	coldLockedLoad();
	_resetIdbWriteSeqForTesting();
	setRestoreMode(false);
	dbState.meta.clear();
	dbState.kv.clear();
	lsStore.clear();
	initStorage();
});

describe('unlocked rotation re-seals the ledger (night-frontier-Z9)', () => {
	it('values sealed under the old key open under the new session (no lockout)', async () => {
		await enableEncryption(PW_ONE);
		await commitImportedRecords(HISTORY_RECORDS.map((r) => toRecord(r)));
		await awaitSealedEnvelope(HISTORY);
		storageSet(GOAL, sampleGoal(), { skipBackup: true });
		await awaitSealedEnvelope(GOAL);
		// Sealed at rest in both persistence layers, plaintext in cache.
		expect(isAtRestTagged(lsStore.get(HISTORY) ?? null)).toBe(true);
		expect(isAtRestTagged(lsStore.get(GOAL) ?? null)).toBe(true);
		const oldHistoryEnvelope = lsStore.get(HISTORY);
		const oldGoalEnvelope = lsStore.get(GOAL);

		const rotated = await enableEncryption(PW_TWO);
		expect(rotated).toBe(true);
		expect(isAtRestUnlocked()).toBe(true);
		// Wait for the RE-SEAL to land: the mirror must carry a NEW envelope
		// (the old one is tagged too — sameness is the assertion here).
		await vi.waitFor(
			() => {
				expect(lsStore.get(HISTORY)).not.toBe(oldHistoryEnvelope);
				expect(lsStore.get(GOAL)).not.toBe(oldGoalEnvelope);
			},
			{ timeout: 8000, interval: 50 }
		);
		await awaitSealedEnvelope(HISTORY);
		await awaitSealedEnvelope(GOAL);
		expect(isAtRestTagged(lsStore.get(HISTORY) ?? null)).toBe(true);
		expect(dbState.kv.get(HISTORY)).toBe(lsStore.get(HISTORY));
		expect(storageGet(HISTORY)).toBe(HISTORY_JSON);
		expect(storageGet(GOAL)).toBe(sampleGoal());
	});

	it('the witness re-anchors under the new key in the rotation section itself', async () => {
		await enableEncryption(PW_ONE);
		await commitImportedRecords(HISTORY_RECORDS.map((r) => toRecord(r)));
		await awaitSealedEnvelope(HISTORY);
		const oldKf = getWitnessKeyFingerprint();
		expect(oldKf).not.toBeNull();

		await enableEncryption(PW_TWO);
		await awaitSealedEnvelope(HISTORY);

		// The witness is keyed by the NEW key and reproduces the records —
		// verified during the rotation, re-anchored in the same section.
		const sealed = parseWitnessRaw(dbState.meta.get(META_LEDGER_CHAIN) ?? '');
		expect(sealed).not.toBeNull();
		expect(sealed!.mode).toBe('keyed');
		expect(sealed!.kf).toBe(getWitnessKeyFingerprint());
		expect(sealed!.kf).not.toBe(oldKf);
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('ok');
		expect(audit.computed!.length).toBe(2);
	});

	it('a tampered ledger at rotation stays frozen; values still re-seal', async () => {
		await enableEncryption(PW_ONE);
		await commitImportedRecords(HISTORY_RECORDS.map((r) => toRecord(r)));
		await awaitSealedEnvelope(HISTORY);
		const frozenWitness = dbState.meta.get(META_LEDGER_CHAIN);
		const frozen = parseWitnessRaw(frozenWitness ?? '');
		expect(frozen!.mode).toBe('keyed');

		// The tamper model: an out-of-band same-length rewrite — the meta
		// witness is restored to the PRE-tamper anchor so the rotation faces
		// exactly the divergence the freeze rule exists for.
		const tampered = JSON.stringify([
			{ timestamp: 1_700_000_000_000, bmi: 99.9, height: 175, weight: 70, age: 30 },
			{ timestamp: 1_700_086_400_000, bmi: 23.1, height: 176, weight: 71 }
		]);
		lsStore.set(HISTORY, tampered);
		dbState.kv.set(HISTORY, tampered);
		storageInvalidateAll();
		dbState.meta.set(META_LEDGER_CHAIN, frozenWitness!);

		const rotated = await enableEncryption(PW_TWO);
		expect(rotated).toBe(true);
		await awaitSealedEnvelope(HISTORY);

		// The freeze rule, untouched by rotation: the witness keeps the OLD
		// fingerprint and its verified head — evidence, not tombstone.
		expect(parseWitnessRaw(dbState.meta.get(META_LEDGER_CHAIN) ?? '')).toEqual(frozen);
		// Persistence is not blessing: the values still re-sealed under the
		// new key (the user keeps access to their own data).
		expect(storageGet(HISTORY)).toBe(tampered);
		expect(isAtRestTagged(lsStore.get(HISTORY) ?? null)).toBe(true);
		// The audit reads the frozen witness under the new key honestly:
		// witness-opaque (it can neither bless nor accuse what it cannot
		// attest), never violated.
		const audit = await auditLedgerContinuity();
		expect(audit.state).toBe('witness-opaque');
	});

	it('a rotation while LOCKED keeps the honest route byte-identical', async () => {
		await enableEncryption(PW_ONE);
		await commitImportedRecords(HISTORY_RECORDS.map((r) => toRecord(r)));
		await awaitSealedEnvelope(HISTORY);
		const preRotationWitness = dbState.meta.get(META_LEDGER_CHAIN);
		const preRotationEnvelope = lsStore.get(HISTORY);

		// Cold reload: the volatile session dies, the ledger locks.
		coldLockedLoad();
		expect(isAtRestUnlocked()).toBe(false);

		// Rotation from the locked state: enableEncryption registers the NEW
		// passphrase session. The witness is UNTOUCHED by the rotation
		// itself (no tombstone before a save observes the rotation), and
		// the old sealed envelope stays sealed — the purge guard protects
		// it; the audit cannot measure through it (sealed-opaque).
		const rotated = await enableEncryption(PW_TWO);
		expect(rotated).toBe(true);
		await awaitSealedEnvelope(HISTORY);
		expect(dbState.meta.get(META_LEDGER_CHAIN)).toBe(preRotationWitness);
		expect(storageGetRaw(HISTORY)).toBe(preRotationEnvelope);
		const status = await getEncryptionStatus();
		expect(status.hasPassphrase).toBe(true);
	});

	it('disableEncryption still locks the session with sealed values intact', async () => {
		await enableEncryption(PW_ONE);
		await commitImportedRecords(HISTORY_RECORDS.map((r) => toRecord(r)));
		await awaitSealedEnvelope(HISTORY);
		const sealedEnvelope = lsStore.get(HISTORY);
		expect(isAtRestTagged(sealedEnvelope ?? null)).toBe(true);

		await disableEncryption();
		// The cold-load view (clearAtRestSession leaves the warm cache; the
		// locked semantics live at the next load): the sealed envelope is
		// intact, the plaintext reads as missing.
		storageInvalidateAll();
		expect(isAtRestUnlocked()).toBe(false);
		expect(storageGet(HISTORY)).toBeNull();
		expect(storageGetRaw(HISTORY)).toBe(sealedEnvelope);
	});
});
