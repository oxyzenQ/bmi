// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Paranoid Masterclass audit — IndexedDB transaction atomicity suite.
//
// Proves the durability contract of db.ts writes against a scripted
// fake IndexedDB that models real IDB event ordering:
//   - request success fires BEFORE the transaction commits;
//   - committed data becomes visible only at tx.oncomplete;
//   - an abort rolls back every uncommitted operation of the transaction.
//
// Regression anchor: before the fix, write promises resolved on
// request success, so a browser crash or quota abort DURING COMMIT
// resolved successfully while the data was silently rolled back.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbSet, dbRemove, dbMetaSet, dbBackupSave, dbBackupDelete, dbClose } from '../db';

// ── Scripted fake IndexedDB ──

type Listener = (() => void) | null;

class FakeRequest {
	onsuccess: Listener = null;
	onerror: Listener = null;
	result: unknown = undefined;
	error: Error | null = null;
}

class FakeTx {
	oncomplete: Listener = null;
	onabort: Listener = null;
	onerror: Listener = null;
	error: Error | null = null;
	store: FakeObjectStore;
	mode: string;
	private ops: Array<{ req: FakeRequest; apply: () => void }> = [];
	private finished = false;

	constructor(
		mode: string,
		private data: Map<string, string>
	) {
		this.mode = mode;
		this.store = new FakeObjectStore(data, this);
	}

	objectStore(_name: string): FakeObjectStore {
		return this.store;
	}

	_enqueue(req: FakeRequest, apply: () => void, result: unknown): void {
		req.result = result;
		this.ops.push({ req, apply });
	}

	/** Request-level success — data is NOT yet committed. */
	__reqSuccess(req: FakeRequest): void {
		req.onsuccess?.();
	}

	/** Request-level failure — bubbles and aborts the transaction. */
	__reqError(req: FakeRequest, err: Error): void {
		req.error = err;
		req.onerror?.();
		this.__abort(err);
	}

	/** Commit: applies every operation, then fires oncomplete. */
	__commit(): void {
		if (this.finished) return;
		this.finished = true;
		for (const op of this.ops) op.apply();
		this.oncomplete?.();
	}

	/** Abort: discards every uncommitted operation, fires onabort. */
	__abort(err?: Error): void {
		if (this.finished) return;
		this.finished = true;
		this.error = err ?? null;
		this.onabort?.();
	}
}

class FakeObjectStore {
	private nextId = 1;
	__lastReq: FakeRequest | null = null;

	constructor(
		private data: Map<string, string>,
		private tx: FakeTx
	) {}

	put(record: { key: string; value: string }): FakeRequest {
		const req = new FakeRequest();
		this.__lastReq = req;
		this.tx._enqueue(req, () => this.data.set(record.key, record.value), record.key);
		return req;
	}

	add(record: { key: string; value: string }): FakeRequest {
		const req = new FakeRequest();
		this.__lastReq = req;
		const id = this.nextId++;
		this.tx._enqueue(req, () => this.data.set(record.key, record.value), id);
		return req;
	}

	delete(key: string): FakeRequest {
		const req = new FakeRequest();
		this.__lastReq = req;
		this.tx._enqueue(
			req,
			() => {
				this.data.delete(key);
			},
			undefined
		);
		return req;
	}

	get(key: string): FakeRequest {
		const req = new FakeRequest();
		req.result = this.data.has(key) ? { key, value: this.data.get(key) as string } : undefined;
		return req;
	}
}

class FakeOpenRequest {
	onupgradeneeded: Listener = null;
	onsuccess: Listener = null;
	onerror: Listener = null;
	result: FakeDb | null = null;
}

class FakeDb {
	objectStoreNames = { contains: () => true };
	__lastTx: FakeTx | null = null;

	close(): void {
		/* fake connection close */
	}

	transaction(_name: string, mode: string): FakeTx {
		this.__lastTx = new FakeTx(mode, fakeData);
		return this.__lastTx;
	}

	createObjectStore(): { createIndex: () => void } {
		return { createIndex: () => {} };
	}
}

const fakeData = new Map<string, string>();
const fakeDb = new FakeDb();
const fakeIdb = {
	__openReq: null as FakeOpenRequest | null,
	open(): FakeOpenRequest {
		this.__openReq = new FakeOpenRequest();
		this.__openReq.result = fakeDb;
		return this.__openReq;
	}
};

vi.stubGlobal('indexedDB', fakeIdb);

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

async function initDb(): Promise<void> {
	// Trigger the module-level openDb() and drive it to a usable state.
	const opener = dbSet('__init__', '0');
	await flush();
	fakeIdb.__openReq?.onsuccess?.();
	await flush();
	const tx = fakeDb.__lastTx as FakeTx;
	tx.__reqSuccess(tx.store.__lastReq as FakeRequest);
	tx.__commit();
	await opener;
	fakeDb.__lastTx = null;
}

