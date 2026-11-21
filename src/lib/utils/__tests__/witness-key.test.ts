// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// @vitest-environment node
//
// night-frontier-Z6 - the witness attestation key battery.
//
// Two custody paths, both proven:
//   ENGINE (default here: the digest-verified artifact loads in Node):
//     the material lives in a keystore slot inside the engine's linear
//     memory, the MAC runs in-engine, and the lock wipe is the engine's
//     own volatile zeroization - after it, a fresh install proves the
//     slot system works and getWitnessMac is null (the deep slot-level
//     invariant: armed hmac, zero-report wipe, use-after-wipe refusal -
//     is pinned by the engine battery).
//   JS FALLBACK (forced): the material is a wipeable array; the
//     zeroization proof is the surviving MAC closure, which must
//     compute EXACTLY what a zero-key HMAC computes after the wipe - a
//     proof no dropped-reference JS object offers.
//
// Shared install discipline: the caller array is wiped on install, the
// length is enforced, reinstalling replaces and wipes the old key, and
// the fingerprint is public, stable per material, and distinct across
// material.

import { describe, it, expect, beforeEach } from 'vitest';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
	_resetWitnessKeyForTesting,
	_forceWitnessFallbackForTesting,
	_witnessKeyPathForTesting,
	getWitnessKeyFingerprint,
	getWitnessMac,
	hasWitnessKey,
	installWitnessKey,
	wipeWitnessKey,
	WITNESS_MAC_LENGTH
} from '../witness-key';

function keyBytes(seed: number): Uint8Array {
	const bytes = new Uint8Array(32);
	for (let i = 0; i < 32; i++) bytes[i] = (seed + i * 11) & 0xff;
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function webCryptoHmacHex(key: Uint8Array, msg: Uint8Array): Promise<string> {
	const ab = new ArrayBuffer(key.length);
	new Uint8Array(ab).set(key);
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		ab,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const msgAb = new ArrayBuffer(msg.length);
	new Uint8Array(msgAb).set(msg);
	const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgAb);
	return bytesToHex(new Uint8Array(sig));
}

const SAMPLE = 'witness custody proof sample';
const sampleMsg = (): Uint8Array => new TextEncoder().encode(SAMPLE);

beforeEach(() => {
	_resetWitnessKeyForTesting();
});

describe('witness key install discipline (both custody paths)', () => {
	it('copies the material and wipes the caller array on return', async () => {
		const material = keyBytes(1);
		await installWitnessKey(material);
		// The caller's array is dead after install - every byte zero.
		expect(material.every((b) => b === 0)).toBe(true);
		expect(hasWitnessKey()).toBe(true);
		expect(getWitnessKeyFingerprint()).not.toBeNull();
		expect(_witnessKeyPathForTesting()).not.toBeNull();
	});

	it('enforces the 32-byte key length fail-closed', async () => {
		await expect(installWitnessKey(new Uint8Array(31))).rejects.toThrow(/32 bytes/);
		await expect(installWitnessKey(new Uint8Array(33))).rejects.toThrow(/32 bytes/);
		expect(hasWitnessKey()).toBe(false);
	});

	it('is real HMAC-SHA256: matches WebCrypto subtle.sign', async () => {
		await installWitnessKey(keyBytes(2));
		const mac = getWitnessMac()!;
		const key = keyBytes(2);
		const samples = [
			'',
			'genesis link',
			'{"timestamp":1,"bmi":22.5,"height":170,"weight":65,"age":30}',
			'unicode record: 身体质量指数'
		];
		for (const text of samples) {
			expect(bytesToHex(mac(new TextEncoder().encode(text)))).toBe(
				await webCryptoHmacHex(key, new TextEncoder().encode(text))
			);
		}
	});

	it('fingerprint: stable per material, distinct across material, dies with the key', async () => {
		await installWitnessKey(keyBytes(3));
		const first = getWitnessKeyFingerprint();
		await installWitnessKey(keyBytes(3));
		expect(getWitnessKeyFingerprint()).toBe(first);
		await installWitnessKey(keyBytes(4));
		expect(getWitnessKeyFingerprint()).not.toBe(first);
		expect(getWitnessKeyFingerprint()).toBe(bytesToHex(sha256(keyBytes(4))));
		wipeWitnessKey();
		expect(getWitnessKeyFingerprint()).toBeNull();
	});

	it('exposes the documented key length constant', () => {
		expect(WITNESS_MAC_LENGTH).toBe(32);
	});
});

