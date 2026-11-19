// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Node environment: jsdom's crypto.subtle is non-functional on the Bun
// CI runners - native subtle is needed here. The at-rest ledger seal
// battery (night-frontier-Z1): round-trips, session lifecycle, salt
// persistence, storage integration, unlock hooks, backup/restore,
// zero-change canaries. Every test waits for terminal state via
// vi.waitFor, never racing the write queue.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Polyfill localStorage for @vitest-environment node (no DOM)
const lsStore = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => lsStore.get(k) ?? null,
	setItem: (k: string, v: string) => lsStore.set(k, String(v)),
	removeItem: (k: string) => lsStore.delete(k),
	clear: () => lsStore.clear()
});

// In-memory IndexedDB stand-in: the meta store (salt, verifier, schema
// markers) and the key-value store, so the full persistence stack runs
// without a browser.
const dbState = vi.hoisted(() => ({
	meta: new Map<string, string>(),
	kv: new Map<string, string>()
}));

vi.mock('../db', () => ({
	isIndexedDbAvailable: () => true,
	dbMetaGet: vi.fn(async (key: string) => dbState.meta.get(key) ?? null),
	dbMetaSet: vi.fn(async (key: string, value: string) => dbState.meta.set(key, value)),
	dbSet: vi.fn(async (key: string, value: string) => {
		dbState.kv.set(key, value);
	}),
	dbRemove: vi.fn(async (key: string) => {
		dbState.kv.delete(key);
	}),
	dbGetAll: vi.fn(async () => Array.from(dbState.kv, ([key, value]) => ({ key, value }))),
	dbClose: vi.fn(),
	dbBackupSave: vi.fn(async (record: { data: string }) => {
		dbState.meta.set('__last_backup', record.data);
		return 1;
	}),
	dbBackupGetAll: vi.fn(async () => []),
	dbBackupLatest: vi.fn(async () => null),
	dbBackupDelete: vi.fn(async () => {})
}));

// The app version reader touches package metadata; pin it for backups.
vi.mock('../app-version', () => ({
	getAppVersionRaw: () => '80.0.7'
}));

// Partial at-rest mock: real engine except seal, which can be forced to
// fail so the storage-layer fail-open fallback is provable.
const sealFlags = vi.hoisted(() => ({ fail: false }));
vi.mock('../at-rest', async (importActual) => {
	const actual = await importActual<typeof import('../at-rest')>();
	return {
		...actual,
		sealAtRestValue: vi.fn(async (plaintext: string) => {
			if (sealFlags.fail) throw new Error('forced seal failure');
			return actual.sealAtRestValue(plaintext);
		})
	};
});

import {
	AT_REST_TAG,
	_resetAtRestStateForTesting,
	clearAtRestSessionKey,
	getAtRestSessionKey,
	isAtRestTagged,
	shouldProtectAtRest
} from '../at-rest-state';
import {
	clearAtRestSession,
	isAtRestUnlocked,
	openAtRestValue,
	registerAtRestSession,
	sealAtRestValue,
	META_AT_REST_SALT
} from '../at-rest';
import {
	disableEncryption,
	enableEncryption,
	encrypt,
	decrypt,
	isEncrypted,
	verifyPassphrase
} from '../crypto';
import {
	STORAGE_KEYS,
	_resetIdbWriteSeqForTesting,
	_getIdbWriteQueue,
	storageGet,
	storageGetJSON,
	storageGetRaw,
	storageInvalidateAll,
	storageSet,
	setRestoreMode,
	storageRefreshAtRestCache,
	initStorage
} from '../storage';
import { createBackup } from '../backup';
import { dbBackupSave } from '../db';
import { _resetWitnessKeyForTesting } from '../witness-key';
import { _resetSealKeyForTesting } from '../seal-key';

const PW = 'correct horse battery staple ledger';
const PW_OTHER = 'a completely different passphrase';

const HISTORY = STORAGE_KEYS.HISTORY;
const GOAL = STORAGE_KEYS.BMI_GOAL;
const GOAL_START = STORAGE_KEYS.BMI_GOAL_START;
const LOCALE = STORAGE_KEYS.LOCALE;

