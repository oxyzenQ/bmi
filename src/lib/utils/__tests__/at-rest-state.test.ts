// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Unit tests for the at-rest state leaf (at-rest-state.ts): tag
// detection, the health-key scope with its STORAGE_KEYS drift guard,
// the session-key predicate, and the mirror sequence tokens.

import { describe, it, expect, beforeEach } from 'vitest';

import {
	AT_REST_TAG,
	_resetAtRestStateForTesting,
	getAtRestHealthKeys,
	isAtRestHealthKey,
	isAtRestTagged,
	isLatestAtRestMirrorSeq,
	nextAtRestMirrorSeq,
	setAtRestSessionKey,
	shouldProtectAtRest
} from '../at-rest-state';
import { STORAGE_KEYS } from '../storage';
import { _resetWitnessKeyForTesting } from '../witness-key';

const HISTORY = STORAGE_KEYS.HISTORY;
const GOAL = STORAGE_KEYS.BMI_GOAL;
const GOAL_START = STORAGE_KEYS.BMI_GOAL_START;
const LOCALE = STORAGE_KEYS.LOCALE;

beforeEach(() => {
	_resetAtRestStateForTesting();
	_resetWitnessKeyForTesting();
});

describe('at-rest state leaf', () => {
	it('detects the seal tag and rejects lookalikes', () => {
		expect(isAtRestTagged(AT_REST_TAG + 'aGVsbG8=')).toBe(true);
		expect(isAtRestTagged('bmi-at-rest-v2:YWJjZA==')).toBe(false);
		expect(isAtRestTagged(' bmi-at-rest-v1:YWJjZA==')).toBe(false);
		expect(isAtRestTagged('BMI-AT-REST-V1:YWJjZA==')).toBe(false);
		expect(isAtRestTagged('bmi-at-rest-v1')).toBe(false);
		expect(isAtRestTagged('plain json')).toBe(false);
		expect(isAtRestTagged(null)).toBe(false);
		expect(isAtRestTagged(undefined)).toBe(false);
		expect(isAtRestTagged('')).toBe(false);
	});

	it('scopes sealing to exactly the health keys from STORAGE_KEYS', () => {
		expect(isAtRestHealthKey(HISTORY)).toBe(true);
		expect(isAtRestHealthKey(GOAL)).toBe(true);
		expect(isAtRestHealthKey(GOAL_START)).toBe(true);
		expect(isAtRestHealthKey(LOCALE)).toBe(false);
		expect(isAtRestHealthKey(STORAGE_KEYS.UNIT_SYSTEM)).toBe(false);
		expect(isAtRestHealthKey(STORAGE_KEYS.WALLPAPER_THEME)).toBe(false);
		expect(isAtRestHealthKey(STORAGE_KEYS.PASSPHRASE_HINT)).toBe(false);
		// Drift guard: the literal set must match the storage registry.
		const healthKeys = getAtRestHealthKeys().sort();
		expect(healthKeys).toEqual([GOAL, GOAL_START, HISTORY].sort());
		for (const key of healthKeys) {
			expect(Object.values(STORAGE_KEYS)).toContain(key);
		}
	});

	it('protects health keys only while a session key is installed', () => {
		expect(shouldProtectAtRest(HISTORY)).toBe(false);
		setAtRestSessionKey({} as CryptoKey);
		expect(shouldProtectAtRest(HISTORY)).toBe(true);
		expect(shouldProtectAtRest(LOCALE)).toBe(false);
	});

	it('orders mirror writes through sequence tokens', () => {
		expect(nextAtRestMirrorSeq('k')).toBe(1);
		expect(nextAtRestMirrorSeq('k')).toBe(2);
		expect(isLatestAtRestMirrorSeq('k', 2)).toBe(true);
		expect(isLatestAtRestMirrorSeq('k', 1)).toBe(false);
		expect(isLatestAtRestMirrorSeq('other', 1)).toBe(false);
	});
});