describe('engine custody path (the default when the artifact loads)', () => {
	it('custodies the key in the engine and MACs in-engine', async () => {
		await installWitnessKey(keyBytes(5));
		expect(_witnessKeyPathForTesting()).toBe('engine');
		const mac = getWitnessMac()!;
		// The in-engine tag agrees with noble: one construction, two engines.
		expect(bytesToHex(mac(sampleMsg()))).toBe(await webCryptoHmacHex(keyBytes(5), sampleMsg()));
	});

	it('a replaced key wipes the old slot: the old closure can never sign again', async () => {
		await installWitnessKey(keyBytes(6));
		const oldMac = getWitnessMac()!;
		const before = bytesToHex(oldMac(sampleMsg()));
		await installWitnessKey(keyBytes(7));
		// The engine slot refused (use after wipe is an ABI refusal), the
		// fingerprint moved, and the new key's tag differs.
		expect(() => oldMac(sampleMsg())).toThrow(/keystore refusal/);
		expect(bytesToHex(getWitnessMac()!(sampleMsg()))).not.toBe(before);
	});

	it('the wipe disarms the slot: nothing can sign after lock', async () => {
		await installWitnessKey(keyBytes(8));
		const mac = getWitnessMac()!;
		expect(bytesToHex(mac(sampleMsg()))).toBeTruthy();
		wipeWitnessKey();
		expect(hasWitnessKey()).toBe(false);
		expect(getWitnessMac()).toBeNull();
		// The surviving closure hits a wiped slot: refused, never a
		// zero-key computation.
		expect(() => mac(sampleMsg())).toThrow(/keystore refusal/);
		// A fresh install works again: the slot system, not the instance,
		// was the thing under test.
		await installWitnessKey(keyBytes(9));
		expect(getWitnessMac()!(sampleMsg())).toBeTruthy();
	});
});

describe('JS fallback custody path (forced; the honest degrade)', () => {
	beforeEach(() => {
		_forceWitnessFallbackForTesting(true);
	});

	it('custodies the key as wipeable JS bytes', async () => {
		await installWitnessKey(keyBytes(10));
		expect(_witnessKeyPathForTesting()).toBe('js');
		const mac = getWitnessMac()!;
		expect(bytesToHex(mac(sampleMsg()))).toBe(await webCryptoHmacHex(keyBytes(10), sampleMsg()));
	});

	it('proves all-zero material after wipe through the surviving MAC closure', async () => {
		await installWitnessKey(keyBytes(11));
		const mac = getWitnessMac()!;
		const before = bytesToHex(mac(sampleMsg()));
		wipeWitnessKey();
		// The module dropped the key, but the closure still references the
		// exact array - and that array MUST now be all zeros: the wiped MAC
		// equals the zero-key MAC, byte for byte, and differs from the
		// installed key's tag.
		const zeroKey = new Uint8Array(32);
		expect(bytesToHex(mac(sampleMsg()))).toBe(bytesToHex(hmac(sha256, zeroKey, sampleMsg())));
		expect(bytesToHex(mac(sampleMsg()))).not.toBe(before);
		expect(hasWitnessKey()).toBe(false);
		expect(getWitnessMac()).toBeNull();
	});

	it('a replaced key wipes the old array: the old closure computes under zeros', async () => {
		await installWitnessKey(keyBytes(12));
		const oldMac = getWitnessMac()!;
		await installWitnessKey(keyBytes(13));
		const zeroKey = new Uint8Array(32);
		expect(bytesToHex(oldMac(sampleMsg()))).toBe(bytesToHex(hmac(sha256, zeroKey, sampleMsg())));
	});
});
