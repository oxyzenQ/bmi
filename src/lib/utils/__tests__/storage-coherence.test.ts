// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

//
// night-frontier-Z5 — the cross-tab storage coherence battery.
//
// Proves, in order of severity:
//   1. Foreign-tab health-key writes drop this realm's cache entry, so
//      the next read sees the mirror (the stale pre-state is exactly
//      what poisoned the continuity reseat blessing pre-Z5).
//   2. Presentation keys stay untouched — the unit-system listener in
//      the page owns that state, this leaf never widens its scope.
//   3. A foreign clear (key === null) invalidates every health key.
//   4. A sealed mirror stays sealed under a locked session: locked
//      reads stay null, the raw envelope stays invisible-but-intact.
//   5. refreshHealthKeysFromMirror is the deterministic door: called
//      directly, it re-reads the mirror without waiting for an event.
//   6. The unsubscribe stops the invalidation.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installForeignTabCoherence, refreshHealthKeysFromMirror } from '../storage-coherence';
import {
	STORAGE_KEYS,
	storageGet,
	storageGetRaw,
	storageSet,
	storageInvalidateAll
} from '../storage';
import { AT_REST_TAG } from '../at-rest-state';

const HISTORY = STORAGE_KEYS.HISTORY;
const GOAL = STORAGE_KEYS.BMI_GOAL;
const GOAL_START = STORAGE_KEYS.BMI_GOAL_START;
const UNIT = STORAGE_KEYS.UNIT_SYSTEM;

function dispatchForeignStorageEvent(key: string | null): void {
	// The legacy event-construction route, deliberately. CodeQL resolves
	// the modern `new StorageEvent(type, initDict)` to a parameterless
	// ambient constructor — proven against the exact 2.27.4 bundle with a
	// minimal repro (MessageEvent resolves fine, StorageEvent does not) —
	// so the two-argument form can never pass that analysis, and the
	// inline suppression comment does not honor this query. This route is
	// the spec's own construction API with identical listener semantics —
	// proven under jsdom for parity against the constructor, and this
	// battery itself proves the coherence listener reads event.key from it.
	const event = document.createEvent('StorageEvent');
	event.initStorageEvent(
		'storage',
		false,
		false,
		key,
		null,
		'foreign-write',
		window.location.origin,
		null
	);
	window.dispatchEvent(event);
}

let uninstall: (() => void) | null = null;

beforeEach(() => {
	localStorage.clear();
	storageInvalidateAll();
	uninstall = installForeignTabCoherence();
});

afterEach(() => {
	uninstall?.();
	uninstall = null;
	storageInvalidateAll();
});

describe('installForeignTabCoherence', () => {
	it('invalidates a foreign-tab health key so the next read sees the mirror', () => {
		storageSet(HISTORY, 'cached-value');
		expect(storageGetRaw(HISTORY)).toBe('cached-value');
		// A foreign tab writes through its own realm: only the mirror moves.
		localStorage.setItem(HISTORY, 'foreign-value');
		dispatchForeignStorageEvent(HISTORY);
		expect(storageGetRaw(HISTORY)).toBe('foreign-value');
	});

	it('ignores non-health keys — presentation state has its own listener', () => {
		storageSet(UNIT, 'imperial');
		localStorage.setItem(UNIT, 'metric');
		dispatchForeignStorageEvent(UNIT);
		expect(storageGetRaw(UNIT)).toBe('imperial');
	});

	it('a foreign clear (null key) invalidates every health key', () => {
		storageSet(HISTORY, 'h');
		storageSet(GOAL, 'g');
		storageSet(GOAL_START, 's');
		localStorage.setItem(HISTORY, 'h2');
		localStorage.setItem(GOAL, 'g2');
		localStorage.setItem(GOAL_START, 's2');
		dispatchForeignStorageEvent(null);
		expect(storageGetRaw(HISTORY)).toBe('h2');
		expect(storageGetRaw(GOAL)).toBe('g2');
		expect(storageGetRaw(GOAL_START)).toBe('s2');
	});

	it('a sealed mirror stays sealed for a locked session', () => {
		const envelope = AT_REST_TAG + 'c2VhbGVkLWxlZGdlci1ob25lc3Q';
		localStorage.setItem(HISTORY, envelope);
		dispatchForeignStorageEvent(HISTORY);
		// Locked-read semantics: the sealed value is missing, never plaintext.
		expect(storageGet(HISTORY)).toBeNull();
		// Raw honesty: the envelope itself survives, never destroyed.
		expect(storageGetRaw(HISTORY)).toBe(envelope);
	});

	it('the unsubscribe stops the invalidation', () => {
		uninstall?.();
		uninstall = null;
		storageSet(HISTORY, 'cached-value');
		localStorage.setItem(HISTORY, 'foreign-value');
		dispatchForeignStorageEvent(HISTORY);
		expect(storageGetRaw(HISTORY)).toBe('cached-value');
	});
});

describe('refreshHealthKeysFromMirror (the deterministic door)', () => {
	it('re-reads the mirror without waiting for a storage event', async () => {
		uninstall?.();
		uninstall = null;
		storageSet(HISTORY, 'cached-value');
		localStorage.setItem(HISTORY, 'mirror-value');
		await refreshHealthKeysFromMirror();
		expect(storageGetRaw(HISTORY)).toBe('mirror-value');
	});

	it('keeps the goal keys fresh alongside the history', async () => {
		storageSet(GOAL, 'cached-goal');
		localStorage.setItem(GOAL, 'mirror-goal');
		await refreshHealthKeysFromMirror();
		expect(storageGetRaw(GOAL)).toBe('mirror-goal');
	});
});
