// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * Synchronous state leaf for the at-rest ledger seal.
 *
 * This module is a leaf: it imports nothing at runtime, so storage.ts
 * can read the at-rest state synchronously on every read/write without
 * creating a dependency cycle with crypto.ts or at-rest.ts.
 *
 * It carries three pieces of state:
 *   1. The session key seat - where the AES-256-GCM seal key lives while
 *      an unlocked session is active (night-frontier-Z8). The engine
 *      custody holds an opaque slot handle inside the wasm engine (the
 *      material never travels back through the ABI and the lock wipe is
 *      provable); the WebCrypto fallback holds a non-extractable key
 *      whose physics stay documented (released to GC at lock). It is
 *      never persisted anywhere.
 *   2. The health-key scope - exactly the storage keys whose values hold
 *      health data (history, goal, goal baseline). Preferences never seal.
 *   3. Per-key mirror sequence numbers - so the async sealing path can
 *      only ever write the latest value into the localStorage mirror,
 *      keeping the mirror consistent with the IndexedDB truth.
 */

// ── Sealed value tag ──
// Sealed values are stored as TAG + base64(JSON envelope). The ':' cannot
// appear inside a base64 payload, so the prefix check is unambiguous.
export const AT_REST_TAG = 'bmi-at-rest-v1:';

/**
 * The storage keys whose values hold health data and therefore seal at
 * rest when an unlocked session is active. Must stay in sync with
 * STORAGE_KEYS in storage.ts — a dedicated drift-guard test pins this.
 */
const AT_REST_HEALTH_KEYS: ReadonlySet<string> = new Set([
	'bmi.history',
	'bmi.goal',
	'bmi.goal.start'
]);

/** True when a raw storage value carries the at-rest seal tag.
 * Type guard: narrows the value to a string after the check. */
export function isAtRestTagged(raw: string | null | undefined): raw is string {
	return typeof raw === 'string' && raw.startsWith(AT_REST_TAG);
}

/** True when the key is inside the at-rest health-data scope. */
export function isAtRestHealthKey(key: string): boolean {
	return AT_REST_HEALTH_KEYS.has(key);
}

/** The health keys the at-rest seal covers, for diagnostics and tests. */
export function getAtRestHealthKeys(): string[] {
	return [...AT_REST_HEALTH_KEYS];
}

// ── Session key seat ──
// Volatile by design: the seat exists only while an unlocked session is
// active and dies with the tab. There is deliberately no persistence
// path — a sealed ledger stays sealed on cold load until the passphrase
// is presented again through an existing flow.
//
// The seat kinds (night-frontier-Z8):
//   - engine: the material sits in an opaque keystore slot inside the
//     wasm engine (seal-key.ts drives it; the raw bytes never return
//     through the ABI and the wipe self-reports all-zero).
//   - webcrypto: the documented fallback physics - a non-extractable
//     CryptoKey whose material no WebCrypto API can actively zero;
//     dropping the last reference releases it to GC.
export type AtRestSealKey =
	{ custody: 'engine'; handle: number } | { custody: 'webcrypto'; key: CryptoKey };

let _sessionKey: AtRestSealKey | null = null;

/** Install the derived session key seat (called after a successful unlock). */
export function setAtRestSessionKey(key: AtRestSealKey): void {
	_sessionKey = key;
}

/** Drop the session seat reference. The engine custody wipe runs BEFORE
 * this drop (at-rest.ts owns that order); in the webcrypto fallback the
 * dropped reference is the only zeroization physics there is. */
export function clearAtRestSessionKey(): void {
	_sessionKey = null;
}

/** True while an unlocked session is active. */
export function isAtRestSessionUnlocked(): boolean {
	return _sessionKey !== null;
}

/**
 * Read the session key seat. Returns null while locked. Only at-rest.ts
 * consumes this; storage.ts and the UI never see the seat.
 */
export function getAtRestSessionKey(): AtRestSealKey | null {
	return _sessionKey;
}

/**
 * Decide whether a write to this key must be sealed at rest.
 * True only when an unlocked session is active AND the key holds
 * health data. Restore mode is decided by storage.ts, not here.
 */
export function shouldProtectAtRest(key: string): boolean {
	return isAtRestHealthKey(key) && _sessionKey !== null;
}

// ── Mirror write ordering ──
// Sealing is asynchronous, so two rapid storageSet() calls can finish
// encrypting out of call order. The sequence token is taken synchronously
// at call time (guaranteed order) and checked before each mirror write,
// so the localStorage mirror always ends on the latest value even when
// IndexedDB ordering is enforced separately by the write queue.
const _mirrorSeq = new Map<string, number>();

/** Take the next mirror sequence token for a key (synchronous, ordered). */
export function nextAtRestMirrorSeq(key: string): number {
	const seq = (_mirrorSeq.get(key) ?? 0) + 1;
	_mirrorSeq.set(key, seq);
	return seq;
}

/** True when this sequence token is still the latest for the key. */
export function isLatestAtRestMirrorSeq(key: string, seq: number): boolean {
	return _mirrorSeq.get(key) === seq;
}

/**
 * Internal test-only reset. Must be called between tests to avoid
 * cross-test pollution of the session slot and sequence tokens.
 */
export function _resetAtRestStateForTesting(): void {
	_sessionKey = null;
	_mirrorSeq.clear();
}