function sampleRecords(count: number): string {
	const now = Date.now();
	return JSON.stringify(
		Array.from({ length: count }, (_, i) => ({
			timestamp: now - i * 86_400_000,
			bmi: 22.5 + i * 0.01,
			height: 175,
			weight: 70,
			age: 30
		}))
	);
}

/**
 * Wait until the terminal persisted state of a key is sealed in both the
 * localStorage mirror and the IndexedDB truth, then drain the write queue.
 */
async function awaitSealed(key: string): Promise<void> {
	await vi.waitFor(
		() => {
			expect(isAtRestTagged(lsStore.get(key) ?? null)).toBe(true);
			expect(isAtRestTagged(dbState.kv.get(key) ?? null)).toBe(true);
		},
		{ timeout: 8000, interval: 50 }
	);
	await _getIdbWriteQueue(key);
}

/** Wait until the persisted seal opens back to exactly the expected plaintext, both layers agreeing. */
async function awaitSealedOpeningTo(key: string, expected: string): Promise<void> {
	await vi.waitFor(
		async () => {
			const raw = lsStore.get(key) ?? null;
			expect(isAtRestTagged(raw)).toBe(true);
			await expect(openAtRestValue(raw as string)).resolves.toBe(expected);
			expect(dbState.kv.get(key)).toBe(raw);
		},
		{ timeout: 8000, interval: 50 }
	);
	await _getIdbWriteQueue(key);
}

/** Wait until the terminal persisted state of a key is exactly the given plaintext, then drain. */
async function awaitPlain(key: string, expected: string): Promise<void> {
	await vi.waitFor(() => expect(lsStore.get(key)).toBe(expected));
	await _getIdbWriteQueue(key);
}

beforeEach(() => {
	// Wipe with the seat in hand FIRST (the production lock order), so
	// no engine slot leaks armed across tests.
	_resetSealKeyForTesting(getAtRestSessionKey());
	_resetAtRestStateForTesting();
	_resetWitnessKeyForTesting();
	_resetIdbWriteSeqForTesting();
	storageInvalidateAll();
	setRestoreMode(false);
	sealFlags.fail = false;
	dbState.meta.clear();
	dbState.kv.clear();
	lsStore.clear();
	vi.mocked(dbBackupSave).mockClear();
});

