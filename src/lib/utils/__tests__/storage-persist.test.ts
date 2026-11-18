// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Eviction-resistance battery (night-frontier-Z2): the ledger requests
// persistent storage once per session, caches the grant, never re-prompts,
// and reports an honest status — granted, denied, failed, or unsupported.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory navigator.storage stand-in.
const persistState = vi.hoisted(() => ({
	granted: true as boolean | null,
	fail: false,
	persistCalls: 0,
	persistedCalls: 0,
	persistedReport: true as boolean | null
}));

const storageMock = vi.hoisted(() => ({
	persist: vi.fn(async () => {
		persistState.persistCalls++;
		if (persistState.fail) throw new Error('persist exploded');
		return persistState.granted as boolean;
	}),
	persisted: vi.fn(async () => {
		persistState.persistedCalls++;
		return persistState.persistedReport as boolean;
	})
}));

vi.stubGlobal('navigator', { storage: storageMock });

import {
	requestStoragePersistence,
	getStoragePersistenceStatus,
	refreshStoragePersistenceStatus,
	_resetStoragePersistenceForTesting
} from '../storage-persist';

beforeEach(() => {
	_resetStoragePersistenceForTesting();
	persistState.granted = true;
	persistState.fail = false;
	persistState.persistCalls = 0;
	persistState.persistedCalls = 0;
	persistState.persistedReport = true;
});

describe('eviction-resistant ledger', () => {
	it('requests persistence once and caches the grant', async () => {
		await expect(requestStoragePersistence()).resolves.toBe(true);
		await expect(requestStoragePersistence()).resolves.toBe(true);
		expect(persistState.persistCalls).toBe(1);
		const status = getStoragePersistenceStatus();
		expect(status).toEqual({ supported: true, persisted: true, requested: true });
	});

	it('reports a denial honestly instead of swallowing it', async () => {
		persistState.granted = false;
		await expect(requestStoragePersistence()).resolves.toBe(false);
		const status = getStoragePersistenceStatus();
		expect(status.persisted).toBe(false);
		expect(status.requested).toBe(true);
	});

	it('resolves null when the persist request fails', async () => {
		persistState.fail = true;
		await expect(requestStoragePersistence()).resolves.toBeNull();
		expect(getStoragePersistenceStatus().requested).toBe(true);
	});

	it('reports unsupported contexts as supported:false with a clean state', async () => {
		// Swap the global stub for a storage-less navigator, then restore it
		// so the surrounding tests keep their deterministic surface.
		vi.stubGlobal('navigator', {});
		_resetStoragePersistenceForTesting();
		await expect(requestStoragePersistence()).resolves.toBeNull();
		// An unsupported context never reaches the browser, so nothing is
		// marked requested — honest absence, not a fake attempt.
		expect(getStoragePersistenceStatus()).toEqual({
			supported: false,
			persisted: null,
			requested: false
		});
		vi.stubGlobal('navigator', { storage: storageMock });
	});

	it('refreshes from the browser persisted() report', async () => {
		persistState.persistedReport = false;
		const status = await refreshStoragePersistenceStatus();
		expect(status.persisted).toBe(false);
		expect(persistState.persistedCalls).toBe(1);
	});

	it('reset restores the pre-request state', async () => {
		await requestStoragePersistence();
		_resetStoragePersistenceForTesting();
		expect(getStoragePersistenceStatus()).toEqual({
			supported: true,
			persisted: null,
			requested: false
		});
		// A fresh request asks the browser again after the reset.
		await requestStoragePersistence();
		expect(persistState.persistCalls).toBe(2);
	});
});
