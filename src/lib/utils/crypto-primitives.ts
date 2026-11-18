// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Low-level cryptographic primitives shared by crypto.ts and at-rest.ts.
 *
 * This module is a leaf in the dependency graph: it imports nothing from
 * storage.ts or crypto.ts, so both the export envelope stack (crypto.ts)
 * and the at-rest ledger seal (at-rest.ts) can build on it without cycles.
 *
 * Everything here was moved verbatim from crypto.ts when the at-rest
 * ledger landed (the KDF/base64/checksum surface); the only new code is
 * the two AES-GCM helpers at the bottom. crypto.ts re-exports the public
 * members so every existing import path keeps working.
 */

import { browser } from '$app/environment';
import { argon2idHashInWorker, isKdfWorkerAvailable } from './kdf-worker-client';
import { warnDev } from './warn-dev';

// ── Constants ──
export const PBKDF2_ITERATIONS = 600_000;
export const SALT_LENGTH = 16; // 128-bit salt
export const IV_LENGTH = 12; // 96-bit IV for AES-GCM

/**
 * Argon2id parameters — tuned for mobile safety.
 * Based on OWASP 2023 recommendations for password hashing.
 *
 * In test mode (`vitest`), uses lightweight params (1 MiB, 1 iteration) so
 * CI crypto tests finish deterministically without timeouts.
 *
 * Production params:
 *   m:  64 MiB memory cost — resistant to GPU attacks
 *   t:  3 iterations — harder for brute force
 *   p:  1 parallelism — single thread for mobile compatibility
 *   dkLen: 32 bytes (256-bit → AES-256 key)
 */
const IS_TEST = import.meta.env?.MODE === 'test';

const ARGON2_OPTIONS = IS_TEST
	? { m: 1024, t: 1, p: 1, dkLen: 32 } // lightweight — CI-friendly
	: {
			m: 64 * 1024, // 64 MiB memory cost (OWASP 2023)
			t: 3, // 3 iterations
			p: 1, // parallelism (single thread for mobile)
			dkLen: 32 // 256-bit output → AES-256 key
		};

export { IS_TEST, ARGON2_OPTIONS };

/**
 * Offload guard for the KDF worker: production browser builds only.
 * Tests (IS_TEST) and non-browser environments stay on the main thread
 * so crypto behavior remains deterministic and byte-identical.
 */
const CAN_OFFLOAD_KDF = !IS_TEST && browser && typeof Worker !== 'undefined';

/**
 * Extract a clean ArrayBuffer from a Uint8Array.
 * WebCrypto (both browser and Node.js) sometimes rejects Uint8Array.buffer
 * when the backing store is SharedArrayBuffer or has an offset.
 * Copying into a fresh ArrayBuffer guarantees a valid BufferSource.
 */
function toAB(src: Uint8Array): ArrayBuffer {
	const ab = new ArrayBuffer(src.length);
	new Uint8Array(ab).set(src);
	return ab;
}

/**
 * Import a raw Argon2id hash as a non-extractable AES-256-GCM key.
 * Single-ownership zeroization: importKey copies the material into the
 * non-extractable key object and the caller's array is wiped on return —
 * the raw bytes must never be reused after this call. The PBKDF2 path
 * never exposes key material in JavaScript at all (deriveKey runs inside
 * WebCrypto), so there is nothing to wipe there.
 */
