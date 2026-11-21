// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The seal key custody seat (night-frontier-Z8).
 *
 * The at-rest session seal key used to live ONLY as a non-extractable
 * CryptoKey - a volatile handle whose material no WebCrypto API can
 * zero, released to GC at lock and documented as platform physics "not
 * solved" (innovation 27, night-frontier-Z6). The engine's seal seat
 * closes that gap: the raw session material installs into an
 * AES-256-GCM keystore slot inside the wasm engine (the same custody
 * the witness key rides), every seal and open is an in-engine GCM
 * operation, and the lock wipe is the engine's own volatile zeroization
 * with the self-reported all-zero proof. No new envelope, no new UI,
 * no new derivation: the sealed format (`bmi-at-rest-v1`) and the
 * session semantics are byte-identical.
 *
 * Design, stated exactly:
 *   - This module is STATELESS over the key seat: the session slot in
 *     at-rest-state.ts holds the AtRestSealKey union (the engine handle
 *     or the WebCrypto key) and every function here takes the seat as a
 *     parameter. The only module state is the loaded engine instance
 *     reference (no key material - the bytes live in the slot), which
 *     the synchronous wipe needs.
 *   - Engine-first install: the raw 32-byte material is handed to the
 *     slot (the engine volatile-zeroizes its own copy of the stage);
 *     the caller's array is wiped on EVERY return path (the
 *     single-ownership discipline). Without the engine, the seat falls
 *     back to the importAesKey path - the raw material dies inside the
 *     non-extractable CryptoKey import exactly as before, and the
 *     sealed format is untouched (both sides implement the standard
 *     GCM; the parity battery pins the bytes).
 *   - The seat kinds are fail-closed inside the engine: a seal slot
 *     refuses every HMAC call and an HMAC slot refuses every seal call.
 *   - Honest limits, in the same breath as the claims: the wasm linear
 *     memory stays readable from the host by design (custody means the
 *     wrapper code never handles the key per-operation and the
 *     zeroization is deterministic and provable - the same boundary the
 *     witness key documents); the WebCrypto fallback keeps the old
 *     documented physics (a non-extractable handle released to GC).
 */

import { loadArgon2idEngine, type Argon2idWasmEngine } from './kdf-wasm-engine';
import { aesGcmDecrypt, aesGcmEncrypt, importAesKey } from './crypto-primitives';
import { warnDev } from './warn-dev';
import type { AtRestSealKey } from './at-rest-state';

/** The seal key length in bytes (256-bit AES-256-GCM key). */
export const SEAL_KEY_LENGTH = 32;

/** The engine instance the current engine-custodied seat lives in. */
let engineInstance: Argon2idWasmEngine | null = null;
/** Test-only: force the WebCrypto fallback path (pins both custody stories). */
let fallbackOnly = false;

/**
 * Install the raw session material as the at-rest seal key.
 *
 * Engine-first: the material installs into a seal slot and the caller's
 * array is wiped on return (the engine zeroized its own copy of the
 * stage). Without the engine (or on refusal), the material imports into
 * a non-extractable CryptoKey and importAesKey wipes the array. Either
 * way the caller's array never survives this call - the single
 * ownership point moved, not removed.
 */
export async function installSealKey(raw: Uint8Array): Promise<AtRestSealKey> {
	if (raw.length !== SEAL_KEY_LENGTH) {
		throw new Error(`seal key must be ${SEAL_KEY_LENGTH} bytes`);
	}
	if (!fallbackOnly) {
		try {
			const engine = await loadArgon2idEngine();
			if (engine) {
				const handle = engine.sealPut(raw);
				if (handle > 0) {
					engineInstance = engine;
					raw.fill(0);
					return { custody: 'engine', handle };
				}
			}
		} catch {
			// Engine refusal or load failure: the WebCrypto fallback below
			// is the documented degrade - availability never trumps
			// correctness, and the sealed format does not care which side
			// holds the key.
		}
	}
	const key = await importAesKey(raw);
	engineInstance = null;
	return { custody: 'webcrypto', key };
}

