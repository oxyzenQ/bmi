// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z4 - the Device-Tier Argon2id Ladder battery.
//
// Proves:
//   1. The floor: every ladder rung, for every device tier, sits at or
//      above the OWASP Argon2id floor (m >= 19456 KiB, t >= 2, p >= 1).
//   2. The cross-device contract: the envelope's recorded parameters
//      drive decryption - a vault encrypted at the low rung opens on a
//      device whose ladder would choose the high rung, and the exact
//      parameters ride the envelope unchanged.
//   3. The legacy contract: envelopes without parameters (pre-ladder
//      files) decrypt with the fixed legacy defaults those files were
//      written with.
//   4. Fail-closed validation: tampered or absurd envelope parameters
//      (mem=8, mem beyond the 1 GiB cap, wrong type, wrong hashLen,
//      non-integers) refuse to derive.
//   5. The at-rest session is tier-stable: the rung comes from the
//      stored verifier, so a device that changes tier between sessions
//      re-derives the SAME key from the sealed ledger.
//   6. The round-trip byte contract: same passphrase + same params =>
//      byte-identical derivation across ladder rungs.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const lsStore = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => lsStore.get(k) ?? null,
	setItem: (k: string, v: string) => lsStore.set(k, String(v)),
	removeItem: (k: string) => lsStore.delete(k),
	clear: () => lsStore.clear()
});

const dbState = vi.hoisted(() => ({
	meta: new Map<string, string>(),
	kv: new Map<string, string>()
}));

vi.mock('../db', () => ({
	isIndexedDbAvailable: () => true,
	dbMetaGet: vi.fn(async (key: string) => dbState.meta.get(key) ?? null),
	dbMetaSet: vi.fn(async (key: string, value: string) => {
		dbState.meta.set(key, value);
	}),
	dbSet: vi.fn(async (key: string, value: string) => {
		dbState.kv.set(key, value);
	}),
	dbRemove: vi.fn(async (key: string) => {
		dbState.kv.delete(key);
	}),
	dbGetAll: vi.fn(async () => Array.from(dbState.kv, ([key, value]) => ({ key, value }))),
	dbClose: vi.fn(),
	dbBackupSave: vi.fn(async () => 1),
	dbBackupGetAll: vi.fn(async () => []),
	dbBackupLatest: vi.fn(async () => null),
	dbBackupDelete: vi.fn(async () => {})
}));

// The capability engine is the tier source: mockable per test.
const tierState = vi.hoisted(() => ({ tier: 'high' as 'high' | 'medium' | 'low' }));
vi.mock('../animation-config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../animation-config')>();
	return {
		...actual,
		getPerformanceTier: vi.fn(() => tierState.tier)
	};
});

import {
	STORAGE_KEYS,
	initStorage,
	storageInvalidateAll,
	_resetIdbWriteSeqForTesting
} from '../storage';
import {
	OWASP_FLOOR,
	KDF_CAPS,
	KDF_LADDER,
	TEST_KDF_OPTIONS,
	LEGACY_KDF_OPTIONS,
	getKdfOptions,
	resolveKdfOptionsForTier,
	validateEnvelopeKdfParams,
	envelopeParamsToOptions,
	_setKdfLadderOverrideForTesting
} from '../kdf-ladder';
import { enableEncryption, encrypt, decrypt, verifyPassphrase, disableEncryption } from '../crypto';
import { deriveKeyArgon2, randomBytes, toBase64 } from '../crypto-primitives';
import { registerAtRestSession, sealAtRestValue, openAtRestValue } from '../at-rest';
import {
	_resetAtRestStateForTesting,
	getAtRestSessionKey,
	shouldProtectAtRest
} from '../at-rest-state';
import { _resetWitnessKeyForTesting } from '../witness-key';
import { _resetSealKeyForTesting } from '../seal-key';
const PW = 'ladder-passphrase-1';
const PLAINTEXT = 'the vault payload that must survive a tier change';

beforeEach(() => {
	lsStore.clear();
	dbState.meta.clear();
	dbState.kv.clear();
	tierState.tier = 'high';
	_setKdfLadderOverrideForTesting(null);
	storageInvalidateAll();
	_resetIdbWriteSeqForTesting();
	_resetSealKeyForTesting(getAtRestSessionKey());
	_resetAtRestStateForTesting();
	_resetWitnessKeyForTesting();
	initStorage();
});