describe('seal and open round-trips', () => {
	beforeEach(() => {
		_resetSealKeyForTesting(getAtRestSessionKey());
		_resetAtRestStateForTesting();
		_resetWitnessKeyForTesting();
		dbState.meta.clear();
	});

	it('throws when sealing without an unlocked session', async () => {
		await expect(sealAtRestValue('data')).rejects.toThrow(/unlocked session/);
	});

	it('seals into the tagged envelope format and opens back exactly', async () => {
		await registerAtRestSession(PW);
		const plaintext = sampleRecords(3);
		const sealed = await sealAtRestValue(plaintext);
		expect(sealed.startsWith(AT_REST_TAG)).toBe(true);
		expect(sealed).not.toContain('timestamp');
		await expect(openAtRestValue(sealed)).resolves.toBe(plaintext);
	});

	it('round-trips unicode, decimals, and larger payloads', async () => {
		await registerAtRestSession(PW);
		const payloads = [
			JSON.stringify([{ timestamp: 1, bmi: 18.35, height: 175.5, weight: 64.2, age: 0 }]),
			JSON.stringify([{ timestamp: 2, bmi: 40, height: 200, weight: 160 }]),
			sampleRecords(120)
		];
		for (const payload of payloads) {
			const sealed = await sealAtRestValue(payload);
			await expect(openAtRestValue(sealed)).resolves.toBe(payload);
		}
	});

	it('uses a fresh IV per seal — identical plaintext never reuses ciphertext', async () => {
		await registerAtRestSession(PW);
		const a = await sealAtRestValue('same input');
		const b = await sealAtRestValue('same input');
		expect(a).not.toBe(b);
		await expect(openAtRestValue(a)).resolves.toBe('same input');
		await expect(openAtRestValue(b)).resolves.toBe('same input');
	});

	it('returns null when opened under a different passphrase key', async () => {
		await registerAtRestSession(PW);
		const sealed = await sealAtRestValue('secret ledger');
		clearAtRestSession();
		await registerAtRestSession(PW_OTHER);
		await expect(openAtRestValue(sealed)).resolves.toBeNull();
	});

	it('returns null on tampered ciphertext, bad checksum, and corrupt envelopes', async () => {
		await registerAtRestSession(PW);
		const sealed = await sealAtRestValue('integrity matters');

		// Flip a character inside the base64 payload body (past the tag).
		const body = sealed.slice(AT_REST_TAG.length);
		const flipped = (body[0] === 'A' ? 'B' : 'A') + body.slice(1);
		await expect(openAtRestValue(AT_REST_TAG + flipped)).resolves.toBeNull();

		// Corrupt structures: garbage base64 and valid base64 of non-JSON.
		await expect(openAtRestValue(AT_REST_TAG + '!!!not-base64!!!')).resolves.toBeNull();
		await expect(openAtRestValue(AT_REST_TAG + 'YWJjZA==')).resolves.toBeNull();
		await expect(openAtRestValue('no tag at all')).resolves.toBeNull();
	});

	// Runs beside the ladder battery's production-rung derives; the
	// default 10 s budget starves under that load on shared runners.
	it(
		'creates the at-rest salt once and reuses it across registrations',
		{ timeout: 20_000 },
		async () => {
			await registerAtRestSession(PW);
			const saltA = dbState.meta.get(META_AT_REST_SALT);
			expect(saltA).toBeTruthy();
			clearAtRestSession();
			await registerAtRestSession(PW);
			expect(dbState.meta.get(META_AT_REST_SALT)).toBe(saltA);
			// Same passphrase + same salt → same session key → old seals open.
			const sealed = await sealAtRestValue('deterministic key');
			clearAtRestSession();
			await registerAtRestSession(PW);
			await expect(openAtRestValue(sealed)).resolves.toBe('deterministic key');
		}
	);
});

