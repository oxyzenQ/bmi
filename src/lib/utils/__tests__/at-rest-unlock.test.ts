// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

//
// Cold-load unlock door suite (night-cafe-10).
//
// Pins the strand detector: an unlocked session never opens the door,
// sealed health data under a locked session does, plaintext never
// does, and non-health keys are ignored even when tagged. The attempt
// helper is a verified passthrough - proving is registering, and the
// door never bypasses the verifier.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../crypto', () => ({
	unlockAtRestSessionIfVerified: vi.fn(async (passphrase: string) => passphrase === 'right')
}));

vi.mock('../at-rest', () => ({
	isAtRestUnlocked: vi.fn(() => false)
}));

vi.mock('../storage', () => ({
	STORAGE_KEYS: {
		HISTORY: 'bmi.history',
		BMI_GOAL: 'bmi.goal',
		LOCALE: 'bmi.locale'
	},
	storageGetRaw: vi.fn(() => null)
}));

import { attemptLedgerUnlock, detectLockedSealedLedger } from '../at-rest-unlock';
import { unlockAtRestSessionIfVerified } from '../crypto';
import { isAtRestUnlocked } from '../at-rest';
import { storageGetRaw } from '../storage';

const KEYS = ['bmi.history', 'bmi.goal', 'bmi.locale'];

beforeEach(() => {
	vi.mocked(isAtRestUnlocked).mockReturnValue(false);
	vi.mocked(storageGetRaw).mockReturnValue(null);
});

describe('detectLockedSealedLedger', () => {
	it('opens the door when sealed health data exists under a locked session', () => {
		vi.mocked(storageGetRaw).mockImplementation((key) =>
			key === 'bmi.history' ? 'bmi-at-rest-v1:sealed' : null
		);
		expect(detectLockedSealedLedger(KEYS)).toBe(true);
	});

	it('never opens for an unlocked session', () => {
		vi.mocked(isAtRestUnlocked).mockReturnValue(true);
		vi.mocked(storageGetRaw).mockReturnValue('bmi-at-rest-v1:sealed');
		expect(detectLockedSealedLedger(KEYS)).toBe(false);
	});

	it('never opens for a plaintext ledger', () => {
		vi.mocked(storageGetRaw).mockImplementation((key) =>
			key === 'bmi.history' ? '[{"timestamp":1}]' : null
		);
		expect(detectLockedSealedLedger(KEYS)).toBe(false);
	});

	it('ignores tagged non-health keys', () => {
		vi.mocked(storageGetRaw).mockImplementation((key) =>
			key === 'bmi.locale' ? 'bmi-at-rest-v1:stray' : null
		);
		expect(detectLockedSealedLedger(KEYS)).toBe(false);
	});

	it('stays shut when nothing is stored', () => {
		expect(detectLockedSealedLedger(KEYS)).toBe(false);
	});
});

describe('attemptLedgerUnlock', () => {
	it('passes the proven passphrase through and reports success', async () => {
		await expect(attemptLedgerUnlock('right')).resolves.toBe(true);
		expect(unlockAtRestSessionIfVerified).toHaveBeenCalledWith('right');
	});

	it('keeps the ledger locked when the proof fails', async () => {
		await expect(attemptLedgerUnlock('wrong')).resolves.toBe(false);
		expect(unlockAtRestSessionIfVerified).toHaveBeenCalledWith('wrong');
	});
});
