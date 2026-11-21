// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// @vitest-environment node
//
// night-frontier-Z8 - the seal key custody battery.
//
// The at-rest session seal key used to live only as a non-extractable
// CryptoKey (documented physics: released to GC at lock, never
// zeroizable). The engine's seal seat retires that gap for the
// passphrase-protected session. Pinned here, module by module:
//   1. Single ownership: the raw session material dies on EVERY install
//      path - engine slot (the engine zeroized its stage copy) and
//      WebCrypto fallback (importAesKey wipes).
//   2. Seat selection: engine-first by default, honest fallback under
//      force - both seats seal and open to the SAME bytes.
//   3. Envelope interop, both directions: bytes sealed by one custody
//      open under the other, because both sides implement the standard
//      GCM construction.
//   4. The lock wipe is provable: the engine slot self-reports all-zero
//      and refuses every further use (use after wipe is a refusal, not
//      a zero-key computation).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
	SEAL_KEY_LENGTH,
	installSealKey,
	sealWithKey,
	openWithKey,
	wipeSealKey,
	_sealSlotZeroStateForTesting,
	_forceSealFallbackForTesting,
	_resetSealKeyForTesting
} from '../seal-key';
import { randomBytes } from '../crypto-primitives';
import type { AtRestSealKey } from '../at-rest-state';

async function webcryptoKey(raw: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', raw.slice().buffer as ArrayBuffer, 'AES-GCM', false, [
		'encrypt',
		'decrypt'
	]);
}

async function webcryptoOpen(
	raw: Uint8Array,
	iv: Uint8Array,
	ciphertext: Uint8Array
): Promise<Uint8Array> {
	return new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
			await webcryptoKey(raw),
			ciphertext.slice().buffer as ArrayBuffer
		)
	);
}

async function webcryptoSeal(
	raw: Uint8Array,
	iv: Uint8Array,
	plaintext: Uint8Array
): Promise<Uint8Array> {
	return new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
			await webcryptoKey(raw),
			plaintext.slice().buffer as ArrayBuffer
		)
	);
}