describe('storage integration — sealed persistence layers', () => {
	beforeEach(async () => {
		await registerAtRestSession(PW);
	});

	it('keeps plaintext in cache, seals localStorage and IndexedDB', async () => {
		const records = sampleRecords(5);
		expect(storageSet(HISTORY, records, { skipBackup: true })).toBe(true);
		await awaitSealed(HISTORY);

		// Unlocked reads serve plaintext from the cache.
		expect(storageGet(HISTORY)).toBe(records);
		// Persisted layers carry the seal, never the plaintext.
		const lsRaw = lsStore.get(HISTORY) as string;
		const idbRaw = dbState.kv.get(HISTORY) as string;
		expect(isAtRestTagged(lsRaw)).toBe(true);
		expect(isAtRestTagged(idbRaw)).toBe(true);
		expect(lsRaw).not.toContain('timestamp');
		// Both layers open back to the exact plaintext under the session key.
		await expect(openAtRestValue(lsRaw)).resolves.toBe(records);
		await expect(openAtRestValue(idbRaw)).resolves.toBe(records);
	});

	it('reads sealed values as null when locked and plaintext when unlocked', async () => {
		storageSet(GOAL, '{"targetBmi":22}', { skipBackup: true });
		await awaitSealed(GOAL);

		// Simulate a cold locked load: wipe the session and the cache, so
		// the only sources left are the sealed persisted layers.
		clearAtRestSessionKey();
		storageInvalidateAll();
		expect(storageGet(GOAL)).toBeNull();
		expect(storageGetJSON(GOAL, 'fallback')).toBe('fallback');
		// The raw getter still surfaces the sealed envelope.
		expect(isAtRestTagged(storageGetRaw(GOAL))).toBe(true);

		// Unlocking again (same passphrase) re-opens sealed values into the
		// cache instead of losing them.
		await registerAtRestSession(PW);
		await storageRefreshAtRestCache();
		expect(storageGet(GOAL)).toBe('{"targetBmi":22}');
	});

	it('refuses to overwrite a sealed value while locked (the purge guard)', async () => {
		const original = sampleRecords(3);
		storageSet(HISTORY, original, { skipBackup: true });
		await awaitSealed(HISTORY);

		// Locked session: a self-heal rewrite must not destroy sealed data.
		clearAtRestSessionKey();
		storageInvalidateAll();
		const poisonedRewrite = JSON.stringify([{ timestamp: 1, bmi: 1 }]);
		expect(storageSet(HISTORY, poisonedRewrite, { skipBackup: true })).toBe(false);

		expect(isAtRestTagged(lsStore.get(HISTORY) ?? null)).toBe(true);
		expect(isAtRestTagged(dbState.kv.get(HISTORY) ?? null)).toBe(true);
		// Without a session key the seal cannot open — the data is intact
		// but locked. Re-registering proves it is the original payload.
		await registerAtRestSession(PW);
		await storageRefreshAtRestCache();
		expect(storageGet(HISTORY)).toBe(original);
	});

	it('refuses locked overwrites detected from localStorage when cache is cold', async () => {
		const original = sampleRecords(2);
		storageSet(HISTORY, original, { skipBackup: true });
		await awaitSealed(HISTORY);
		clearAtRestSessionKey();
		storageInvalidateAll();
		// cache empty, localStorage holds the seal
		expect(storageSet(HISTORY, '{"tampered":true}', { skipBackup: true })).toBe(false);
		expect(isAtRestTagged(lsStore.get(HISTORY) ?? null)).toBe(true);
	});

	it('never seals preference keys even when unlocked', async () => {
		storageSet(LOCALE, 'id');
		await awaitPlain(LOCALE, 'id');
		expect(isAtRestTagged(lsStore.get(LOCALE))).toBe(false);
	});

	it('writes only the latest value to the mirror under rapid same-key writes', async () => {
		const first = sampleRecords(1);
		const second = sampleRecords(2);
		storageSet(HISTORY, first, { skipBackup: true });
		storageSet(HISTORY, second, { skipBackup: true });
		await awaitSealedOpeningTo(HISTORY, second);

		const idbRaw = dbState.kv.get(HISTORY) as string;
		const lsRaw = lsStore.get(HISTORY) as string;
		expect(lsRaw).toBe(idbRaw);
	});

	it('falls back to plaintext persistence when sealing fails (fail-open)', async () => {
		sealFlags.fail = true;
		const records = sampleRecords(2);
		expect(storageSet(HISTORY, records, { skipBackup: true })).toBe(true);
		await awaitPlain(HISTORY, records);
		// The cache still serves plaintext either way.
		expect(storageGet(HISTORY)).toBe(records);
	});

	it('persists raw values in restore mode without purge-guard interference', async () => {
		const original = sampleRecords(2);
		storageSet(HISTORY, original, { skipBackup: true });
		await awaitSealed(HISTORY);
		const sealedRaw = lsStore.get(HISTORY) as string;

		setRestoreMode(true);
		expect(storageSet(HISTORY, sealedRaw, { skipBackup: true })).toBe(true);
		await awaitPlain(HISTORY, sealedRaw);
		setRestoreMode(false);
		expect(dbState.kv.get(HISTORY)).toBe(sealedRaw);
	});
});

describe('cold-load init with a sealed ledger', () => {
	it('initStorage keeps sealed values intact and locked', async () => {
		// Seed a previously sealed ledger directly into the stores.
		await registerAtRestSession(PW);
		const records = sampleRecords(3);
		const sealed = await sealAtRestValue(records);
		dbState.kv.set(HISTORY, sealed);
		clearAtRestSessionKey();
		storageInvalidateAll();
		lsStore.clear();

		await initStorage();

		// Cache holds the sealed raw value; locked reads return null; the
		// sealed value survives (never removed as corruption).
		expect(isAtRestTagged(storageGetRaw(HISTORY))).toBe(true);
		expect(storageGet(HISTORY)).toBeNull();
		expect(dbState.kv.get(HISTORY)).toBe(sealed);

		// Presenting the ledger passphrase re-opens everything.
		await registerAtRestSession(PW);
		await storageRefreshAtRestCache();
		expect(storageGet(HISTORY)).toBe(records);
	});
});

