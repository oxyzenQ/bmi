// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-enhance-1 - the wasm Argon2id engine proof suite.
//
// Proves, in order of severity:
//   1. Provenance: the embedded artifact decodes to exactly the recorded
//      SHA-256 (the shipped bytes are the built bytes).
//   2. Known-answer: the engine reproduces the RFC 9106 section 5.3
//      Argon2id tag byte-for-byte through the real ABI, and the noble
//      implementation agrees - two independent implementations, one
//      published anchor.
//   3. Cross-check: a deterministic randomized matrix over passphrases,
//      salts, parameters, and output lengths in which the engines must
//      agree byte-for-byte on every vector.
//   4. Error parity: every input one engine rejects, the other rejects.
//   5. Envelope interop: a key derived by the wasm engine decrypts what
//      the JS engine encrypted, and the reverse - the envelope format
//      and the at-rest seal do not change with the engine.
//   6. Production anchor: the real 64 MiB / t=3 / p=1 derivation agrees
//      byte-for-byte (the one slow test, budgeted).
//   7. Fail-closed loading: a tampered artifact digest refuses the
//      engine instead of instantiating it.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { argon2id } from '@noble/hashes/argon2.js';

// The embedded-artifact module is mocked with live getters so the
// tamper test can poison the digest and restore it without touching
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

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

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

const prng = makePrng(0x6d656173); // 'meas'

function randomBytes(prng: () => number, length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) bytes[i] = Math.floor(prng() * 256);
	return bytes;
}

/** The RFC 9106 section 5.3 Argon2id known-answer vector. */
const RFC_9106_ARGON2ID = {
	password: new Uint8Array(32).fill(0x01),
	salt: new Uint8Array(16).fill(0x02),
	secret: new Uint8Array(8).fill(0x03),
	associatedData: new Uint8Array(12).fill(0x04),
	m: 32,
	t: 3,
	p: 4,
	dkLen: 32,
	tag: '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659'
};

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

/** Noble-shaped derive call for the cross-check (secret/AD unsupported there by default opts). */
function nobleDerive(
	password: Uint8Array,
	salt: Uint8Array,
	opts: {
		m: number;
		t: number;
		p: number;
		dkLen: number;
		key?: Uint8Array;
		personalization?: Uint8Array;
	}
): Uint8Array {
	return argon2id(password, salt, opts);
}

describe('kdf wasm engine artifact provenance', () => {
	it('decodes the embedded artifact to the recorded SHA-256 digest', async () => {
		const bytes = Uint8Array.from(atob(embeddedState.b64), (c) => c.charCodeAt(0));
		const digest = hex(await crypto.subtle.digest('SHA-256', bytes).then((b) => new Uint8Array(b)));
		expect(digest).toBe(embeddedState.sha);
	});

	it('exposes the expected ABI version', () => {
		expect(engine.abiVersion).toBe(2);
	});
});

describe('kdf wasm engine known-answer proof (RFC 9106 section 5.3)', () => {
	it('reproduces the RFC tag byte-for-byte through the real ABI', () => {
		const derived = engine.derive(RFC_9106_ARGON2ID.password, RFC_9106_ARGON2ID.salt, {
			m: RFC_9106_ARGON2ID.m,
			t: RFC_9106_ARGON2ID.t,
			p: RFC_9106_ARGON2ID.p,
			dkLen: RFC_9106_ARGON2ID.dkLen,
			key: RFC_9106_ARGON2ID.secret,
			personalization: RFC_9106_ARGON2ID.associatedData
		});
		expect(hex(derived)).toBe(RFC_9106_ARGON2ID.tag);
	});

	it('and the noble implementation reproduces the same tag', () => {
		const derived = nobleDerive(RFC_9106_ARGON2ID.password, RFC_9106_ARGON2ID.salt, {
			m: RFC_9106_ARGON2ID.m,
			t: RFC_9106_ARGON2ID.t,
			p: RFC_9106_ARGON2ID.p,
			dkLen: RFC_9106_ARGON2ID.dkLen,
			key: RFC_9106_ARGON2ID.secret,
			personalization: RFC_9106_ARGON2ID.associatedData
		});
		expect(hex(derived)).toBe(RFC_9106_ARGON2ID.tag);
	});
});

