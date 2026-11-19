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
 *   - On lock the key is WIPED, not merely dropped: the stored array is
 *     overwritten with zeros, and the wipe is provable - a test can
 *     read every byte and demand all zeros (a guarantee no GC-managed
 *     JS object offers).
 *   - The key fingerprint (SHA-256 hex of the material) is a PUBLIC
 *     identifier: it lets the witness and the reseat path prove the
 *     sealed witness and the installed key belong to the same
 *     passphrase without storing or leaking anything secret.
 *
 * Honest limits, in the same breath as the claims:
 *   - JavaScript bytes readable by this module are readable by any
 *     origin script; the wipe is a determinism and hygiene guarantee,
 *     not resistance to a running attacker. The wasm custody seat
 *     (the same engine that forges the key) keeps the per-operation
 *     material out of the JS data flow and proves the all-zero
 *     post-lock invariant over its whole linear memory.
 *   - A plaintext ledger (no passphrase ever presented) has no witness
 *     key and keeps the unkeyed chain - the law upgrades the
 *     passphrase-protected class and leaves the rest exactly as
 *     documented.
 *   - Installation touches the raw bytes once (they arrive from the
 *     session establishment in JS, like the passphrase itself); after
 *     install the caller's array is wiped, mirroring importAesKey.
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

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

let witnessKey: Uint8Array | null = null;
let witnessFingerprint: string | null = null;

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Install the witness attestation key for this unlocked session.
 * Copies the material into the module-owned slot and WIPES the caller's
 * array on return (the importAesKey discipline: raw material must never
 * be reused after the install). Installing while a key is already
 * installed replaces it and wipes the old material first.
 */
export function installWitnessKey(material: Uint8Array): void {
	if (material.length !== WITNESS_MAC_LENGTH) {
		throw new Error(`witness key must be ${WITNESS_MAC_LENGTH} bytes`);
	}
	wipeWitnessKey();
	witnessKey = new Uint8Array(material);
	witnessFingerprint = toHex(sha256(material));
	material.fill(0);
}

/**
 * Wipe the installed key: the module-owned array is overwritten with
 * zeros and the fingerprint drops. Provable - a test reads every byte
 * after this call and demands all zeros.
 */
export function wipeWitnessKey(): void {
	if (witnessKey) {
		witnessKey.fill(0);
		witnessKey = null;
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
	if (!witnessKey) return null;
	const key = witnessKey;
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
	return witnessKey !== null;
}

/**
 * Internal test-only reset. Must run between tests so the module slot
 * never leaks across batteries.
 */
export function _resetWitnessKeyForTesting(): void {
	wipeWitnessKey();
}
