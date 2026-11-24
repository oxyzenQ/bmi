// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The at-rest decision theorem (night-netrunner-Z2, the for-all tier).
 *
 * Law: the at-rest state leaf is the total decision table the custody
 * arc states, for EVERY input in the stated finite domains:
 *   (1) the seal decision: shouldProtectAtRest(key) is true iff key is
 *       exactly one of the health keys AND an unlocked session is
 *       active - verified over the full product of the named key set,
 *       a hostile near-miss corpus, and all three custody states
 *       (locked, engine seat, webcrypto seat);
 *   (2) the tag guard: isAtRestTagged is true iff the raw value starts
 *       exactly with the versioned tag - verified over the hostile
 *       string corpus (prefix without colon, uppercase mutation,
 *       leading space, wrong types);
 *   (3) the seat laws: the session slot round-trips the installed seat
 *       identity, reads null while locked, and reads null after clear -
 *       for both seat kinds;
 *   (4) the mirror sequence laws: tokens are strictly increasing by
 *       one per key, only the latest token is the latest, keys are
 *       independent, and unknown keys hold nothing.
 *
 * The seal decision is the last gate before a health value lands in the
 * mirror; every row of its truth table is machine-checked here.
 */

import { describe, expect, it } from 'vitest';
import {
	AT_REST_TAG,
	_resetAtRestStateForTesting,
	clearAtRestSessionKey,
	getAtRestHealthKeys,
	getAtRestSessionKey,
	isAtRestHealthKey,
	isAtRestSessionUnlocked,
	isAtRestTagged,
	isLatestAtRestMirrorSeq,
	nextAtRestMirrorSeq,
	setAtRestSessionKey,
	shouldProtectAtRest
} from '../src/lib/utils/at-rest-state';

/** The hostile near-miss corpus: mutations of the health keys that must not seal. */
const HOSTILE_KEYS = [
	'',
	'bmi.historyx',
	'bmi.HISTORY',
	'bmi.History',
	'BMI.history',
	'bmi.history ',
	' bmi.history',
	'bmi.goalx',
	'bmi.goal.startX',
	'bmi.history.',
	'bmi.locale',
	'bmi.wallpaperTheme',
	'bmi.passphrase_hint',
	'bmi.history\n',
	'bmi.history\u0000'
];

/** The custody states the seat can be observed in. */
type CustodyState = { name: string; install: () => void };

const CUSTODY_STATES: CustodyState[] = [
	{ name: 'locked (no seat)', install: () => clearAtRestSessionKey() },
	{
		name: 'engine seat',
		install: () => setAtRestSessionKey({ custody: 'engine', handle: 7 })
	},
	{
		name: 'webcrypto seat',
		install: () => setAtRestSessionKey({ custody: 'webcrypto', key: {} as unknown as CryptoKey })
	}
];

describe('the at-rest seal decision theorem (for-all over keys x custody states)', () => {
	it('seals exactly the health keys, only while a session is active', () => {
		const healthKeys = getAtRestHealthKeys();
		for (const state of CUSTODY_STATES) {
			state.install();
			const active = isAtRestSessionUnlocked();
			for (const key of healthKeys) {
				expect(shouldProtectAtRest(key)).toBe(active);
			}
			for (const key of HOSTILE_KEYS) {
				expect(shouldProtectAtRest(key)).toBe(false);
			}
		}
	});

	it('holds the scope consistency law (the readonly set and the accessor agree)', () => {
		for (const key of getAtRestHealthKeys()) {
			expect(isAtRestHealthKey(key)).toBe(true);
		}
		for (const key of HOSTILE_KEYS) {
			expect(isAtRestHealthKey(key)).toBe(false);
		}
	});
});