describe('kdf wasm engine cross-check matrix (wasm === noble, byte-for-byte)', () => {
	const passphrases: string[] = [
		'',
		'x',
		'correct horse battery staple',
		'passphrase-dengan-spasi-dan-unicode-\u00e9\u4e2d\u6587',
		'P@ssw0rd!' + '0'.repeat(200)
	];
	const passBytes: Uint8Array[] = [
		new Uint8Array(0),
		new Uint8Array([1]),
		randomBytes(prng, 7),
		randomBytes(prng, 64),
		randomBytes(prng, 1024)
	];

	it('agrees on every matrix vector', () => {
		const checks: Array<{
			pass: number;
			saltLen: number;
			m: number;
			t: number;
			p: number;
			dkLen: number;
		}> = [];
		for (const pass of [...passBytes, ...passphrases.map((p) => new TextEncoder().encode(p))]) {
			for (const saltLen of [8, 16, 32]) {
				const salt = randomBytes(prng, saltLen);
				const m = [1024, 2048][Math.floor(prng() * 2)];
				const t = 1 + Math.floor(prng() * 3);
				const p = 1 + Math.floor(prng() * 2);
				const dkLen = [16, 32, 64][Math.floor(prng() * 3)];
				const wasmOut = engine.derive(pass, salt, { m, t, p, dkLen });
				const nobleOut = nobleDerive(pass, salt, { m, t, p, dkLen });
				expect({ pass: pass.length, saltLen, m, t, p, dkLen, hash: hex(wasmOut) }).toEqual({
					pass: pass.length,
					saltLen,
					m,
					t,
					p,
					dkLen,
					hash: hex(nobleOut)
				});
				checks.push({ pass: pass.length, saltLen, m, t, p, dkLen });
			}
		}
		expect(checks.length).toBe(30);
	});

	it('agrees with an explicit secret and associated data (non-app inputs, KAT-grade)', () => {
		const pass = randomBytes(prng, 32);
		const salt = randomBytes(prng, 16);
		const key = randomBytes(prng, 8);
		const ad = randomBytes(prng, 12);
		const wasmOut = engine.derive(pass, salt, {
			m: 1024,
			t: 2,
			p: 1,
			dkLen: 32,
			key,
			personalization: ad
		});
		const nobleOut = nobleDerive(pass, salt, {
			m: 1024,
			t: 2,
			p: 1,
			dkLen: 32,
			key,
			personalization: ad
		});
		expect(hex(wasmOut)).toBe(hex(nobleOut));
	});
});

describe('kdf wasm engine error parity (what one engine rejects, both reject)', () => {
	it('rejects a salt below the 8-byte RFC floor in both engines', () => {
		const salt = new Uint8Array(4).fill(9);
		expect(() =>
			engine.derive(new Uint8Array([1, 2, 3]), salt, { m: 1024, t: 1, p: 1, dkLen: 32 })
		).toThrow();
		expect(() =>
			nobleDerive(new Uint8Array([1, 2, 3]), salt, { m: 1024, t: 1, p: 1, dkLen: 32 })
		).toThrow();
	});

	it('rejects an output below the 4-byte minimum in the engine', () => {
		const salt = randomBytes(prng, 16);
		expect(() =>
			engine.derive(new Uint8Array([1, 2, 3]), salt, { m: 1024, t: 1, p: 1, dkLen: 3 })
		).toThrow();
	});

	it('rejects memory below the 8*p lane floor in both engines', () => {
		const salt = randomBytes(prng, 16);
		expect(() =>
			engine.derive(new Uint8Array([1]), salt, { m: 8, t: 1, p: 2, dkLen: 32 })
		).toThrow();
		expect(() => nobleDerive(new Uint8Array([1]), salt, { m: 8, t: 1, p: 2, dkLen: 32 })).toThrow();
	});

	it('rejects zero iterations in both engines', () => {
		const salt = randomBytes(prng, 16);
		expect(() =>
			engine.derive(new Uint8Array([1]), salt, { m: 1024, t: 0, p: 1, dkLen: 32 })
		).toThrow();
		expect(() =>
			nobleDerive(new Uint8Array([1]), salt, { m: 1024, t: 0, p: 1, dkLen: 32 })
		).toThrow();
	});
});