describe('the OWASP floor holds for every device tier', () => {
	it('every ladder rung sits at or above the floor', () => {
		for (const tier of ['high', 'medium', 'low'] as const) {
			const rung = KDF_LADDER[tier];
			expect(rung.m >= OWASP_FLOOR.m, `${tier}: m ${String(rung.m)} below the floor`).toBe(true);
			expect(rung.t >= OWASP_FLOOR.t, `${tier}: t ${String(rung.t)} below the floor`).toBe(true);
			expect(rung.p >= OWASP_FLOOR.p, `${tier}: p ${String(rung.p)} below the floor`).toBe(true);
		}
	});

	it('resolveKdfOptionsForTier maps each tier to its exact rung', () => {
		expect(resolveKdfOptionsForTier('high')).toEqual({ m: 65536, t: 3, p: 1, dkLen: 32 });
		expect(resolveKdfOptionsForTier('medium')).toEqual({ m: 32768, t: 3, p: 1, dkLen: 32 });
		expect(resolveKdfOptionsForTier('low')).toEqual({ m: 19456, t: 2, p: 1, dkLen: 32 });
	});

	it('the test-only override pins the rung and resets cleanly', () => {
		_setKdfLadderOverrideForTesting({ m: 19456, t: 2, p: 1, dkLen: 32 });
		expect(getKdfOptions()).toEqual({ m: 19456, t: 2, p: 1, dkLen: 32 });
		_setKdfLadderOverrideForTesting(null);
		expect(getKdfOptions()).toEqual(TEST_KDF_OPTIONS);
	});

	it('test mode stays on the CI-friendly parameters, excluded from the ladder', () => {
		expect(TEST_KDF_OPTIONS.m < OWASP_FLOOR.m).toBe(true);
		expect(import.meta.env.MODE).toBe('test');
	});

	it('deriveKeyArgon2 is byte-identical for the same passphrase, salt, and rung', async () => {
		const salt = randomBytes(16);
		const iv = randomBytes(12);
		const keyA = await deriveKeyArgon2(PW, salt, { m: 32768, t: 3, p: 1, dkLen: 32 });
		const keyB = await deriveKeyArgon2(PW, salt, { m: 32768, t: 3, p: 1, dkLen: 32 });
		// The keys are non-extractable, so identity is proven through the
		// observable output: the same plaintext under the same IV must
		// produce identical ciphertext.
		const data = new TextEncoder().encode('identity probe');
		const cA = new Uint8Array(
			await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, keyA, data)
		);
		const cB = new Uint8Array(
			await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, keyB, data)
		);
		expect(Array.from(cA)).toEqual(Array.from(cB));
	});
});

describe('the cross-device contract: envelope parameters drive decryption', () => {
	it('encrypt records the exact rung it used', async () => {
		_setKdfLadderOverrideForTesting({ m: 19456, t: 2, p: 1, dkLen: 32 });
		const envelope = JSON.parse(await encrypt(PLAINTEXT, PW)) as {
			kdfParams?: Record<string, unknown>;
		};
		expect(envelope.kdfParams).toEqual({
			type: 2,
			mem: 19456,
			time: 2,
			parallelism: 1,
			hashLen: 32
		});
	});

	it('a low-rung vault opens on a high-rung device (params ride the envelope)', async () => {
		// Seal at the low rung.
		_setKdfLadderOverrideForTesting({ m: 19456, t: 2, p: 1, dkLen: 32 });
		const envelope = await encrypt(PLAINTEXT, PW);
		// The reader's ladder would now choose a heavier rung.
		_setKdfLadderOverrideForTesting({ m: 32768, t: 3, p: 1, dkLen: 32 });
		const result = await decrypt(envelope, PW);
		expect(result).not.toBeNull();
		expect(result!.plaintext).toBe(PLAINTEXT);
	});

	it('a heavier-rung vault opens on a floor-rung device', async () => {
		_setKdfLadderOverrideForTesting({ m: 32768, t: 3, p: 1, dkLen: 32 });
		const envelope = await encrypt(PLAINTEXT, PW);
		_setKdfLadderOverrideForTesting({ m: 19456, t: 2, p: 1, dkLen: 32 });
		const result = await decrypt(envelope, PW);
		expect(result).not.toBeNull();
		expect(result!.plaintext).toBe(PLAINTEXT);
	});

	it('a pre-ladder envelope without parameters decrypts with the legacy defaults', async () => {
		// The legacy defaults are the high rung: encrypt there, then strip
		// the parameters the way a pre-ladder file looks.
		_setKdfLadderOverrideForTesting(LEGACY_KDF_OPTIONS);
		const envelope = JSON.parse(await encrypt(PLAINTEXT, PW)) as Record<string, unknown>;
		delete envelope.kdfParams;
		const result = await decrypt(JSON.stringify(envelope), PW);
		expect(result).not.toBeNull();
		expect(result!.plaintext).toBe(PLAINTEXT);
	});

	it('pins the tightened read-side caps — a burn ceiling, not reach (night-depth-hardening-5)', () => {
		// The old 1 GiB / t 64 ceiling let one hostile envelope OOM the
		// KDF worker. The caps sit 4x above the highest rung this app
		// writes (64 MiB / t 3 / p 1) and still bound a crafted file to
		// seconds per attempt. Raise only with the burn math redone.
		expect(KDF_CAPS).toEqual({ m: 262144, t: 8, p: 4 });
	});

	it('tampered parameters fail closed (mem=8, absurd caps, wrong type, wrong hashLen)', async () => {
		_setKdfLadderOverrideForTesting(LEGACY_KDF_OPTIONS);
		const envelope = JSON.parse(await encrypt(PLAINTEXT, PW)) as {
			kdfParams?: Record<string, unknown>;
		};
		const original = { ...envelope.kdfParams! };
		for (const [field, value] of [
			['mem', 8],
			['mem', KDF_CAPS.m + 1],
			['time', 0],
			['time', KDF_CAPS.t + 1],
			['parallelism', KDF_CAPS.p + 1],
			['parallelism', 1.5],
			['type', 1],
			['hashLen', 16]
		] as Array<[string, unknown]>) {
			envelope.kdfParams = { ...original, [field]: value };
			const result = await decrypt(JSON.stringify(envelope), PW);
			expect(result === null, `tampered ${field}=${String(value)} must refuse to derive`).toBe(
				true
			);
		}
	});

	it('a manually crafted floor-rung envelope opens with its own parameters', async () => {
		// Independent of encrypt(): derive the key at the floor rung and
		// seal an AES-GCM envelope by hand, then decrypt through the
		// envelope-parameter path.
		const salt = randomBytes(16);
		const iv = randomBytes(12);
		const key = await deriveKeyArgon2(PW, salt, { m: 19456, t: 2, p: 1, dkLen: 32 });
		const cipher = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
			key,
			new TextEncoder().encode(PLAINTEXT)
		);
		const payload = {
			format: 'bmi-encrypted-v3',
			cipher: 'aes-256-gcm',
			kdf: 'argon2id',
			kdfParams: { type: 2, mem: 19456, time: 2, parallelism: 1, hashLen: 32 },
			salt: toBase64(salt),
			iv: toBase64(iv),
			data: toBase64(new Uint8Array(cipher))
		};
		const result = await decrypt(JSON.stringify(payload), PW);
		expect(result).not.toBeNull();
		expect(result!.plaintext).toBe(PLAINTEXT);
	});
});

