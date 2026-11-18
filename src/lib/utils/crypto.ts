// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Optional passphrase-based encryption for BMI Stellar.
 *
 * Uses Web Crypto API (AES-GCM) to encrypt/decrypt stored data
 * and exported files. Encryption is entirely optional — the user
 * can enable/disable it at any time.
 *
 * Key derivation (new): Argon2id — memory-hard KDF, resistant to GPU attacks
 *   Params (mobile-safe): 64 MB memory, 3 iterations, parallelism 1
 * Key derivation (legacy): PBKDF2 with 600k iterations + random salt
 * Encryption: AES-256-GCM with 12-byte IV
 * Integrity: AES-GCM auth tag (built-in) + SHA-256 checksum of ciphertext in meta
 * Storage: salt + IV + ciphertext + checksum (base64-encoded in JSON)
 *
 * Passphrase verification (v18.1):
 *   - enableEncryption() stores a verifier (encrypted known plaintext)
 *   - verifyPassphrase() decrypts the stored verifier (not a self-test)
 *   - Wrong passphrase → AES-GCM auth tag mismatch → false
 *
 * At-rest session unlock (night-frontier-Z1):
 *   - The low-level primitives live in crypto-primitives.ts (a dependency
 *     leaf shared with at-rest.ts); this module keeps the envelope stack.
 *   - enableEncryption() and verifier-anchored successful decrypts register
 *     the at-rest session key, so later writes to health keys seal at rest.
 *   - Only a passphrase that verifies against the stored verifier can ever
 *     register — export-file passphrases that fail verification never do.
 *
 * Backward compatibility:
 *   - Files encrypted with PBKDF2 (no kdf field) auto-detected and still decryptable
 *   - Non-encrypted files import correctly (auto-detected)
 *   - Encrypted files require the correct passphrase
 *   - Wrong passphrase produces decryption failure (handled gracefully)
 *   - Tampered files produce explicit integrity_failed error (not generic decrypt error)
 */

import { browser } from '$app/environment';
import {
	ARGON2_OPTIONS,
	computeChecksum as computeChecksumB64,
	verifyChecksum as verifyChecksumB64,
	deriveKey,
	deriveKeyArgon2,
	deriveKeyPBKDF2,
	fromBase64,
	randomBytes,
	toBase64,
	IV_LENGTH,
	SALT_LENGTH
} from './crypto-primitives';
import { clearAtRestSession, registerAtRestSession } from './at-rest';
import { isAtRestSessionUnlocked } from './at-rest-state';
import { dbMetaGet, dbMetaSet, isIndexedDbAvailable } from './db';
import {
	STORAGE_KEYS,
	storageGet,
	storageRefreshAtRestCache,
	storageRemove,
	storageSet
} from './storage';
import { warnDev } from './warn-dev';

// Public checksum helpers moved to crypto-primitives.ts; re-exported so
// every existing import path keeps working.
export { computeChecksum, verifyChecksum } from './crypto-primitives';

const META_ENCRYPTION_KEY = '__encryption_enabled';
const META_ENCRYPTION_VERIFIER = '__encryption_verifier';
// Passphrase hint stored in localStorage (see setPassphraseHint / getPassphraseHint below)

/** Known plaintext encrypted during enableEncryption() for later passphrase verification. */
const VERIFIER_PLAINTEXT = 'BMI_STELLAR_VERIFIER_V1';

// ── Types ──
export interface EncryptedPayload {
	/** Format identifier — emits 'bmi-encrypted-v3'; legacy v1 stays readable. */
	format: 'bmi-encrypted-v3' | 'bmi-encrypted-v1';
	/** Cipher algorithm used: always 'aes-256-gcm' */
	cipher?: 'aes-256-gcm';
	/** Key derivation function used: 'argon2id' or 'pbkdf2' (legacy) */
	kdf?: 'argon2id' | 'pbkdf2';
	/** Argon2id parameters (only when kdf === 'argon2id') */
	kdfParams?: {
		type: number;
		mem: number;
		time: number;
		parallelism: number;
		hashLen: number;
	};
	/** Base64-encoded salt (16 bytes) */
	salt: string;
	/** Base64-encoded AES-GCM IV (12 bytes) */
	iv: string;
	/** Base64-encoded ciphertext */
	data: string;
	/** Unencrypted metadata for preview before decryption */
	meta?: {
		/** ISO timestamp of when the export was created */
		exportedAt?: string;
		/** Number of records in the encrypted payload */
		recordCount?: number;
		/** Envelope version (0–3) */
		version?: number;
		/** SHA-256 checksum of ciphertext — detects envelope-level tampering without leaking plaintext equality */
		checksum?: string;
	};
}

export interface EncryptionStatus {
	enabled: boolean;
	hasPassphrase: boolean;
}