describe('seal key custody (night-frontier-Z8)', () => {
	const rawKey = (seed: number): Uint8Array =>
		new Uint8Array(SEAL_KEY_LENGTH).map((_, i) => (seed + i * 17) & 0xff);
	const plaintextOf = (text: string): Uint8Array => new TextEncoder().encode(text);
	const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

	beforeEach(() => {
		_resetSealKeyForTesting();
	});

	afterEach(() => {
		_resetSealKeyForTesting();
	});

	it('installs into the engine custody by default and wipes the raw material', async () => {
		const raw = rawKey(11);
		const seat = await installSealKey(raw);
		if (seat.custody !== 'engine') throw new Error('the install must pick the engine seat');
		expect(seat.handle).toBeGreaterThan(0);
		// Single ownership: the caller's array died at the install.
		expect([...raw]).toEqual(new Array(SEAL_KEY_LENGTH).fill(0));
		// The armed slot self-reports NOT-zero.
		expect(_sealSlotZeroStateForTesting(seat)).toBe(false);
		wipeSealKey(seat);
	});

	it('falls back to the WebCrypto seat under force and wipes the raw material', async () => {
		_forceSealFallbackForTesting(true);
		const raw = rawKey(12);
		const seat = await installSealKey(raw);
		if (seat.custody !== 'webcrypto') throw new Error('the forced seat must be WebCrypto');
		expect(seat.key).toBeInstanceOf(CryptoKey);
		expect(seat.key.extractable).toBe(false);
		// The importAesKey ownership point wiped the caller's array.
		expect([...raw]).toEqual(new Array(SEAL_KEY_LENGTH).fill(0));
	});

	it('refuses a wrong-length install without touching the material', async () => {
		const raw = rawKey(13).slice(0, 31);
		expect(raw.length).toBe(31);
		await expect(installSealKey(raw)).rejects.toThrow(/32 bytes/);
	});

	it('seals and opens under the engine seat (round-trip)', async () => {
		const seat = await installSealKey(rawKey(14));
		const iv = randomBytes(12);
		const plaintext = plaintextOf('{"timestamp":1,"bmi":22.86}');
		const sealed = await sealWithKey(seat, iv, plaintext);
		// The WebCrypto layout law: ciphertext length equals plaintext
		// length; the tag rides the last 16 bytes.
		expect(sealed.length).toBe(plaintext.length + 16);
		const opened = await openWithKey(seat, iv, sealed);
		expect(hexOf(opened)).toBe(hexOf(plaintext));
		wipeSealKey(seat);
	});

	it('seals and opens under the WebCrypto fallback seat (round-trip)', async () => {
		_forceSealFallbackForTesting(true);
		const seat = await installSealKey(rawKey(15));
		const iv = randomBytes(12);
		const plaintext = plaintextOf('fallback round-trip');
		const sealed = await sealWithKey(seat, iv, plaintext);
		const opened = await openWithKey(seat, iv, sealed);
		expect(hexOf(opened)).toBe(hexOf(plaintext));
	});

	it('the two custody sides are envelope-identical (interop both directions)', async () => {
		const raw = rawKey(16);
		const engineSeat: AtRestSealKey = await installSealKey(new Uint8Array(raw));
		const iv = randomBytes(12);
		const plaintext = plaintextOf('interop across custody sides');
		// Engine-sealed opens under WebCrypto with the same raw key.
		const engineSealed = await sealWithKey(engineSeat, iv, plaintext);
		const webOpened = await webcryptoOpen(raw, iv, engineSealed);
		expect(hexOf(webOpened)).toBe(hexOf(plaintext));
		// WebCrypto-sealed opens under the engine seat.
		const webSealed = await webcryptoSeal(raw, iv, plaintext);
		const engineOpened = await openWithKey(engineSeat, iv, webSealed);
		expect(hexOf(engineOpened)).toBe(hexOf(plaintext));
		// The two seals of the same plaintext agree byte-for-byte (same
		// key, same IV, standard GCM on both sides).
		expect(hexOf(engineSealed)).toBe(hexOf(webSealed));
		wipeSealKey(engineSeat);
	});

	it('the lock wipe is provable: self-reported zero and use after wipe refuses', async () => {
		const seat = await installSealKey(rawKey(17));
		const iv = randomBytes(12);
		expect((await sealWithKey(seat, iv, plaintextOf('armed'))).length).toBeGreaterThan(0);
		wipeSealKey(seat);
		// The provable invariant: the slot self-reports all-zero from
		// inside the sandbox where the bytes live.
		expect(_sealSlotZeroStateForTesting(seat)).toBe(true);
		// Use after wipe is an ABI refusal - never a zero-key computation.
		await expect(sealWithKey(seat, iv, plaintextOf('after wipe'))).rejects.toThrow(
			/keystore refusal/
		);
		await expect(openWithKey(seat, iv, new Uint8Array(32))).rejects.toThrow(/keystore refusal/);
	});

	it('a full keystore degrades honestly to the WebCrypto seat', async () => {
		const { loadArgon2idEngine } = await import('../kdf-wasm-engine');
		const engine = await loadArgon2idEngine();
		expect(engine).not.toBeNull();
		const capacity = engine!.keystoreSlots();
		// Every slot arms an engine-custodied seat; nothing refuses into a
		// broken seat (the 0-refusal contract: a refusal is never a valid
		// handle value).
		const seats: AtRestSealKey[] = [];
		for (let i = 0; i < capacity; i++) {
			seats.push(await installSealKey(rawKey(90 + i)));
		}
		expect(seats.every((s) => s.custody === 'engine')).toBe(true);
		// One seat past capacity: the honest WebCrypto degrade, same key
		// semantics, same sealed bytes.
		const overflow = await installSealKey(rawKey(99));
		expect(overflow.custody).toBe('webcrypto');
		const iv = randomBytes(12);
		const sealed = await sealWithKey(overflow, iv, plaintextOf('overflow seat'));
		await expect(openWithKey(overflow, iv, sealed)).resolves.toEqual(plaintextOf('overflow seat'));
		for (const s of seats) wipeSealKey(s);
	});
});