/**
 * Seal plaintext bytes under the installed seat with a fresh IV. Both
 * paths implement the standard GCM construction: the output layout is
 * the WebCrypto layout (ciphertext ++ 16-byte tag), so the envelope the
 * caller writes is byte-identical no matter which side sealed it.
 */
export async function sealWithKey(
	seat: AtRestSealKey,
	iv: Uint8Array,
	plaintext: Uint8Array
): Promise<Uint8Array> {
	if (seat.custody === 'webcrypto') {
		return aesGcmEncrypt(seat.key, iv, plaintext);
	}
	const engine = engineInstance ?? (await loadArgon2idEngine());
	if (!engine) {
		throw new Error('seal custody engine unavailable for an engine-custodied seat');
	}
	return engine.sealSeal(seat.handle, iv, new Uint8Array(0), plaintext);
}

/**
 * Open sealed bytes under the installed seat. Throws on an
 * authentication failure (wrong key or tampered envelope) - the caller
 * decides the degrade, mirroring the WebCrypto OperationError contract.
 */
export async function openWithKey(
	seat: AtRestSealKey,
	iv: Uint8Array,
	ciphertext: Uint8Array
): Promise<Uint8Array> {
	if (seat.custody === 'webcrypto') {
		return aesGcmDecrypt(seat.key, iv, ciphertext);
	}
	const engine = engineInstance ?? (await loadArgon2idEngine());
	if (!engine) {
		throw new Error('seal custody engine unavailable for an engine-custodied seat');
	}
	return engine.sealOpen(seat.handle, iv, new Uint8Array(0), ciphertext);
}

/**
 * Wipe the seat at lock. Engine path: the slot is volatile-zeroized
 * inside the engine and MUST self-report all-zero - a wipe that cannot
 * prove itself is a dev-visible anomaly, never a silent pass. The
 * module keeps the engine INSTANCE reference (no key material - the
 * bytes lived in the slot and are gone), which is what makes the proof
 * runnable after the wipe. WebCrypto path: the material cannot be
 * actively zeroed through any WebCrypto API - dropping the last
 * reference releases it to GC (the documented physics the engine path
 * exists to retire).
 */
export function wipeSealKey(seat: AtRestSealKey | null): void {
	if (seat?.custody === 'engine') {
		if (engineInstance) {
			try {
				engineInstance.keystoreWipe(seat.handle);
				if (!engineInstance.keystoreIsZeroed(seat.handle)) {
					warnDev(
						'seal-key',
						'wipeSealKey',
						'The seal slot did not self-report zero after the wipe'
					);
				}
			} catch (err) {
				warnDev('seal-key', 'wipeSealKey', 'The engine refused the seal wipe', err);
			}
		} else {
			warnDev(
				'seal-key',
				'wipeSealKey',
				'No engine instance while wiping an engine-custodied seal key'
			);
		}
	}
}

/** @internal Test-only: force the WebCrypto fallback path. */
export function _forceSealFallbackForTesting(force: boolean): void {
	fallbackOnly = force;
}

/** @internal Test-only: the zero state of an engine-custodied slot (the provable invariant). */
export function _sealSlotZeroStateForTesting(seat: AtRestSealKey): boolean | null {
	if (seat.custody !== 'engine' || !engineInstance) return null;
	return engineInstance.keystoreIsZeroed(seat.handle);
}

/**
 * @internal Test-only reset. Wipes the seat the caller hands over FIRST
 * (the same order production lock uses: wipe with the seat in hand, then
 * drop), so a battery never leaks armed engine slots across tests.
 */
export function _resetSealKeyForTesting(seat: AtRestSealKey | null = null): void {
	wipeSealKey(seat);
	engineInstance = null;
	fallbackOnly = false;
}