// ── Passphrase hint (local only) ──

/**
 * Save a passphrase hint to localStorage (device-local only).
 * NEVER exported to encrypted files.
 */
export function setPassphraseHint(hint: string): void {
	if (hint && hint.trim()) {
		storageSet(STORAGE_KEYS.PASSPHRASE_HINT, hint.trim());
	} else {
		storageRemove(STORAGE_KEYS.PASSPHRASE_HINT);
	}
}

/**
 * Load the passphrase hint from localStorage.
 * Returns empty string if no hint is stored.
 */
export function getPassphraseHint(): string {
	return storageGet(STORAGE_KEYS.PASSPHRASE_HINT) || '';
}

// ── Passphrase strength analysis ──

export interface StrengthResult {
	/** 0–4 score (0=very weak, 4=very strong) */
	score: number;
	/** Estimated entropy in bits (log10 scale from zxcvbn) */
	entropy: number;
	/** Crack time in seconds (raw, for i18n formatting in UI) */
	crackTimeSeconds: number;
	/** User-facing feedback (suggestions) */
	warning?: string;
	suggestions: string[];
}

/**
 * Analyze passphrase strength using @zxcvbn-ts/core.
 * Returns score (0-4), entropy, crack time, and feedback.
 * Uses dynamic import to keep bundle small until needed.
 * Dictionary is loaded once and reused across calls.
 */
let _zxcvbnReady: Promise<boolean> | null = null;

async function initZxcvbn(): Promise<boolean> {
	try {
		const { zxcvbnOptions } = await import('@zxcvbn-ts/core');
		const { dictionary } = await import('@zxcvbn-ts/language-common');
		zxcvbnOptions.setOptions({ dictionary });
		return true;
	} catch (err) {
		warnDev('crypto', 'initZxcvbn', '@zxcvbn-ts/core init failed, using fallback scoring', err);
		return false;
	}
}

export async function analyzeStrength(passphrase: string): Promise<StrengthResult> {
	if (!passphrase) {
		return { score: 0, entropy: 0, crackTimeSeconds: 0, suggestions: [] };
	}

	try {
		// Initialize dictionary once (subsequent calls reuse cached promise)
		if (!_zxcvbnReady) {
			_zxcvbnReady = initZxcvbn();
		}
		const ready = await _zxcvbnReady;

		if (!ready) {
			return fallbackStrength(passphrase);
		}

		const { zxcvbn } = await import('@zxcvbn-ts/core');
		const result = zxcvbn(passphrase);

		return {
			score: result.score,
			entropy: result.guessesLog10,
			crackTimeSeconds: result.crackTimesSeconds.offlineSlowHashing1e4PerSecond,
			warning: result.feedback.warning || undefined,
			suggestions: [...(result.feedback.suggestions || [])]
		};
	} catch (err) {
		// zxcvbn load failure — fall back to basic scoring
		warnDev('crypto', 'analyzeStrength', 'zxcvbn unavailable, using fallback scoring', err);
		return fallbackStrength(passphrase);
	}
}

/** Basic strength scoring fallback if zxcvbn is unavailable. */
function fallbackStrength(pw: string): StrengthResult {
	let score = 0;
	if (pw.length >= 8) score++;
	if (/[0-9]/.test(pw)) score++;
	if (/[^a-zA-Z0-9]/.test(pw)) score++;
	if (pw.length >= 12) score++;
	return { score, entropy: 0, crackTimeSeconds: 0, suggestions: [] };
}

// ── Public API ──

/**
 * Encrypt a string using AES-256-GCM with a passphrase.
 * Uses Argon2id for key derivation (new format).
 * Falls back to PBKDF2 only if Argon2 WASM fails.
 * Returns a JSON string containing the encrypted payload.
 * Optional meta is stored unencrypted for preview before decryption.
 */
export async function encrypt(
	plaintext: string,
	passphrase: string,
	meta?: EncryptedPayload['meta']
): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);

	let key: CryptoKey;
	let kdf: 'argon2id' | 'pbkdf2' = 'argon2id';
	let kdfParams: EncryptedPayload['kdfParams'];

	try {
		key = await deriveKeyArgon2(passphrase, salt);
		kdfParams = {
			type: 2,
			mem: ARGON2_OPTIONS.m,
			time: ARGON2_OPTIONS.t,
			parallelism: ARGON2_OPTIONS.p,
			hashLen: ARGON2_OPTIONS.dkLen
		};
	} catch (err) {
		// Argon2 unavailable — fall back to PBKDF2
		warnDev('crypto', 'encrypt', 'Argon2id unavailable, falling back to PBKDF2', err);
		key = await deriveKeyPBKDF2(passphrase, salt);
		kdf = 'pbkdf2';
	}

	const encoder = new TextEncoder();
	const ciphertext = await crypto.subtle.encrypt(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		{ name: 'AES-GCM', iv: iv as any },
		key,
		encoder.encode(plaintext)
	);

	const ciphertextB64 = toBase64(new Uint8Array(ciphertext));
	const checksum = await computeChecksumB64(ciphertextB64);

	const payload: EncryptedPayload = {
		format: 'bmi-encrypted-v3',
		cipher: 'aes-256-gcm',
		kdf,
		...(kdfParams && { kdfParams }),
		salt: toBase64(salt),
		iv: toBase64(iv),
		data: ciphertextB64,
		meta: {
			...meta,
			checksum
		}
	};

	return JSON.stringify(payload);
}