describe('crypto unlock hooks', () => {
	beforeEach(async () => {
		dbState.meta.clear();
		dbState.kv.clear();
		lsStore.clear();
		storageInvalidateAll();
	});

	it('enableEncryption registers the session so later writes seal', async () => {
		expect(await enableEncryption(PW)).toBe(true);
		expect(isAtRestUnlocked()).toBe(true);
		expect(dbState.meta.get(META_AT_REST_SALT)).toBeTruthy();

		const records = sampleRecords(1);
		storageSet(HISTORY, records, { skipBackup: true });
		await awaitSealed(HISTORY);
	});

	it('disableEncryption locks the session; sealed values stay sealed', async () => {
		await enableEncryption(PW);
		const records = sampleRecords(1);
		storageSet(HISTORY, records, { skipBackup: true });
		await awaitSealed(HISTORY);
		const sealed = lsStore.get(HISTORY) as string;

		await disableEncryption();
		expect(isAtRestUnlocked()).toBe(false);
		// The sealed value is untouched on the persisted layers.
		expect(dbState.kv.get(HISTORY)).toBe(sealed);

		// Later plaintext writes for still-plaintext keys work normally.
		storageInvalidateAll();
		expect(storageSet(LOCALE, 'ja')).toBe(true);
		await awaitPlain(LOCALE, 'ja');
	});

	it('re-enabling with a new passphrase seals with the new key; old seals stay locked', async () => {
		await enableEncryption(PW);
		const first = sampleRecords(1);
		storageSet(HISTORY, first, { skipBackup: true });
		await awaitSealed(HISTORY);
		const sealedFirst = lsStore.get(HISTORY) as string;

		await enableEncryption(PW_OTHER);
		await storageRefreshAtRestCache();
		expect(isAtRestUnlocked()).toBe(true);

		// The old seal cannot open under the new key.
		await expect(openAtRestValue(sealedFirst)).resolves.toBeNull();

		const second = sampleRecords(2);
		storageSet(HISTORY, second, { skipBackup: true });
		await awaitSealedOpeningTo(HISTORY, second);
		const sealedSecond = lsStore.get(HISTORY) as string;
		expect(sealedFirst).not.toBe(sealedSecond);
	});

	it('verifyPassphrase success registers the session (verifier-anchored unlock)', async () => {
		await enableEncryption(PW);
		clearAtRestSession();
		expect(isAtRestUnlocked()).toBe(false);
		expect(await verifyPassphrase(PW)).toBe(true);
		// Registration rides the fire-and-forget decrypt hook — wait for it.
		await vi.waitFor(() => expect(isAtRestUnlocked()).toBe(true));
	});

	it('verifyPassphrase failure never registers', async () => {
		await enableEncryption(PW);
		clearAtRestSession();
		expect(await verifyPassphrase(PW_OTHER)).toBe(false);
		// Let the background unlock check settle, then prove it never registered.
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(isAtRestUnlocked()).toBe(false);
	});

	it('a file decrypt with the ledger passphrase unlocks the session', async () => {
		await enableEncryption(PW);
		clearAtRestSession();
		const fileEnvelope = await encrypt(sampleRecords(2), PW);
		expect(isEncrypted(fileEnvelope)).toBe(true);
		const result = await decrypt(fileEnvelope, PW);
		expect(result).not.toBeNull();
		// The unlock runs fire-and-forget behind a bounded race so a slow
		// or broken IndexedDB can never stall a decrypt — wait for it.
		await vi.waitFor(() => expect(isAtRestUnlocked()).toBe(true));
	});

	it('a file decrypt with a non-ledger passphrase never unlocks', async () => {
		await enableEncryption(PW);
		clearAtRestSession();
		// A file exported under a different passphrase decrypts fine, but
		// the passphrase does not verify against the ledger verifier.
		const fileEnvelope = await encrypt(sampleRecords(2), PW_OTHER);
		const result = await decrypt(fileEnvelope, PW_OTHER);
		expect(result).not.toBeNull();
		// Let the background unlock check settle, then prove it never registered.
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(isAtRestUnlocked()).toBe(false);
	});

	it('decryption without encryption enabled leaves everything plaintext', async () => {
		// No verifier, no registration — the zero-change canary.
		const fileEnvelope = await encrypt(sampleRecords(1), PW);
		const result = await decrypt(fileEnvelope, PW);
		expect(result).not.toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(isAtRestUnlocked()).toBe(false);

		const records = sampleRecords(1);
		storageSet(HISTORY, records, { skipBackup: true });
		await awaitPlain(HISTORY, records);
		expect(storageGet(HISTORY)).toBe(records);
	});
});