describe('the at-rest session is tier-stable across changes', () => {
	it('a tier change between sessions re-derives the SAME key from the sealed ledger', async () => {
		// Enable at the low rung: the verifier records floor parameters.
		tierState.tier = 'low';
		expect(await enableEncryption(PW)).toBe(true);
		expect(await shouldProtectAtRest(STORAGE_KEYS.HISTORY)).toBe(true);

		const sealed = await sealAtRestValue(PLAINTEXT);
		expect(sealed.startsWith('bmi-at-rest-v1:')).toBe(true);

		// Cold load: the session key is gone, the verifier stays.
		_resetSealKeyForTesting(getAtRestSessionKey());
		_resetAtRestStateForTesting();
		_resetWitnessKeyForTesting();

		// Re-register while the device reads as a heavier tier: the rung
		// must still come from the verifier (low), not the current ladder.
		_setKdfLadderOverrideForTesting({ m: 32768, t: 3, p: 1, dkLen: 32 });
		await registerAtRestSession(PW);
		const opened = await openAtRestValue(sealed);
		expect(opened).not.toBeNull();
		expect(opened).toBe(PLAINTEXT);

		// And the file flow agrees: verifyPassphrase uses the same anchor.
		expect(await verifyPassphrase(PW)).toBe(true);

		await disableEncryption();
	});
});

describe('envelope parameter validation surface', () => {
	it('accepts a valid floor envelope', () => {
		expect(
			validateEnvelopeKdfParams({ type: 2, mem: 19456, time: 2, parallelism: 1, hashLen: 32 })
		).toBe(true);
	});

	it('rejects non-objects, wrong types, wrong hashLen, and out-of-cap values', () => {
		const bad: unknown[] = [
			null,
			'x',
			{},
			{ type: 1, mem: 19456, time: 2, parallelism: 1, hashLen: 32 },
			{ type: 2, mem: 19456, time: 2, parallelism: 1, hashLen: 16 },
			{ type: 2, mem: 0, time: 2, parallelism: 1, hashLen: 32 },
			{ type: 2, mem: KDF_CAPS.m + 1, time: 2, parallelism: 1, hashLen: 32 },
			{ type: 2, mem: 19456, time: KDF_CAPS.t + 1, parallelism: 1, hashLen: 32 },
			{ type: 2, mem: 19456, time: 2, parallelism: KDF_CAPS.p + 1, hashLen: 32 },
			{ type: 2, mem: 19456.5, time: 2, parallelism: 1, hashLen: 32 },
			{ type: 2, mem: Number.NaN, time: 2, parallelism: 1, hashLen: 32 }
		];
		for (const params of bad) {
			expect(validateEnvelopeKdfParams(params), JSON.stringify(params)).toBe(false);
		}
	});

	it('maps validated parameters to options losslessly', () => {
		expect(
			envelopeParamsToOptions({ type: 2, mem: 32768, time: 3, parallelism: 1, hashLen: 32 })
		).toEqual({ m: 32768, t: 3, p: 1, dkLen: 32 });
	});
});
