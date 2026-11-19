// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The witness attestation key (night-frontier-Z6).
 *
 * The continuity witness (night-frontier-Z3) was an UNKEYED chain: a
 * party who could rewrite both the history and the meta store could
 * recompute the chain and re-seal it, and the ledger's own honest limit
 * said so in three documents. The keyed witness law closes that gap for
 * passphrase-protected ledgers: the chain over the records becomes an
 * HMAC-SHA256 chain under a key derived from the SAME Argon2id session
 * material the at-rest seal already derives - no new derivation, no new
 * dependency, no new UI surface. An attacker who rewrites the device
 * state can no longer re-seal: computing the next link requires the
 * key, and the key requires the passphrase.
 *
 * Custody, engine-first: when the digest-verified wasm engine loads,
 * the key material lives in a KEYSOTE SLOT inside the engine's linear
 * memory and the raw bytes never travel back through the ABI - every
 * later use is an in-engine HMAC-SHA256, and the lock wipe is the
 * engine's own volatile zeroization, self-reported all-zero by the
 * engine itself (the invariant the engine battery pins). When the
 * engine is unavailable, the JS fallback holds a wipeable array whose
 * zeroization is provable the JS-side way: after the wipe, the
 * surviving MAC closure computes exactly what a zero-key HMAC computes.
 *
 * Design, stated exactly:
 *   - The key material is HKDF-SHA256 over the at-rest session's raw
 *     Argon2id output (salt: the per-device at-rest salt; info:
 *     "bmi-stellar-witness-mac-v1"). Deriving at the session
 *     establishment point keeps the key tier-stable across sessions
 *     (the same verifier rung, the same device salt, the same
 *     passphrase) and rotates it exactly when the passphrase does.
 *   - While a session is unlocked, `getWitnessMac()` hands out a
 *     SYNCHRONOUS HMAC-SHA256 function so the witness chain can run as
 *     a tight loop without one async WebCrypto round-trip per record.
 *   - The key fingerprint (SHA-256 hex of the material) is a PUBLIC
 *     identifier: it lets the witness and the reseat path prove the
 *     sealed witness and the installed key belong to the same
 *     passphrase without storing or leaking anything secret.
 *
 * Honest limits, in the same breath as the claims:
 *   - Wasm linear memory is readable from the host by design (that is
 *     how the ABI passes data at all), so custody here means the
 *     wrapper code never handles the key per-operation and the
 *     zeroization is deterministic and provable - not resistance to a
 *     host-level reader. The install moment touches the raw bytes once
 *     (they arrive from the session establishment in JS, like the
 *     passphrase itself); after install the caller's array is wiped.
 *   - JavaScript fallback bytes are readable by any origin script; the
 *     wipe is a determinism guarantee, not resistance to a running
 *     attacker.
 *   - A plaintext ledger (no passphrase ever presented) has no witness
 *     key and keeps the unkeyed chain - the law upgrades the
 *     passphrase-protected class and leaves the rest exactly as
 *     documented.
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { loadArgon2idEngine, type Argon2idWasmEngine } from './kdf-wasm-engine';

/** The HKDF info label the session establishment derives this key with. */
export const WITNESS_MAC_INFO = 'bmi-stellar-witness-mac-v1';

/** The witness key length in bytes (256-bit HMAC-SHA256 key). */
export const WITNESS_MAC_LENGTH = 32;

/**
 * The synchronous MAC the witness chain runs under: keyed HMAC-SHA256
 * while a witness key is installed, null while locked or for ledgers
 * that never presented a passphrase.
 */
export type WitnessMac = (msg: Uint8Array) => Uint8Array;

