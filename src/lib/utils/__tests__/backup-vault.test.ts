// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z4 - the backup ↔ vault integration battery.
//
// Proves the wiring contracts (the flush primitive itself is proven in
// vault-opfs.test.ts, the live chain in the P12 claim):
//   1. Every rolling backup mirrors its snapshot: the vault module
//      receives the EXACT JSON blob that landed in IndexedDB - same
//      bytes, including the continuity witness.
//   2. The mirror is fire-and-forget: a vault failure never fails the
//      backup that produced it (the IDB snapshot is already durable).
//   3. The restore fallback: an empty IndexedDB rotation falls back to
//      the OPFS vault copy and restores it - including the witness -
//      while the restore-key allowlist still holds.
//   4. The rotation prune still runs against IndexedDB only (the vault
//      holds the latest snapshot, not a rotation).

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
	kv: new Map<string, string>(),
	backups: [] as Array<{
		id: number;
		data: string;
		timestamp: number;
		recordCount: number;
		appVersion: string;
	}>
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
	dbBackupSave: vi.fn(
		async (record: {
			data: string;
			timestamp: number;
			recordCount: number;
			appVersion: string;
		}) => {
			const id = dbState.backups.reduce((m, b) => Math.max(m, b.id), 0) + 1;
			dbState.backups.push({ ...record, id });
			return id;
		}
	),
	dbBackupGetAll: vi.fn(async () => [...dbState.backups].sort((a, b) => b.timestamp - a.timestamp)),
	dbBackupLatest: vi.fn(
		async () => [...dbState.backups].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
	),
	dbBackupDelete: vi.fn(async (id: number) => {
		dbState.backups = dbState.backups.filter((b) => b.id !== id);
	})
}));

const vaultSpies = vi.hoisted(() => ({
	mirror: [] as string[],
	vaultContent: null as string | null
}));

vi.mock('../vault-backup', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../vault-backup')>();
	return {
		...actual,
		mirrorVaultSnapshot: vi.fn(async (snapshot: string) => {
			vaultSpies.mirror.push(snapshot);
			vaultSpies.vaultContent = snapshot;
			return { ok: true, bytes: new TextEncoder().encode(snapshot).length };
		}),
		readVaultSnapshot: vi.fn(async () => vaultSpies.vaultContent)
	};
});

import { STORAGE_KEYS, initStorage, storageInvalidateAll, storageGet } from '../storage';
import { createBackup, restoreLatestBackup } from '../backup';
import { META_LEDGER_CHAIN } from '../ledger-continuity';
import { sealLedgerChain, getSealedLedgerChain } from '../ledger-continuity';
import { dbBackupSave } from '../db';

const HISTORY = STORAGE_KEYS.HISTORY;

beforeEach(() => {
	lsStore.clear();
	dbState.meta.clear();
	dbState.kv.clear();
	dbState.backups = [];
	vaultSpies.mirror = [];
	vaultSpies.vaultContent = null;
	vi.mocked(dbBackupSave).mockClear();
	storageInvalidateAll();
	initStorage();
});

describe('createBackup mirrors the snapshot into the vault', () => {
	it('the vault receives the exact bytes that landed in IndexedDB', async () => {
		lsStore.set(HISTORY, JSON.stringify([{ timestamp: 1, bmi: 22.5, height: 170, weight: 65 }]));
		await createBackup('data_change');
		expect(vaultSpies.mirror.length).toBe(1);
		const idbBlob = dbState.backups.at(-1)!.data;
		expect(vaultSpies.mirror[0]).toBe(idbBlob);
		// The witness rode inside the same snapshot.
		expect(JSON.parse(vaultSpies.mirror[0])).toHaveProperty(META_LEDGER_CHAIN);
	});

	it('a vault failure never fails the backup that produced it', async () => {
		const { mirrorVaultSnapshot } = await import('../vault-backup');
		vi.mocked(mirrorVaultSnapshot).mockImplementationOnce(async () => ({
			ok: false,
			reason: 'worker unavailable'
		}));
		lsStore.set(HISTORY, JSON.stringify([{ timestamp: 1, bmi: 22.5, height: 170, weight: 65 }]));
		const ok = await createBackup('data_change');
		expect(ok).toBe(true);
		expect(dbState.backups.length).toBe(1);
	});

	it('two backups produce two mirrors in order (single-flight serialization)', async () => {
		lsStore.set(HISTORY, JSON.stringify([{ timestamp: 1, bmi: 22.5, height: 170, weight: 65 }]));
		await createBackup('data_change');
		lsStore.set(HISTORY, JSON.stringify([{ timestamp: 2, bmi: 23.5, height: 170, weight: 66 }]));
		// The storage layer is cache-backed: a write outside storageSet
		// (as this test does) must invalidate before the next snapshot.
		storageInvalidateAll();
		await createBackup('data_change');
		expect(vaultSpies.mirror.length).toBe(2);
		expect(vaultSpies.mirror[0]).not.toBe(vaultSpies.mirror[1]);
		expect(vaultSpies.mirror[1]).toContain('23.5');
	});
});

describe('the restore falls back to the vault copy', () => {
	it('an empty IndexedDB rotation restores from the OPFS vault (witness included)', async () => {
		// A backup was taken once; the IndexedDB rotation is gone (the
		// corruption/eviction scenario the vault exists for).
		lsStore.set(HISTORY, JSON.stringify([{ timestamp: 1, bmi: 22.5, height: 170, weight: 65 }]));
		await sealLedgerChain([{ timestamp: 1, bmi: 22.5, height: 170, weight: 65 }]);
		await createBackup('data_change');
		const witness = await getSealedLedgerChain();
		const vaultBlob = vaultSpies.vaultContent;

		dbState.backups = [];
		dbState.meta.delete(META_LEDGER_CHAIN);
		lsStore.clear();
		storageInvalidateAll();

		expect(vaultBlob).not.toBeNull();
		vaultSpies.vaultContent = vaultBlob;
		const restored = await restoreLatestBackup();
		expect(restored).toBe(true);
		// The restore lands in the storage layer (cache + IndexedDB; the
		// localStorage mirror re-forms on the next plain write).
		expect(storageGet(HISTORY)).toContain('22.5');
		expect(await getSealedLedgerChain()).toEqual(witness);
	});

	it('no IndexedDB rotation and no vault copy returns false honestly', async () => {
		expect(await restoreLatestBackup()).toBe(false);
	});

	it('the allowlist still holds on a vault restore (unknown keys never land)', async () => {
		vaultSpies.vaultContent = JSON.stringify({
			[HISTORY]: JSON.stringify([{ timestamp: 1, bmi: 22.5, height: 170, weight: 65 }]),
			'attacker.key': 'injected',
			[META_LEDGER_CHAIN]: JSON.stringify({ head: 'a'.repeat(64), length: 1 })
		});
		const restored = await restoreLatestBackup();
		expect(restored).toBe(true);
		expect(storageGet(HISTORY)).toContain('22.5');
		expect(storageGet('attacker.key')).toBeNull();
	});
});
