// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z8 - the wasm seal seat proof suite.
//
// The keystore becomes a two-kind custody: the at-rest AES-256-GCM seal
// key lives in its own slots and every use is an in-engine GCM
// operation. Pinned against the digest-verified artifact:
//   1. Published anchor: the NIST GCM test case 13 vector (AES-256,
//      zero key, zero IV, zero plaintext, no associated data) through
//      the real ABI - WebCrypto (an independent implementation) agrees
//      with the published bytes, and the engine must too.
//   2. Byte-identity: the engine seal equals WebCrypto across a
//      deterministic matrix over keys, nonces, plaintexts, and
//      associated data (the output layout is the WebCrypto layout:
//      ciphertext ++ 16-byte tag), and both directions of the envelope
//      interop hold.
//   3. Failure parity: a flipped bit is refused by BOTH engines; the
//      refusal matrix (wrong nonce length, wrong handle, kind
//      cross-use, use after wipe, stale generation) never produces
//      bytes.
//   4. Custody: the seal slot rides the same provable wipe - the slot
//      self-reports all-zero and refuses every further use.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// The embedded-artifact module is mocked with live getters so the
// tamper tests can poison the digest and restore it without touching
// the generated file on disk.
const embeddedState = vi.hoisted(() => ({ sha: '', b64: '' }));

vi.mock('../kdf-wasm-embedded', () => ({
	get ARGON2ID_WASM_SHA256(): string {
		return embeddedState.sha;
	},
	get ARGON2ID_WASM_BASE64(): string {
		return embeddedState.b64;
	}
}));

import {
	loadArgon2idEngine,
	_resetArgon2idEngineForTesting,
	type Argon2idWasmEngine
} from '../kdf-wasm-engine';

/** Deterministic xorshift32 PRNG - the matrix is reproducible forever. */
function makePrng(seed: number): () => number {
	let s = seed | 0 || 1;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		s >>>= 0;
		return s / 0x100000000;
	};
}

const prng = makePrng(0x5e41); // 'sea1'

function randomBytes(prng: () => number, length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) bytes[i] = Math.floor(prng() * 256);
	return bytes;
}

/** NIST GCM test case 13 (AES-256-GCM, zero key/IV/plaintext, no AAD). */
const NIST_GCM_TC13 = {
	key: new Uint8Array(32),
	nonce: new Uint8Array(12),
	plaintext: new Uint8Array(16),
	ciphertextTag: 'cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919'
};

async function webcryptoGcmKey(key: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', key.slice().buffer as ArrayBuffer, 'AES-GCM', false, [
		'encrypt',
		'decrypt'
	]);
}

async function webcryptoSeal(
	key: Uint8Array,
	nonce: Uint8Array,
	aad: Uint8Array,
	plaintext: Uint8Array
): Promise<Uint8Array> {
	const gcmKey = await webcryptoGcmKey(key);
	const params: AesGcmParams = { name: 'AES-GCM', iv: nonce.slice().buffer as ArrayBuffer };
	if (aad.length > 0) params.additionalData = aad.slice().buffer as ArrayBuffer;
	return new Uint8Array(
		await crypto.subtle.encrypt(params, gcmKey, plaintext.slice().buffer as ArrayBuffer)
	);
}

let engine: Argon2idWasmEngine;

beforeAll(async () => {
	const real = await vi.importActual<typeof import('../kdf-wasm-embedded')>('../kdf-wasm-embedded');
	embeddedState.sha = real.ARGON2ID_WASM_SHA256;
	embeddedState.b64 = real.ARGON2ID_WASM_BASE64;
	const loaded = await loadArgon2idEngine();
	if (!loaded) throw new Error('engine failed to load in the test environment');
	engine = loaded;
});

afterAll(() => {
	_resetArgon2idEngineForTesting();
	embeddedState.sha = '';
	embeddedState.b64 = '';
});

