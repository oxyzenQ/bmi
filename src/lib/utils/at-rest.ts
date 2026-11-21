// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The at-rest ledger seal — health values encrypted at rest, not just on
 * export.
 *
 * Closes the one honest limit the product documents ("local browser
 * storage is not encrypted at rest") with a design that adds no new UI
 * surface: the session unlocks through the passphrase moments that
 * already exist (enable encryption, successful decrypt flows) and every
 * later write to a health key is sealed transparently by storage.ts.
 *
 * Semantics, stated honestly:
 *   - Sealing is session-gated. A cold load starts locked: sealed values
 *     read as null until the passphrase is presented again. Locked data
 *     is never destroyed — storage.ts refuses writes that would overwrite
 *     a sealed value without a session key (the purge guard).
 *   - The session seal key lives in the engine's custody while unlocked
 *     (night-frontier-Z8): an opaque AES-256-GCM slot inside the wasm
 *     engine, sealed and opened in-engine, wiped with a self-reported
 *     all-zero proof at lock. The WebCrypto fallback keeps the
 *     documented physics (a non-extractable handle released to GC).
 *     Either way the key is never persisted, cached to disk, or
 *     transmitted.
 *   - Values are sealed with a fresh 12-byte IV per write; the AES-GCM
 *     auth tag plus a SHA-256 ciphertext checksum carry integrity. Both
 *     custody sides implement the standard GCM, so the envelope is
 *     byte-identical no matter which side sealed it.
 *   - Only the ledger passphrase ever seals or unseals. Passphrases typed
 *     for export files that do not match the verifier never register.
 *   - Sealing failure falls back to plaintext persistence (data
 *     preservation beats encryption coverage), with a dev-only warning.
 *
 * Envelope format (bmi-at-rest-v1):
 *   TAG + base64(JSON { v, iv, data, chk })
 *   v    — envelope version (1)
 *   iv   — base64 12-byte AES-GCM IV
 *   data — base64 AES-256-GCM ciphertext
 *   chk  — base64 SHA-256 of the data field (pre-decryption sanity check)
 */

import { dbMetaGet, dbMetaSet } from './db';
import {
	computeChecksum,
	deriveSessionKeys,
	fromBase64,
	randomBytes,
	toBase64,
	verifyChecksum,
	IV_LENGTH,
	SALT_LENGTH,
	META_ENCRYPTION_VERIFIER
} from './crypto-primitives';
import {
	envelopeParamsToOptions,
	LEGACY_KDF_OPTIONS,
	validateEnvelopeKdfParams
} from './kdf-ladder';
import type { Argon2Options } from './kdf-worker-client';
import {
	AT_REST_TAG,
	clearAtRestSessionKey,
	getAtRestSessionKey,
	isAtRestSessionUnlocked,
	isAtRestTagged,
	setAtRestSessionKey
} from './at-rest-state';
import { installSealKey, openWithKey, sealWithKey, wipeSealKey } from './seal-key';
import { installWitnessKey, wipeWitnessKey } from './witness-key';
import { warnDev } from './warn-dev';

/** IndexedDB meta key holding the base64 at-rest salt (device-local). */
export const META_AT_REST_SALT = '__at_rest_salt';

const AT_REST_VERSION = 1;

/** Envelope shape carried inside the tagged value. */
interface AtRestEnvelope {
	v: number;
	iv: string;
	data: string;
	chk: string;
}

/**
 * Read the at-rest salt from the meta store, creating a random one on
 * first use. The salt is not secret — it only defeats precomputation.
 * A stable salt means re-registering the same passphrase reproduces the
 * same session key, so a disable/re-enable cycle keeps old sealed values
 * readable.
 */
async function getOrCreateSalt(): Promise<Uint8Array> {
	const stored = await dbMetaGet(META_AT_REST_SALT);
	if (stored) {
		return fromBase64(stored);
	}
	const salt = randomBytes(SALT_LENGTH);
	await dbMetaSet(META_AT_REST_SALT, toBase64(salt));
	return salt;
}

/**
 * Register the session key for an unlocked session.
 *
 * Callers are the verifier-anchored passphrase moments in crypto.ts:
 * enableEncryption() and a successful verifier/file decrypt that passed
 * verifyPassphrase(). Derives the Argon2id session key (offloaded to the
 * KDF worker in production) and installs it in the volatile slot.
 * Throws on derivation failure — callers decide the fallback.
 */
/**
 * The derivation rung the stored verifier records (night-frontier-Z4).
 * The session key must be tier-stable: a device that changes tier
 * between sessions must re-derive the SAME key from the sealed ledger,
 * so the rung comes from the verifier envelope, never from the current
 * ladder. No verifier (never enabled, pre-ladder) → the fixed legacy
 * defaults those devices derived with.
 */
async function readVerifierKdfOptions(): Promise<Argon2Options> {
	try {
		const stored = await dbMetaGet(META_ENCRYPTION_VERIFIER);
		if (!stored) return LEGACY_KDF_OPTIONS;
		const payload = JSON.parse(stored) as { kdfParams?: unknown };
		if (!validateEnvelopeKdfParams(payload.kdfParams)) return LEGACY_KDF_OPTIONS;
		return envelopeParamsToOptions(payload.kdfParams);
	} catch (err) {
		warnDev(
			'at-rest',
			'readVerifierKdfOptions',
			'Verifier rung read failed — legacy defaults',
			err
		);
		return LEGACY_KDF_OPTIONS;
	}
}

export async function registerAtRestSession(passphrase: string): Promise<void> {
	// The session key is deterministic (passphrase + device salt + the
	// verifier's recorded rung), so an already-unlocked session never
	// re-derives. enableEncryption() clears the slot first, so a
	// re-enable with a new passphrase always derives.
	if (isAtRestSessionUnlocked()) return;
	const salt = await getOrCreateSalt();
	// Night-frontier-Z6: one Argon2id pass yields BOTH keys - the seal
	// key material and the witness attestation material (HKDF domain
	// separation). Night-frontier-Z8: the raw material installs into the
	// engine's seal custody (or the WebCrypto fallback) and dies there -
	// single ownership, consumed exactly once by installSealKey.
	const { sessionRaw, witnessMacKey } = await deriveSessionKeys(
		passphrase,
		salt,
		await readVerifierKdfOptions()
	);
	setAtRestSessionKey(await installSealKey(sessionRaw));
	await installWitnessKey(witnessMacKey);
}

/**
 * Drop the session key. The session returns to locked state: sealed
 * values read as null again and writes to health keys are refused while
 * a sealed value exists. Existing sealed values are untouched. The
 * engine-custodied seal key is VOLATILE-ZEROIZED with a self-reported
 * all-zero proof before the reference drops (night-frontier-Z8; the
 * WebCrypto fallback releases its handle to GC - the documented
 * physics). The witness attestation key is WIPED with it - a keyed
 * witness can then neither bless nor accuse until the next
 * passphrase-proven unlock.
 */
export function clearAtRestSession(): void {
	wipeSealKey(getAtRestSessionKey());
	clearAtRestSessionKey();
	wipeWitnessKey();
}

/** True while an unlocked session is active. */
export function isAtRestUnlocked(): boolean {
	return isAtRestSessionUnlocked();
}

/**
 * Seal a plaintext value into the tagged at-rest format using the
 * session seat and a fresh random IV. Throws when no session seat is
 * installed — storage.ts guards this, but the check stays here so the
 * invariant holds no matter the caller.
 */
export async function sealAtRestValue(plaintext: string): Promise<string> {
	if (!isAtRestSessionUnlocked()) {
		throw new Error('at-rest seal called without an unlocked session');
	}
	const seat = getAtRestSessionKey();
	if (!seat) {
		throw new Error('at-rest seal called without an unlocked session');
	}
	const iv = randomBytes(IV_LENGTH);
	const ciphertext = await sealWithKey(seat, iv, new TextEncoder().encode(plaintext));
	const data = toBase64(ciphertext);
	const envelope: AtRestEnvelope = {
		v: AT_REST_VERSION,
		iv: toBase64(iv),
		data,
		chk: await computeChecksum(data)
	};
	return AT_REST_TAG + toBase64(new TextEncoder().encode(JSON.stringify(envelope)));
}

/**
 * Open a sealed value back to plaintext. Returns null on any failure:
 * wrong session key (passphrase changed since sealing), tampered
 * envelope, checksum mismatch, or corrupted base64. Never throws.
 */
export async function openAtRestValue(sealed: string): Promise<string | null> {
	if (!isAtRestTagged(sealed)) return null;
	try {
		const json = new TextDecoder().decode(fromBase64(sealed.slice(AT_REST_TAG.length)));
		const envelope = JSON.parse(json) as AtRestEnvelope;
		if (envelope.v !== AT_REST_VERSION || !envelope.iv || !envelope.data || !envelope.chk) {
			warnDev('at-rest', 'openAtRestValue', 'Sealed envelope is missing required fields');
			return null;
		}
		if (!(await verifyChecksum(envelope.data, envelope.chk))) {
			warnDev('at-rest', 'openAtRestValue', 'Sealed envelope checksum mismatch — tampered data');
			return null;
		}
		const seat = getAtRestSessionKey();
		if (!seat) {
			warnDev('at-rest', 'openAtRestValue', 'No session key while opening a sealed value');
			return null;
		}
		const plaintext = await openWithKey(seat, fromBase64(envelope.iv), fromBase64(envelope.data));
		return new TextDecoder().decode(plaintext);
	} catch (err) {
		const isAuthFailure =
			(err instanceof DOMException && err.name === 'OperationError') ||
			(err instanceof Error && err.message.includes('authentication failed'));
		if (isAuthFailure) {
			warnDev(
				'at-rest',
				'openAtRestValue',
				'AES-GCM auth tag mismatch — sealed under a different passphrase'
			);
		} else {
			warnDev('at-rest', 'openAtRestValue', 'Opening sealed value failed', err);
		}
		return null;
	}
}