describe('backup and restore with a sealed ledger', () => {
	beforeEach(async () => {
		await enableEncryption(PW);
	});

	it('snapshots sealed raw values so a locked ledger backs up sealed', async () => {
		const records = sampleRecords(2);
		storageSet(HISTORY, records, { skipBackup: true });
		await awaitSealed(HISTORY);
		const sealed = lsStore.get(HISTORY) as string;

		clearAtRestSession();
		storageInvalidateAll();

		expect(await createBackup('data_change')).toBe(true);
		expect(vi.mocked(dbBackupSave).mock.calls.length).toBe(1);
		const snapshot = JSON.parse(dbState.meta.get('__last_backup') as string) as Record<
			string,
			string | null
		>;
		expect(snapshot[HISTORY]).toBe(sealed);
		expect(snapshot[HISTORY]).not.toContain('timestamp');
	});

	it('restore round-trips sealed values and re-opens them when unlocked', async () => {
		const records = sampleRecords(2);
		storageSet(HISTORY, records, { skipBackup: true });
		await awaitSealed(HISTORY);
		const sealed = lsStore.get(HISTORY) as string;

		const { restoreLatestBackup } = await import('../backup');
		const { dbBackupLatest } = await import('../db');
		vi.mocked(dbBackupLatest).mockResolvedValueOnce({
			timestamp: Date.now(),
			appVersion: '80.0.7',
			recordCount: 2,
			data: JSON.stringify({ [HISTORY]: sealed, [LOCALE]: 'en' })
		});

		// Locked session: the restore persists raw sealed data, reads stay locked.
		clearAtRestSession();
		storageInvalidateAll();
		expect(await restoreLatestBackup()).toBe(true);
		expect(dbState.kv.get(HISTORY)).toBe(sealed);
		expect(storageGet(HISTORY)).toBeNull();

		// Unlock: the same sealed ledger re-opens without any data loss.
		await registerAtRestSession(PW);
		await storageRefreshAtRestCache();
		expect(storageGet(HISTORY)).toBe(records);
	});
});

describe('zero-change canaries for sessions that never register', () => {
	it('storageSet/Get/JSON keep exact plaintext semantics', async () => {
		const records = sampleRecords(3);
		expect(storageSet(HISTORY, records, { skipBackup: true })).toBe(true);
		await awaitPlain(HISTORY, records);
		expect(storageGet(HISTORY)).toBe(records);
		expect(storageGetRaw(HISTORY)).toBe(records);
		expect(storageGetJSON<number[]>(HISTORY, [])).toEqual(JSON.parse(records));
		expect(dbState.kv.get(HISTORY)).toBe(records);
	});

	it('writes to health keys stay unprotected without a session key', () => {
		expect(shouldProtectAtRest(HISTORY)).toBe(false);
		expect(storageSet(HISTORY, 'plain', { skipBackup: true })).toBe(true);
		expect(lsStore.get(HISTORY)).toBe('plain');
	});
});