/**
 * Decrypt an encrypted payload using AES-256-GCM with a passphrase.
 * Auto-detects KDF (argon2id or pbkdf2) from payload.
 * Returns `{ plaintext, integrityOk }` on success, or `null` on failure.
 *
 * Error differentiation (v16.0 — Reliability):
 *   - `OperationError`: AES-GCM auth tag mismatch → wrong passphrase (most likely)
 *   - Other errors: corrupted payload, invalid base64, etc.
 *   All failures are logged via warnDev with specific context.
 *
 * Integrity check: verifies SHA-256 checksum of ciphertext
 * against stored checksum. Uses ciphertext (not plaintext) to avoid
 * leaking plaintext equality fingerprints. Separate from AES-GCM
 * auth tag — provides a lightweight pre-decryption sanity check.
 *
 * At-rest unlock (night-frontier-Z1): a successful decrypt proves
 * knowledge of the passphrase. Decrypts of the verifier register the
 * at-rest session directly; file decrypts register only after the
 * passphrase verifies against the stored verifier, so only the ledger
 * passphrase can ever unlock the session.
 */
export async function decrypt(
	encryptedJson: string,
	passphrase: string
): Promise<{ plaintext: string; integrityOk: boolean } | null> {
	try {
		const payload: EncryptedPayload = JSON.parse(encryptedJson);

		if (payload.format !== 'bmi-encrypted-v3' && payload.format !== 'bmi-encrypted-v1') {
			warnDev('crypto', 'decrypt', 'Unknown encrypted format (expected v3 or legacy v1)');
			return null;
		}

		// Validate payload structure before attempting crypto operations
		if (!payload.salt || !payload.iv || !payload.data) {
			warnDev(
				'crypto',
				'decrypt',
				'Encrypted payload is missing required fields (salt, iv, or data)'
			);
			return null;
		}

		// Validate base64 integrity before decoding
		try {
			fromBase64(payload.salt);
			fromBase64(payload.iv);
			fromBase64(payload.data);
		} catch (err) {
			warnDev(
				'crypto',
				'decrypt',
				'Encrypted payload contains invalid base64 — data may be corrupted',
				err
			);
			return null;
		}

		const salt = fromBase64(payload.salt);
		const iv = fromBase64(payload.iv);
		const ciphertext = fromBase64(payload.data);
		const kdf = payload.kdf || 'pbkdf2'; // Default to PBKDF2 for legacy

		const key = await deriveKey(passphrase, salt, kdf);

		const plaintextBuf = await crypto.subtle.decrypt(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ name: 'AES-GCM', iv: iv as any },
			key,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			ciphertext as any
		);

		const plaintext = new TextDecoder().decode(plaintextBuf);

		// Verify ciphertext checksum if present (detects envelope tampering)
		let integrityOk = true;
		if (payload.meta?.checksum) {
			integrityOk = await verifyChecksumB64(payload.data, payload.meta.checksum);
		}

		// At-rest session unlock — verifier-anchored, never throws into
		// callers, never blocks them. The unlock is an enhancement layered
		// on top of the primary flow: it runs fire-and-forget behind a
		// bounded race so a slow or broken IndexedDB (test stubs, private
		// modes, pending upgrades) can never stall a decrypt. Values
		// written before the background unlock completes stay plaintext
		// until their next write — documented in the ledger.
		void (async () => {
			try {
				if (plaintext === VERIFIER_PLAINTEXT) {
					await registerAtRestSession(passphrase);
					await storageRefreshAtRestCache();
				} else if (!isAtRestSessionUnlocked()) {
					const verified = await Promise.race([
						verifyPassphrase(passphrase),
						new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000))
					]);
					if (verified) {
						await registerAtRestSession(passphrase);
						await storageRefreshAtRestCache();
					}
				}
			} catch (err) {
				warnDev('crypto', 'decrypt', 'At-rest unlock check failed (session stays locked)', err);
			}
		})();

		return { plaintext, integrityOk };
	} catch (err) {
		// Differentiate AES-GCM auth tag mismatch (wrong passphrase) from other errors
		if (err instanceof DOMException && err.name === 'OperationError') {
			warnDev('crypto', 'decrypt', 'AES-GCM auth tag mismatch — likely wrong passphrase');
		} else {
			warnDev('crypto', 'decrypt', 'Decryption failed (corrupted data or crypto error)', err);
		}
		return null;
	}
}

