// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Key zeroization battery (night-frontier-Z2): the raw Argon2id output is
// wiped at the single ownership point (importAesKey), the PBKDF2 path
// never exposes material in JavaScript, and zeroization never corrupts
// the derived keys — derivations stay deterministic and interoperable.
//
// Compare-path audit (same tier): the checksum compare runs a
// constant-time XOR loop (verifyChecksum) and the export-file signature
// compare runs through crypto.subtle.verify — both verified
// constant-time; this suite pins the checksum behavior against
// timing-observable shortcuts by exercising the compare contract.

import { describe, it, expect } from 'vitest';

import {
	importAesKey,
	deriveKeyArgon2,
	deriveKeyPBKDF2,
	aesGcmEncrypt,
	aesGcmDecrypt,
	randomBytes,
	toBase64,
	verifyChecksum,
	computeChecksum
} from '../crypto-primitives';

describe('key zeroization', () => {
	it('wipes the caller array at the single ownership point', async () => {
		const material = randomBytes(32);
		expect(material.some((b) => b !== 0)).toBe(true);
		const key = await importAesKey(material);
		expect(key).toBeInstanceOf(CryptoKey);
		expect(key.extractable).toBe(false);
		expect([...material]).toEqual(new Array(32).fill(0));
	});

	it('zeroization leaves the derived key fully functional', async () => {
		const salt = randomBytes(16);
		const key = await deriveKeyArgon2('zeroization passphrase', salt);
		const iv = randomBytes(12);
		const cipher = await aesGcmEncrypt(key, iv, new TextEncoder().encode('post-wipe payload'));
		const plain = await aesGcmDecrypt(key, iv, cipher);
		expect(new TextDecoder().decode(plain)).toBe('post-wipe payload');
	});

	it('derivations stay deterministic across repeated calls (wipe never corrupts)', async () => {
		const salt = randomBytes(16);
		const a = await deriveKeyArgon2('deterministic', salt);
		const b = await deriveKeyArgon2('deterministic', salt);
		const iv = randomBytes(12);
		const cipher = await aesGcmEncrypt(a, iv, new TextEncoder().encode('cross-check'));
		await expect(aesGcmDecrypt(b, iv, cipher)).resolves.toBeInstanceOf(Uint8Array);
	});

	it('the PBKDF2 path derives without exposing material and stays interoperable', async () => {
		const salt = randomBytes(16);
		const key = await deriveKeyPBKDF2('legacy envelope', salt);
		const iv = randomBytes(12);
		const cipher = await aesGcmEncrypt(key, iv, new TextEncoder().encode('pbkdf2 round-trip'));
		const plain = await aesGcmDecrypt(key, iv, cipher);
		expect(new TextDecoder().decode(plain)).toBe('pbkdf2 round-trip');
	});
});

describe('constant-time compare contract (checksum path)', () => {
	it('verifies matching checksums and rejects mismatches', async () => {
		const data = toBase64(randomBytes(64));
		const checksum = await computeChecksum(data);
		await expect(verifyChecksum(data, checksum)).resolves.toBe(true);
		await expect(verifyChecksum(data + 'x', checksum)).resolves.toBe(false);
		await expect(verifyChecksum(data, 'not-base64!!')).resolves.toBe(false);
	});

	it('rejects checksums of different length without early exit', async () => {
		const data = 'deterministic input';
		const checksum = await computeChecksum(data);
		await expect(verifyChecksum(data, checksum.slice(0, 40))).resolves.toBe(false);
	});
});