describe('the at-rest tag guard theorem (for-all over the hostile corpus)', () => {
	it('accepts only values starting exactly with the versioned tag', () => {
		expect(isAtRestTagged(AT_REST_TAG)).toBe(true);
		expect(isAtRestTagged(`${AT_REST_TAG}eyJhbGciOiJIUjI1NiJ9`)).toBe(true);
		expect(isAtRestTagged('bmi-at-rest-v1')).toBe(false);
		expect(isAtRestTagged('BMI-AT-REST-V1:x')).toBe(false);
		expect(isAtRestTagged('bmi-at-rest-v2:x')).toBe(false);
		expect(isAtRestTagged(` ${AT_REST_TAG}x`)).toBe(false);
		expect(isAtRestTagged('')).toBe(false);
		expect(isAtRestTagged(null)).toBe(false);
		expect(isAtRestTagged(undefined)).toBe(false);
	});

	it('narrows the type only when the guard holds (the guard is the contract)', () => {
		const raw: string | null = `${AT_REST_TAG}payload`;
		if (isAtRestTagged(raw)) {
			expect(typeof raw).toBe('string');
		} else {
			expect.unreachable('a tagged value must narrow');
		}
	});
});

describe('the session seat laws (for-all over seat kinds)', () => {
	it('round-trips the seat identity, reads null while locked, null after clear', () => {
		_resetAtRestStateForTesting();
		expect(isAtRestSessionUnlocked()).toBe(false);
		expect(getAtRestSessionKey()).toBeNull();

		const engineSeat = { custody: 'engine', handle: 42 } as const;
		setAtRestSessionKey(engineSeat);
		expect(isAtRestSessionUnlocked()).toBe(true);
		expect(getAtRestSessionKey()).toBe(engineSeat);
		clearAtRestSessionKey();
		expect(getAtRestSessionKey()).toBeNull();
		expect(isAtRestSessionUnlocked()).toBe(false);

		const webcryptoSeat = {
			custody: 'webcrypto',
			key: {} as unknown as CryptoKey
		} as const;
		setAtRestSessionKey(webcryptoSeat);
		expect(getAtRestSessionKey()).toBe(webcryptoSeat);
		clearAtRestSessionKey();
		expect(getAtRestSessionKey()).toBeNull();
	});

	it('replaces an installed seat wholesale (no stale seat survives re-install)', () => {
		_resetAtRestStateForTesting();
		const first = { custody: 'engine', handle: 1 } as const;
		const second = { custody: 'engine', handle: 2 } as const;
		setAtRestSessionKey(first);
		setAtRestSessionKey(second);
		expect(getAtRestSessionKey()).toBe(second);
		_resetAtRestStateForTesting();
	});
});

describe('the mirror sequence laws (for-all over 1000 takes x 2 keys)', () => {
	it('issues strictly increasing tokens, latest only, keys independent', () => {
		_resetAtRestStateForTesting();
		const seqsA: number[] = [];
		const seqsB: number[] = [];
		for (let i = 0; i < 1000; i++) {
			seqsA.push(nextAtRestMirrorSeq('bmi.history'));
			if (i % 2 === 0) seqsB.push(nextAtRestMirrorSeq('bmi.goal'));
		}
		for (let i = 1; i < seqsA.length; i++) {
			expect(seqsA[i]).toBe(seqsA[i - 1] + 1);
		}
		for (let i = 1; i < seqsB.length; i++) {
			expect(seqsB[i]).toBe(seqsB[i - 1] + 1);
		}
		for (const seq of seqsA) {
			expect(isLatestAtRestMirrorSeq('bmi.history', seq)).toBe(seq === seqsA[seqsA.length - 1]);
		}
		expect(isLatestAtRestMirrorSeq('bmi.history', 0)).toBe(false);
		expect(isLatestAtRestMirrorSeq('bmi.unknown', 1)).toBe(false);
		expect(isLatestAtRestMirrorSeq('bmi.history', seqsB[0])).toBe(false);
	});

	it('restarts the ladder from one after a reset (the reset is total)', () => {
		_resetAtRestStateForTesting();
		expect(nextAtRestMirrorSeq('bmi.history')).toBe(1);
		nextAtRestMirrorSeq('bmi.history');
		_resetAtRestStateForTesting();
		expect(nextAtRestMirrorSeq('bmi.history')).toBe(1);
	});
});
