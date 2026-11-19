// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z6 - the witness attestation key battery.
//
// Proves the keyed witness law's keystone invariants:
//   1. Install discipline: the material is copied, the caller's array
//      is wiped on return (the importAesKey discipline), the length is
//      enforced, and reinstalling replaces and wipes the old key.
//   2. Zeroization proof: after wipeWitnessKey(), the exact array the
//      module held is all zeros - observable through the MAC closure
//      itself, which must then compute EXACTLY what a zero-key HMAC
//      computes. A JS array that merely "dropped" its reference could
//      never be proven like this.
//   3. The MAC is real HMAC-SHA256: pinned against WebCrypto's
//      subtle.sign for sample messages (the same cross-implementation
//      check the chain battery runs against the reference).
//   4. The fingerprint is public, stable for the same material, and
//      distinct across material - and it dies with the key.

import { describe, it, expect, beforeEach } from 'vitest';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
	_resetWitnessKeyForTesting,
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

beforeEach(() => {
	_resetWitnessKeyForTesting();
});

describe('witness key install discipline', () => {
	it('copies the material and wipes the caller array on return', () => {
		const material = keyBytes(1);
		installWitnessKey(material);
		// The caller's array is dead after install - every byte zero.
		expect(material.every((b) => b === 0)).toBe(true);
		expect(hasWitnessKey()).toBe(true);
		expect(getWitnessKeyFingerprint()).not.toBeNull();
	});

	it('enforces the 32-byte key length fail-closed', () => {
		expect(() => installWitnessKey(new Uint8Array(31))).toThrow(/32 bytes/);
		expect(() => installWitnessKey(new Uint8Array(33))).toThrow(/32 bytes/);
		expect(hasWitnessKey()).toBe(false);
	});

	it('replaces an installed key and wipes the old material', () => {
		installWitnessKey(keyBytes(2));
		const oldMac = getWitnessMac()!;
		const oldOutput = oldMac(new TextEncoder().encode('ledger sample'));
		installWitnessKey(keyBytes(3));
		const newMac = getWitnessMac()!;
		const newOutput = newMac(new TextEncoder().encode('ledger sample'));
		expect(bytesToHex(newOutput)).not.toBe(bytesToHex(oldOutput));
		// The OLD closure now computes under wiped (zeroed) bytes: it can
		// never produce the old key's tag again.
		const zeroKey = new Uint8Array(32);
		expect(bytesToHex(oldMac(new TextEncoder().encode('ledger sample')))).toBe(
			bytesToHex(hmac(sha256, zeroKey, new TextEncoder().encode('ledger sample')))
		);
	});
});

describe('witness key zeroization proof (the invariant JS cannot fake)', () => {
	it('proves all-zero material after wipe through the surviving MAC closure', () => {
		installWitnessKey(keyBytes(4));
		const mac = getWitnessMac()!;
		const sample = new TextEncoder().encode('witness zeroization proof');
		const before = bytesToHex(mac(sample));
		wipeWitnessKey();
		// The module dropped the key, but the closure still references the
		// exact array - and that array MUST now be all zeros: the wiped MAC
		// equals the zero-key MAC, byte for byte, and differs from the
		// installed key's tag.
		const zeroKey = new Uint8Array(32);
		expect(bytesToHex(mac(sample))).toBe(bytesToHex(hmac(sha256, zeroKey, sample)));
		expect(bytesToHex(mac(sample))).not.toBe(before);
		expect(hasWitnessKey()).toBe(false);
		expect(getWitnessKeyFingerprint()).toBeNull();
		expect(getWitnessMac()).toBeNull();
	});
});

describe('witness mac is real HMAC-SHA256', () => {
	it('matches WebCrypto subtle.sign across sample messages', async () => {
		installWitnessKey(keyBytes(5));
		const mac = getWitnessMac()!;
		const key = keyBytes(5);
		const samples = [
			'',
			'genesis link',
			'{"timestamp":1,"bmi":22.5,"height":170,"weight":65,"age":30}',
			'unicode record: 身体质量指数'
		];
		for (const text of samples) {
			const msg = new TextEncoder().encode(text);
			expect(bytesToHex(mac(msg))).toBe(await webCryptoHmacHex(key, msg));
		}
	});

	it('produces distinct tags for distinct messages (no collisions)', () => {
		installWitnessKey(keyBytes(6));
		const mac = getWitnessMac()!;
		const a = bytesToHex(mac(new TextEncoder().encode('record 1')));
		const b = bytesToHex(mac(new TextEncoder().encode('record 2')));
		expect(a).not.toBe(b);
		expect(a).toHaveLength(64);
	});
});

describe('witness key fingerprint (public attestation identity)', () => {
	it('is stable for the same material and distinct across material', () => {
		installWitnessKey(keyBytes(7));
		const first = getWitnessKeyFingerprint();
		installWitnessKey(keyBytes(7));
		expect(getWitnessKeyFingerprint()).toBe(first);
		installWitnessKey(keyBytes(8));
		expect(getWitnessKeyFingerprint()).not.toBe(first);
	});

	it('matches the SHA-256 hex of the material exactly', () => {
		const key = keyBytes(9);
		installWitnessKey(new Uint8Array(key));
		expect(getWitnessKeyFingerprint()).toBe(bytesToHex(sha256(key)));
	});

	it('exposes the documented key length constant', () => {
		expect(WITNESS_MAC_LENGTH).toBe(32);
	});
});