export async function importAesKey(hashBytes: Uint8Array): Promise<CryptoKey> {
	const key = await crypto.subtle.importKey(
		'raw',
		toAB(hashBytes),
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	hashBytes.fill(0);
	return key;
}

/**
 * Derive an AES-256-GCM key from a passphrase + salt using Argon2id.
 *
 * Engine order (night-enhance-1): in production the derivation is
 * offloaded to the KDF worker (kdf.worker.ts), which tries the Rust
 * wasm engine first (engine/argon2id, digest-verified before use) and
 * keeps @noble/hashes as its in-worker fallback. This module's own
 * main-thread path (tests, non-browser, worker failure) uses the
 * pure-JS @noble/hashes engine. Every path implements the same
 * standard Argon2id (RFC 9106) and is pinned byte-identical by the
 * known-answer and cross-check suites, so the derived key does not
 * depend on which path ran.
 */
export async function deriveKeyArgon2(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
	if (CAN_OFFLOAD_KDF && isKdfWorkerAvailable()) {
		try {
			const hashBytes = await argon2idHashInWorker(passphrase, salt, ARGON2_OPTIONS);
			return await importAesKey(hashBytes);
		} catch (err) {
			warnDev('crypto', 'deriveKeyArgon2', 'KDF worker failed — deriving on main thread', err);
		}
	}

	const { argon2id } = await import('@noble/hashes/argon2.js');
	const hashBytes = argon2id(new TextEncoder().encode(passphrase), salt, ARGON2_OPTIONS);
	return importAesKey(hashBytes);
}

/** Derive an AES-256-GCM key from a passphrase + salt using PBKDF2 (legacy). */
export async function deriveKeyPBKDF2(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		toAB(encoder.encode(passphrase)),
		'PBKDF2',
		false,
		['deriveKey']
	);

	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: toAB(salt),
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

/**
 * Derive a key using the KDF specified in the payload.
 * Falls back to PBKDF2 for legacy payloads (no kdf field).
 */
export async function deriveKey(
	passphrase: string,
	salt: Uint8Array,
	kdf?: 'argon2id' | 'pbkdf2'
): Promise<CryptoKey> {
	if (kdf === 'argon2id') {
		try {
			return await deriveKeyArgon2(passphrase, salt);
		} catch (err) {
			// Argon2 unavailable — fall back to PBKDF2
			warnDev('crypto', 'deriveKey', 'Argon2id unavailable, falling back to PBKDF2', err);
			return deriveKeyPBKDF2(passphrase, salt);
		}
	}
	// Default / legacy: PBKDF2
	return deriveKeyPBKDF2(passphrase, salt);
}

/** Generate cryptographically random bytes. */
export function randomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return bytes;
}

/** Convert Uint8Array to base64 string. */
export function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/** Convert base64 string to Uint8Array. */
export function fromBase64(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// ── SHA-256 checksum (ciphertext integrity) ──

/**
 * Compute SHA-256 checksum of ciphertext (not plaintext).
 * Stored unencrypted in meta.checksum to detect envelope tampering
 * without leaking plaintext equality fingerprints.
 *
 * Why ciphertext, not plaintext:
 *   - A plaintext checksum would leak equality: two files with the same
 *     content would share the same checksum, even if encrypted differently.
 *   - AES-GCM already provides integrity via its auth tag, so the plaintext
 *     checksum was redundant for correctness. The ciphertext checksum adds
 *     a lightweight pre-decryption sanity check at no extra cost.
 */
export async function computeChecksum(data: string): Promise<string> {
	const encoder = new TextEncoder();
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
	return toBase64(new Uint8Array(hashBuffer));
}

/**
 * Verify ciphertext against stored checksum.
 * Returns true if the data matches, false if tampered.
 */
export async function verifyChecksum(data: string, checksum: string): Promise<boolean> {
	const computed = await computeChecksum(data);
	// Constant-time comparison (Web Crypto has no timingSafeEqual on SubtleCrypto)
	try {
		const a = Uint8Array.from(atob(computed), (c) => c.charCodeAt(0));
		const b = Uint8Array.from(atob(checksum), (c) => c.charCodeAt(0));
		if (a.length !== b.length) return false;
		let result = 0;
		for (let i = 0; i < a.length; i++) {
			result |= a[i] ^ b[i]; // XOR — accumulates differences without early exit
		}
		return result === 0;
	} catch (err) {
		warnDev(
			'crypto',
			'verifyChecksum',
			'Checksum comparison failed — possibly corrupted base64',
			err
		);
		return false;
	}
}

// ── AES-GCM helpers ──

/**
 * Encrypt raw bytes with AES-256-GCM under an imported session key.
 * The IV is copied into a fresh ArrayBuffer so no SharedArrayBuffer or
 * offset-backed view ever reaches WebCrypto (see toAB).
 */
export async function aesGcmEncrypt(
	key: CryptoKey,
	iv: Uint8Array,
	plaintext: Uint8Array
): Promise<Uint8Array> {
	const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toAB(iv) }, key, toAB(plaintext));
	return new Uint8Array(buf);
}

/**
 * Decrypt raw bytes with AES-256-GCM under an imported session key.
 * Rejects with OperationError on auth tag mismatch (wrong key or tampering).
 */
export async function aesGcmDecrypt(
	key: CryptoKey,
	iv: Uint8Array,
	ciphertext: Uint8Array
): Promise<Uint8Array> {
	const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toAB(iv) }, key, toAB(ciphertext));
	return new Uint8Array(buf);
}
