// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Strict-durability battery (night-frontier-Z2): every db.ts write
// transaction must open with the `durability: 'strict'` hint so commits
// are verified against persistent storage even after Chromium relaxed
// the implicit default in Chrome 121. Readonly transactions stay on the
// default — the hint only costs on commit.

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface RecordedTx {
	name: string;
	mode: string;
	options: IDBTransactionOptions | undefined;
}

const fakeDb = vi.hoisted(() => ({
	transactions: [] as RecordedTx[]
}));

class FakeTx {
	oncomplete: (() => void) | null = null;
	onabort: (() => void) | null = null;
	onerror: (() => void) | null = null;
	objectStore(): Record<string, unknown> {
		// Writes are inert (the fake fires oncomplete on a microtask);
		// reads resolve their request on a microtask like real IDB.
		const instant = (result: unknown) => {
			const req = { result, onsuccess: null as (() => void) | null, onerror: null };
			queueMicrotask(() => req.onsuccess?.());
			return req;
		};
		return {
			put: () => ({}),
			add: () => ({}),
			delete: () => ({}),
			get: () => instant(undefined),
			getAll: () => instant([])
		};
	}
}

vi.stubGlobal('indexedDB', {
	open: vi.fn(() => {
		const req = {
			onsuccess: null as (() => void) | null,
			onerror: null,
			result: null as unknown
		};
		queueMicrotask(() => {
			req.result = {
				objectStoreNames: { contains: () => true },
				close: () => {},
				transaction: (name: string, mode: string, options?: IDBTransactionOptions) => {
					const tx = new FakeTx();
					fakeDb.transactions.push({ name, mode, options });
					queueMicrotask(() => tx.oncomplete?.());
					return tx;
				}
			};
			req.onsuccess?.();
		});
		return req;
	})
});

import {
	dbSet,
	dbRemove,
	dbMetaSet,
	dbBackupSave,
	dbBackupDelete,
	dbGetAll,
	dbClose,
	DURABLE_WRITE
} from '../db';

beforeEach(() => {
	dbClose();
	fakeDb.transactions.length = 0;
});

describe('strict-durability writes', () => {
	it('dbSet opens its write transaction with durability strict', async () => {
		await dbSet('bmi.history', '[]');
		const tx = fakeDb.transactions[0];
		expect(tx.mode).toBe('readwrite');
		expect(tx.options).toEqual({ durability: 'strict' });
	});

	it('dbRemove opens its write transaction with durability strict', async () => {
		await dbRemove('bmi.history');
		expect(fakeDb.transactions[0].options).toEqual({ durability: 'strict' });
	});

	it('dbMetaSet opens its write transaction with durability strict', async () => {
		await dbMetaSet('__at_rest_salt', 'abc');
		expect(fakeDb.transactions[0].options).toEqual({ durability: 'strict' });
	});

	it('dbBackupSave opens its write transaction with durability strict', async () => {
		await dbBackupSave({ timestamp: 1, appVersion: '80.0.7', recordCount: 0, data: '{}' });
		expect(fakeDb.transactions[0].options).toEqual({ durability: 'strict' });
	});

	it('dbBackupDelete opens its write transaction with durability strict', async () => {
		await dbBackupDelete(1);
		expect(fakeDb.transactions[0].options).toEqual({ durability: 'strict' });
	});

	it('readonly transactions stay on the default (no hint, no cost)', async () => {
		await dbGetAll();
		expect(fakeDb.transactions[0].mode).toBe('readonly');
		expect(fakeDb.transactions[0].options).toBeUndefined();
	});

	it('the exported hint constant matches the applied hint', () => {
		expect(DURABLE_WRITE).toEqual({ durability: 'strict' });
	});
});