describe('kdf wasm engine envelope interop (the envelope format does not change)', () => {
	const plaintext = new TextEncoder().encode('bmi-stellar envelope interop proof');
	const salt = randomBytes(prng, 16);
	const iv = randomBytes(prng, 12);
	const passphrase = 'envelope-interop-passphrase';

	/** Fresh-buffer copy - the WebCrypto BufferSource hygiene of crypto-primitives.toAB. */
	function toAB(src: Uint8Array): ArrayBuffer {
		const ab = new ArrayBuffer(src.length);
		new Uint8Array(ab).set(src);
		return ab;
	}

	async function aesKey(bytes: Uint8Array): Promise<CryptoKey> {
		const material = new Uint8Array(bytes);
		const key = await crypto.subtle.importKey(
			'raw',
			material.buffer,
			{ name: 'AES-GCM', length: 256 },
			false,
			['encrypt', 'decrypt']
		);
		material.fill(0);
		return key;
	}

	it('a wasm-derived key decrypts what a noble-derived key encrypted', async () => {
		const nobleKey = await aesKey(
			nobleDerive(new TextEncoder().encode(passphrase), salt, { m: 1024, t: 1, p: 1, dkLen: 32 })
		);
		const sealed = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: toAB(iv) },
			nobleKey,
			toAB(plaintext)
		);

		const wasmBytes = engine.derive(new TextEncoder().encode(passphrase), salt, {
			m: 1024,
			t: 1,
			p: 1,
			dkLen: 32
		});
		const wasmKey = await aesKey(wasmBytes);
		const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toAB(iv) }, wasmKey, sealed);
		expect(new Uint8Array(opened)).toEqual(plaintext);
	});

	it('a noble-derived key decrypts what a wasm-derived key encrypted', async () => {
		const wasmKey = await aesKey(
			engine.derive(new TextEncoder().encode(passphrase), salt, { m: 1024, t: 1, p: 1, dkLen: 32 })
		);
		const sealed = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: toAB(iv) },
			wasmKey,
			toAB(plaintext)
		);

		const nobleKey = await aesKey(
			nobleDerive(new TextEncoder().encode(passphrase), salt, { m: 1024, t: 1, p: 1, dkLen: 32 })
		);
		const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toAB(iv) }, nobleKey, sealed);
		expect(new Uint8Array(opened)).toEqual(plaintext);
	});
});

describe('kdf wasm engine production anchor (64 MiB, t=3, p=1)', () => {
	it('matches the JS engine byte-for-byte at the real parameters', async () => {
		const pass = new TextEncoder().encode('production-params-anchor');
		const salt = randomBytes(prng, 16);
		const wasmOut = engine.derive(pass, salt, { m: 64 * 1024, t: 3, p: 1, dkLen: 32 });
		const nobleOut = nobleDerive(pass, salt, { m: 64 * 1024, t: 3, p: 1, dkLen: 32 });
		expect(hex(wasmOut)).toBe(hex(nobleOut));
	}, 20000);
});

describe('kdf wasm engine fail-closed loading', () => {
	it('refuses the engine when the artifact digest does not match', async () => {
		embeddedState.sha = '0'.repeat(64);
		_resetArgon2idEngineForTesting();
		const refused = await loadArgon2idEngine();
		expect(refused).toBeNull();
		embeddedState.sha = 'f'.repeat(64);
		_resetArgon2idEngineForTesting();
		const refusedAgain = await loadArgon2idEngine();
		expect(refusedAgain).toBeNull();
	});

	it('loads a valid engine again after the tampered attempts are restored', async () => {
		embeddedState.sha = '';
		_resetArgon2idEngineForTesting();
		const real =
			await vi.importActual<typeof import('../kdf-wasm-embedded')>('../kdf-wasm-embedded');
		embeddedState.sha = real.ARGON2ID_WASM_SHA256;
		const restored = await loadArgon2idEngine();
		expect(restored).not.toBeNull();
		expect(restored!.abiVersion).toBe(2);
	});
});

// ── night-frontier-Z6: the keystore seat battery ──
// The engine is no longer only a key forge, it is also key custody.
// The deep slot-level invariants, pinned against the digest-verified
// artifact:
//   1. Byte-identity: the in-engine HMAC-SHA256 equals noble's - one
//      construction, two engines, zero tolerance.
//   2. The armed slot self-reports NOT-zero; the wiped slot
//      self-reports all-zero AND refuses every further use: the
//      zeroization is deterministic (volatile writes) and use after
//      wipe is an ABI refusal, not a zero-key computation.
//   3. Fail-closed everywhere: wrong stage length, wrong handle, wrong
//      output length - all refused.

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