describe('kdf wasm engine seal seat (night-frontier-Z8)', () => {
	const sealKey = (seed: number): Uint8Array =>
		new Uint8Array(32).map((_, i) => (seed + i * 29 + i * i) & 0xff);
	const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

	it('reproduces the NIST GCM test case 13 vector byte-for-byte through the real ABI', async () => {
		const handle = engine.sealPut(new Uint8Array(NIST_GCM_TC13.key));
		expect(handle).toBeGreaterThan(0);
		const sealed = engine.sealSeal(
			handle,
			NIST_GCM_TC13.nonce,
			new Uint8Array(0),
			NIST_GCM_TC13.plaintext
		);
		expect(hexOf(sealed)).toBe(NIST_GCM_TC13.ciphertextTag);
		// The published anchor doubles as a WebCrypto cross-check: the
		// same inputs through WebCrypto produce the same 32 bytes.
		const web = await webcryptoSeal(
			NIST_GCM_TC13.key,
			NIST_GCM_TC13.nonce,
			new Uint8Array(0),
			NIST_GCM_TC13.plaintext
		);
		expect(hexOf(web)).toBe(NIST_GCM_TC13.ciphertextTag);
		engine.keystoreWipe(handle);
	});

	it('the engine seal equals WebCrypto across the deterministic matrix', async () => {
		// Edges ride the matrix: empty plaintext, empty AAD, 1 byte, 5 KB.
		const sizes = [0, 1, 15, 16, 33, 5120];
		// Two armed slots, wipe between them: the matrix crosses a
		// generation boundary and must stay byte-identical on both.
		for (const seed of [41, 42]) {
			const key = sealKey(seed);
			const handle = engine.sealPut(new Uint8Array(key));
			expect(handle).toBeGreaterThan(0);
			for (const size of sizes) {
				const nonce = randomBytes(prng, 12);
				const aad = randomBytes(prng, size % 3 === 0 ? 0 : 1 + (size % 24));
				const plaintext = randomBytes(prng, size);
				const sealed = engine.sealSeal(handle, nonce, aad, plaintext);
				const web = await webcryptoSeal(key, nonce, aad, plaintext);
				expect(hexOf(sealed)).toBe(hexOf(web));
				// The layout law: the last 16 bytes are the tag, so the
				// ciphertext length equals the plaintext length.
				expect(sealed.length).toBe(plaintext.length + 16);
			}
			engine.keystoreWipe(handle);
		}
	});

	it('interop is byte-identical in both directions', async () => {
		const key = sealKey(51);
		const handle = engine.sealPut(new Uint8Array(key));
		const nonce = randomBytes(prng, 12);
		const aad = randomBytes(prng, 9);
		const plaintext = randomBytes(prng, 61);
		// WebCrypto-sealed opens in the engine.
		const webSealed = await webcryptoSeal(key, nonce, aad, plaintext);
		const engineOpened = engine.sealOpen(handle, nonce, aad, webSealed);
		expect(hexOf(engineOpened)).toBe(hexOf(plaintext));
		// Engine-sealed opens in WebCrypto.
		const engineSealed = engine.sealSeal(handle, nonce, aad, plaintext);
		const gcmKey = await webcryptoGcmKey(key);
		const params: AesGcmParams = { name: 'AES-GCM', iv: nonce.slice().buffer as ArrayBuffer };
		params.additionalData = aad.slice().buffer as ArrayBuffer;
		const webOpened = await crypto.subtle.decrypt(
			params,
			gcmKey,
			engineSealed.slice().buffer as ArrayBuffer
		);
		expect(hexOf(new Uint8Array(webOpened))).toBe(hexOf(plaintext));
		engine.keystoreWipe(handle);
	});

	it('a flipped bit is refused by BOTH engines (failure parity)', async () => {
		const key = sealKey(61);
		const handle = engine.sealPut(new Uint8Array(key));
		const nonce = randomBytes(prng, 12);
		const plaintext = randomBytes(prng, 40);
		const sealed = engine.sealSeal(handle, nonce, new Uint8Array(0), plaintext);
		// Tamper the ciphertext (byte 0) and the tag (last byte).
		for (const flip of [0, sealed.length - 1]) {
			const tampered = new Uint8Array(sealed);
			tampered[flip] ^= 0x01;
			// Engine: an auth error, never garbage bytes.
			expect(() => engine.sealOpen(handle, nonce, new Uint8Array(0), tampered)).toThrow(
				/authentication failed/
			);
			// WebCrypto: an OperationError rejection - the same verdict.
			const gcmKey = await webcryptoGcmKey(key);
			await expect(
				crypto.subtle.decrypt(
					{ name: 'AES-GCM', iv: nonce.slice().buffer as ArrayBuffer },
					gcmKey,
					tampered.slice().buffer as ArrayBuffer
				)
			).rejects.toThrow();
		}
		engine.keystoreWipe(handle);
	});

	it('fails closed on every malformed seal input (kind cross-use included)', () => {
		const key = sealKey(71);
		// Wrong stage length.
		expect(() => engine.sealPut(new Uint8Array(31))).toThrow(/exactly 32 bytes/);
		const handle = engine.sealPut(new Uint8Array(key));
		const nonce = new Uint8Array(12);
		const msg = new Uint8Array(8);
		// Wrong nonce length (wrapper sanity) and invalid handles.
		expect(() => engine.sealSeal(handle, new Uint8Array(11), new Uint8Array(0), msg)).toThrow(
			/exactly 12 bytes/
		);
		expect(() => engine.sealSeal(0, nonce, new Uint8Array(0), msg)).toThrow(/keystore refusal/);
		expect(() => engine.sealOpen(0, nonce, new Uint8Array(0), new Uint8Array(17))).toThrow(
			/keystore refusal/
		);
		// Kind cross-use: an HMAC slot refuses to seal, a seal slot
		// refuses to sign - the witness key can never be an AES key.
		const hmacHandle = engine.keystorePut(new Uint8Array(key));
		expect(() => engine.sealSeal(hmacHandle, nonce, new Uint8Array(0), msg)).toThrow(
			/keystore refusal/
		);
		expect(() => engine.keystoreHmac(handle, msg)).toThrow(/keystore refusal/);
		engine.keystoreWipe(handle);
		engine.keystoreWipe(hmacHandle);
	});

	it('the seal wipe is provable: self-reported zero and use after wipe refuses', () => {
		const key = sealKey(81);
		const handle = engine.sealPut(new Uint8Array(key));
		expect(engine.keystoreIsZeroed(handle)).toBe(false);
		engine.keystoreWipe(handle);
		expect(engine.keystoreIsZeroed(handle)).toBe(true);
		expect(() =>
			engine.sealSeal(handle, new Uint8Array(12), new Uint8Array(0), new Uint8Array(1))
		).toThrow(/keystore refusal/);
		// A fresh install re-arms under a NEW opaque handle.
		const handle2 = engine.sealPut(new Uint8Array(key));
		expect(handle2).toBeGreaterThan(0);
		expect(handle2).not.toBe(handle);
		engine.keystoreWipe(handle2);
	});

	it('a full keystore refuses both seats with 0 - a refusal never collides with a handle', () => {
		const handles: number[] = [];
		for (let i = 0; i < engine.keystoreSlots(); i++) {
			const handle = engine.sealPut(new Uint8Array(sealKey(91 + i)));
			expect(handle).toBeGreaterThan(0);
			handles.push(handle);
		}
		// Every slot armed: BOTH puts refuse with 0 (mirroring
		// engine_alloc). Error codes 1..5 share the low nibble with gen-0
		// handles, so a refusal value in the handle space would hand the
		// caller a seat that can never work - the contract is 0, pinned
		// here as the regression guard for exactly that collision.
		expect(engine.sealPut(new Uint8Array(sealKey(99)))).toBe(0);
		expect(engine.keystorePut(new Uint8Array(sealKey(99)))).toBe(0);
		for (const handle of handles) engine.keystoreWipe(handle);
		// Capacity returns after the wipes; the last seat wipes too so
		// the battery never leaks armed slots across describes.
		const rearmed = engine.sealPut(new Uint8Array(sealKey(99)));
		expect(rearmed).toBeGreaterThan(0);
		engine.keystoreWipe(rearmed);
	});
});