beforeEach(() => {
	fakeData.clear();
	fakeDb.__lastTx = null;
	fakeIdb.__openReq = null;
	dbClose(); // reset db.ts module state (_db/_dbReady) between tests
});

// ── Tests ──

describe('dbSet durability contract', () => {
	it('resolves only after the transaction commits, not on request success', async () => {
		await initDb();

		let settled = false;
		const p = dbSet('k', 'v1').then(() => {
			settled = true;
		});

		await flush();
		const tx = fakeDb.__lastTx as FakeTx;
		tx.__reqSuccess(tx.store.__lastReq as FakeRequest);
		await flush();
		// Request succeeded — the write is still NOT durable.
		expect(settled).toBe(false);

		tx.__commit();
		await p;
		expect(settled).toBe(true);
	});

	it('rejects when the transaction aborts after request success (crash mid-commit)', async () => {
		await initDb();

		const p = dbSet('k', 'v1');
		await flush();
		const tx = fakeDb.__lastTx as FakeTx;
		tx.__reqSuccess(tx.store.__lastReq as FakeRequest);

		const boom = new Error('QuotaExceededError during commit');
		tx.__abort(boom);
		await expect(p).rejects.toThrow('QuotaExceededError during commit');
	});

	it('aborted write leaves the previous value intact (atomic rollback)', async () => {
		await initDb();

		// Commit an initial value.
		const first = dbSet('k', 'committed');
		await flush();
		let tx = fakeDb.__lastTx as FakeTx;
		tx.__reqSuccess(tx.store.__lastReq as FakeRequest);
		tx.__commit();
		await first;
		expect(fakeData.get('k')).toBe('committed');

		// Second write succeeds at request level, then the tx aborts.
		const second = dbSet('k', 'rolledback');
		await flush();
		tx = fakeDb.__lastTx as FakeTx;
		tx.__reqSuccess(tx.store.__lastReq as FakeRequest);
		tx.__abort(new Error('browser killed during commit'));

		await expect(second).rejects.toThrow('browser killed during commit');
		// Rollback: the uncommitted value never became visible.
		expect(fakeData.get('k')).toBe('committed');
		expect(fakeData.has('rolledback')).toBe(false);
	});

	it('request-level failure bubbles to abort, rejects, and leaves the store unchanged', async () => {
		await initDb();

		const p = dbSet('k', 'v');
		await flush();
		const tx = fakeDb.__lastTx as FakeTx;
		const req = tx.store.__lastReq as FakeRequest;
		tx.__reqError(req, new Error('DataError'));
		await expect(p).rejects.toThrow('DataError');
		expect(fakeData.has('k')).toBe(false);
	});
});

describe('remaining write helpers settle on commit', () => {
	it('dbRemove resolves after commit and deletes only committed data', async () => {
		await initDb();
		fakeData.set('k', 'v');

		const p = dbRemove('k');
		await flush();
		const tx = fakeDb.__lastTx as FakeTx;
		tx.__reqSuccess(tx.store.__lastReq as FakeRequest);
		expect(fakeData.has('k')).toBe(true); // not yet committed
		tx.__commit();
		await p;
		expect(fakeData.has('k')).toBe(false);
	});

	it('dbMetaSet resolves after commit', async () => {
		await initDb();
		const p = dbMetaSet('meta', '1');
		await flush();
		const tx = fakeDb.__lastTx as FakeTx;
		tx.__reqSuccess(tx.store.__lastReq as FakeRequest);
		tx.__commit();
		await expect(p).resolves.toBeUndefined();
		expect(fakeData.get('meta')).toBe('1');
	});

	it('dbBackupSave resolves with the generated id only after commit', async () => {
		await initDb();

		let id: number | 'pending' = 'pending';
		const p = dbBackupSave({
			timestamp: 123,
			appVersion: '21.8.0',
			recordCount: 0,
			data: '{}'
		}).then((v) => {
			id = v;
		});

		await flush();
		const tx = fakeDb.__lastTx as FakeTx;
		tx.__reqSuccess(tx.store.__lastReq as FakeRequest);
		expect(id).toBe('pending'); // request success alone is not enough
		tx.__commit();
		await p;
		expect(id).toBe(1);
	});

	it('dbBackupDelete rejects on abort', async () => {
		await initDb();
		const p = dbBackupDelete(7);
		await flush();
		const tx = fakeDb.__lastTx as FakeTx;
		tx.__abort(new Error('aborted'));
		await expect(p).rejects.toThrow('aborted');
	});
});