let engineInstance: Argon2idWasmEngine | null = null;
let engineHandle: number | null = null;
let jsKey: Uint8Array | null = null;
let witnessFingerprint: string | null = null;
let fallbackOnly = false;

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Install the witness attestation key for this unlocked session.
 * Engine-first: the material is handed to the keystore seat (which
 * volatile-zeroizes its own copy of the stage), and the raw bytes never
 * return to JS. Without the engine, the JS fallback holds a wipeable
 * array. Either way the caller's array is WIPED on return (the
 * importAesKey discipline: raw material must never be reused after the
 * install), and installing while a key is already installed replaces
 * the old one and wipes it first.
 */
export async function installWitnessKey(material: Uint8Array): Promise<void> {
	if (material.length !== WITNESS_MAC_LENGTH) {
		throw new Error(`witness key must be ${WITNESS_MAC_LENGTH} bytes`);
	}
	wipeWitnessKey();
	const fingerprint = toHex(sha256(material));
	if (!fallbackOnly) {
		try {
			const engine = await loadArgon2idEngine();
			if (engine) {
				const handle = engine.keystorePut(material);
				if (handle > 0) {
					engineInstance = engine;
					engineHandle = handle;
					witnessFingerprint = fingerprint;
					material.fill(0);
					return;
				}
			}
		} catch {
			// Engine refusal or load failure: the JS fallback below is the
			// documented degrade - availability never trumps correctness.
		}
	}
	jsKey = new Uint8Array(material);
	witnessFingerprint = fingerprint;
	material.fill(0);
}

/**
 * Wipe the installed key. Engine path: the keystore slot is
 * volatile-zeroized and disarmed inside the engine (the slot then
 * refuses every use - use after wipe is an ABI refusal, not a zero-key
 * computation). JS path: the module-owned array is overwritten with
 * zeros - provable through the surviving MAC closure. The fingerprint
 * drops in both cases.
 */
export function wipeWitnessKey(): void {
	if (engineInstance && engineHandle !== null) {
		try {
			engineInstance.keystoreWipe(engineHandle);
		} catch {
			// An already-wiped or refusing slot is fine here: the outcome
			// this module owes is "no usable key", which holds either way.
		}
	}
	engineInstance = null;
	engineHandle = null;
	if (jsKey) {
		jsKey.fill(0);
		jsKey = null;
	}
	witnessFingerprint = null;
}

/**
 * The synchronous HMAC-SHA256 under the installed key, or null while
 * locked / never installed. The chain module fails closed when a keyed
 * witness is requested without this function: it can neither bless nor
 * accuse what it cannot attest.
 */
export function getWitnessMac(): WitnessMac | null {
	if (engineInstance && engineHandle !== null) {
		const engine = engineInstance;
		const handle = engineHandle;
		return (msg: Uint8Array) => engine.keystoreHmac(handle, msg);
	}
	if (!jsKey) return null;
	const key = jsKey;
	return (msg: Uint8Array) => hmac(sha256, key, msg);
}

/**
 * The public key fingerprint (SHA-256 hex of the key material), or null
 * while no key is installed. Stored inside keyed witnesses so the
 * reseat path can prove the sealed witness and the installed key belong
 * to the same passphrase before it recomputes anything.
 */
export function getWitnessKeyFingerprint(): string | null {
	return witnessFingerprint;
}

/** True while a witness key is installed (an unlocked, keyed session). */
export function hasWitnessKey(): boolean {
	return engineHandle !== null || jsKey !== null;
}

/** Force the JS fallback path (test hook: pins both custody stories). */
export function _forceWitnessFallbackForTesting(force: boolean): void {
	fallbackOnly = force;
}

/** @internal Test-only: which custody path currently holds the key. */
export function _witnessKeyPathForTesting(): 'engine' | 'js' | null {
	if (engineHandle !== null) return 'engine';
	if (jsKey !== null) return 'js';
	return null;
}

/**
 * Internal test-only reset. Must run between tests so the module slot
 * never leaks across batteries.
 */
export function _resetWitnessKeyForTesting(): void {
	wipeWitnessKey();
	fallbackOnly = false;
}