/**
 * Check if a string is an encrypted payload.
 */
export function isEncrypted(json: string): boolean {
	try {
		const parsed = JSON.parse(json);
		return parsed?.format === 'bmi-encrypted-v3' || parsed?.format === 'bmi-encrypted-v1';
	} catch (err) {
		warnDev('crypto', 'isEncrypted', 'Failed to parse payload for encryption detection', err);
		return false;
	}
}

// ── Encryption preference persistence ──

/**
 * Enable encryption and create a verifier for passphrase validation.
 *
 * Flow:
 *   1. Encrypt a known test string (VERIFIER_PLAINTEXT) with the passphrase
 *   2. Store the encrypted verifier in IndexedDB
 *   3. Later, verifyPassphrase() decrypts this stored verifier to validate
 *   4. Register the at-rest session so health values seal at rest from
 *      this session onward (registration failure never fails the enable)
 *
 * The passphrase itself is NEVER stored — only the verifier ciphertext.
 * A wrong passphrase will fail AES-GCM authentication (auth tag mismatch).
 */
export async function enableEncryption(passphrase: string): Promise<boolean> {
	if (!browser || !isIndexedDbAvailable()) return false;

	try {
		// Create a verifier by encrypting the known plaintext
		const verifier = await encrypt(VERIFIER_PLAINTEXT, passphrase);
		await dbMetaSet(META_ENCRYPTION_VERIFIER, verifier);
		await dbMetaSet(META_ENCRYPTION_KEY, '1');

		// At-rest session: clear any stale key first so a re-enable with a
		// new passphrase always re-derives against the new passphrase.
		clearAtRestSession();
		try {
			await registerAtRestSession(passphrase);
			await storageRefreshAtRestCache();
		} catch (err) {
			warnDev('crypto', 'enableEncryption', 'At-rest session registration failed', err);
		}
		return true;
	} catch (err) {
		warnDev(
			'crypto',
			'enableEncryption',
			'Failed to enable encryption (verifier creation or DB write)',
			err
		);
		return false;
	}
}

/**
 * Disable encryption. Clears the verifier so stored passphrase can no longer be validated.
 * Does NOT decrypt existing encrypted data — the user must decrypt first.
 * Also clears the at-rest session key; sealed values stay sealed and locked.
 */
export async function disableEncryption(): Promise<void> {
	if (!browser || !isIndexedDbAvailable()) return;
	await dbMetaSet(META_ENCRYPTION_KEY, '0');
	await dbMetaSet(META_ENCRYPTION_VERIFIER, '');
	clearAtRestSession();
}

/**
 * Get the current encryption status.
 * `hasPassphrase` is true only when a real verifier exists in storage.
 */
export async function getEncryptionStatus(): Promise<EncryptionStatus> {
	if (!browser || !isIndexedDbAvailable()) {
		return { enabled: false, hasPassphrase: false };
	}

	try {
		const enabled = await dbMetaGet(META_ENCRYPTION_KEY);
		const verifier = await dbMetaGet(META_ENCRYPTION_VERIFIER);
		return {
			enabled: enabled === '1',
			hasPassphrase: Boolean(verifier) // true only if a verifier record exists
		};
	} catch (err) {
		warnDev(
			'crypto',
			'getEncryptionStatus',
			'Failed to read encryption status from IndexedDB',
			err
		);
		return { enabled: false, hasPassphrase: false };
	}
}

/**
 * Verify a passphrase against the previously stored verifier.
 *
 * Unlike the previous (broken) implementation that created a new encrypted blob
 * with the same passphrase and immediately decrypted it (always true), this
 * version decrypts the VERIFIER stored by enableEncryption().
 *
 * - Correct passphrase → decrypt succeeds → plaintext matches → true
 *   (and the decrypt path registers the at-rest session)
 * - Wrong passphrase → AES-GCM auth tag mismatch → null → false
 * - No verifier stored → returns false (encryption not enabled)
 */
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
	if (!browser || !isIndexedDbAvailable()) return false;

	try {
		const storedVerifier = await dbMetaGet(META_ENCRYPTION_VERIFIER);
		if (!storedVerifier) {
			warnDev('crypto', 'verifyPassphrase', 'No verifier found — encryption may not be enabled');
			return false;
		}

		const result = await decrypt(storedVerifier, passphrase);
		if (!result || result.plaintext !== VERIFIER_PLAINTEXT) {
			return false;
		}

		return true;
	} catch (err) {
		warnDev('crypto', 'verifyPassphrase', 'Passphrase verification failed', err);
		return false;
	}
}