describe('kdf wasm engine keystore seat (night-frontier-Z6)', () => {
	const putKey = (seed: number): Uint8Array =>
		new Uint8Array(32).map((_, i) => (seed + i * 13) & 0xff);
	const msgOf = (text: string): Uint8Array => new TextEncoder().encode(text);
	const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

	it('exposes the keystore capacity the wrapper asserts', () => {
		expect(engine.keystoreSlots()).toBeGreaterThanOrEqual(4);
	});

	it('the in-engine HMAC-SHA256 equals noble byte-for-byte (both modes)', () => {
		const key = putKey(21);
		const handle = engine.keystorePut(new Uint8Array(key));
		expect(handle).toBeGreaterThan(0);
		const samples = ['', 'genesis link', 'unicode: 身体質量指数', '{"timestamp":1,"bmi":22.86}'];
		for (const text of samples) {
			const msg = msgOf(text);
			const engineTag = engine.keystoreHmac(handle, msg);
			const nobleTag = hmac(sha256, key, msg);
			expect(hexOf(engineTag)).toBe(hexOf(nobleTag));
		}
		// The armed slot self-reports NOT-zero.
		expect(engine.keystoreIsZeroed(handle)).toBe(false);
		engine.keystoreWipe(handle);
	});

	it('the wipe is provable: the slot self-reports all-zero and refuses use', () => {
		const key = putKey(22);
		const handle = engine.keystorePut(new Uint8Array(key));
		expect(engine.keystoreIsZeroed(handle)).toBe(false);
		const tag = hexOf(engine.keystoreHmac(handle, msgOf('armed slot signs')));
		expect(tag).toBe(hexOf(hmac(sha256, key, msgOf('armed slot signs'))));
		engine.keystoreWipe(handle);
		// The provable invariant: the slot reports all-zero from inside
		// the sandbox where the bytes live.
		expect(engine.keystoreIsZeroed(handle)).toBe(true);
		// Use after wipe is an ABI refusal - never a zero-key computation.
		expect(() => engine.keystoreHmac(handle, msgOf('after wipe'))).toThrow(/keystore refusal/);
		// A fresh install re-arms the slot system under a NEW opaque
		// handle (the old handle's generation is dead forever).
		const handle2 = engine.keystorePut(new Uint8Array(key));
		expect(handle2).toBeGreaterThan(0);
		expect(handle2).not.toBe(handle);
		expect(engine.keystoreIsZeroed(handle2)).toBe(false);
		engine.keystoreWipe(handle2);
	});

	it('fails closed on every malformed keystore input', () => {
		// Wrong stage length.
		expect(() => engine.keystorePut(new Uint8Array(31))).toThrow(/exactly 32 bytes/);
		// Invalid handles: zero, past capacity.
		expect(() => engine.keystoreHmac(0, msgOf('x'))).toThrow(/keystore refusal/);
		expect(() => engine.keystoreHmac(engine.keystoreSlots() + 1, msgOf('x'))).toThrow(
			/keystore refusal/
		);
		expect(() => engine.keystoreWipe(0)).toThrow(/keystore refusal/);
		expect(() => engine.keystoreIsZeroed(0)).toThrow(/keystore refusal/);
		// Never-installed handle: nothing was armed there.
		expect(() => engine.keystoreHmac(engine.keystoreSlots(), msgOf('x'))).toThrow(
			/keystore refusal/
		);
	});

	it('custodies multiple concurrent slots without cross-talk', () => {
		const keyA = putKey(31);
		const keyB = putKey(32);
		const handleA = engine.keystorePut(new Uint8Array(keyA));
		const handleB = engine.keystorePut(new Uint8Array(keyB));
		expect(handleA).not.toBe(handleB);
		expect(hexOf(engine.keystoreHmac(handleA, msgOf('dual')))).toBe(
			hexOf(hmac(sha256, keyA, msgOf('dual')))
		);
		expect(hexOf(engine.keystoreHmac(handleB, msgOf('dual')))).toBe(
			hexOf(hmac(sha256, keyB, msgOf('dual')))
		);
		engine.keystoreWipe(handleA);
		// Wiping A leaves B armed and correct.
		expect(engine.keystoreIsZeroed(handleA)).toBe(true);
		expect(hexOf(engine.keystoreHmac(handleB, msgOf('dual')))).toBe(
			hexOf(hmac(sha256, keyB, msgOf('dual')))
		);
		engine.keystoreWipe(handleB);
	});
});
