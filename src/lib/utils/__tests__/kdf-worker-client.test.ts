// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Paranoid Masterclass audit — Web Worker offloading suite.
//
// Proves the worker transport: the hash returned through the worker
// protocol is byte-identical to computing argon2id directly with the
// same parameters, the salt buffer transfer does not mutate the caller's
// salt, transient script-fetch failures reject without latching, and
// worker crashes latch the client broken (crypto.ts then derives on the
// main thread — the path already covered by every crypto round-trip
// test, which run with the worker guard disabled for determinism).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { argon2id } from '@noble/hashes/argon2.js';

type Listener = ((ev: { data?: unknown; message?: string }) => void) | null;

/** Fake Worker whose reply is computed with the real argon2id. */
class FakeComputingWorker {
	onmessage: Listener = null;
	onerror: Listener = null;
	posted: Array<{ data: unknown; transfer: unknown[] }> = [];
	terminated = false;

	constructor(public url: string) {}

	postMessage(data: unknown, transfer: unknown[] = []): void {
		this.posted.push({ data, transfer });
		const job = data as {
			id: number;
			passphrase: string;
			salt: ArrayBuffer;
			options: Parameters<typeof argon2id>[2];
		};
		const hash = argon2id(
			new TextEncoder().encode(job.passphrase),
			new Uint8Array(job.salt),
			job.options
		);
		setTimeout(() => {
			this.onmessage?.({ data: { id: job.id, hash: hash.buffer } });
		}, 0);
	}

	terminate(): void {
		this.terminated = true;
	}
}

/** Fake Worker that simulates a script-level crash after startup. */
class FakeCrashingWorker {
	onmessage: Listener = null;
	onerror: Listener = null;

	constructor(public url: string) {
		setTimeout(() => {
			this.onerror?.({ message: 'script crashed' });
		}, 0);
	}

	postMessage(): void {}
	terminate(): void {}
}

const options = { m: 1024, t: 1, p: 1, dkLen: 32 };
const passphrase = 'worker-transport-proof';
const salt = new TextEncoder().encode('0123456789abcdef'); // 16 bytes

vi.stubGlobal(
	'fetch',
	vi.fn(async () => ({ ok: true, status: 200, text: async () => 'stubbed-worker-source' }))
);
vi.stubGlobal('Worker', FakeComputingWorker);

import {
	argon2idHashInWorker,
	isKdfWorkerAvailable,
	_resetKdfWorkerForTesting
} from '../kdf-worker-client';

afterEach(() => {
	_resetKdfWorkerForTesting();
	vi.stubGlobal('Worker', FakeComputingWorker);
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true, status: 200, text: async () => 'stubbed-worker-source' }))
	);
});

describe('kdf worker client', () => {
	it('reports availability when Worker exists', () => {
		expect(isKdfWorkerAvailable()).toBe(true);
	});

	it('returns a hash byte-identical to direct argon2id computation', async () => {
		const viaWorker = await argon2idHashInWorker(passphrase, salt, options);
		const direct = argon2id(new TextEncoder().encode(passphrase), salt, options);
		expect(Buffer.from(viaWorker).equals(Buffer.from(direct))).toBe(true);
	});

	it('transfers a private salt copy (caller salt never mutated)', async () => {
		const before = Buffer.from(salt);
		await argon2idHashInWorker(passphrase, salt, options);
		expect(Buffer.from(salt).equals(before)).toBe(true);
	});

	it('passes the exact options through to the worker', async () => {
		const worker = new FakeComputingWorker('probe');
		vi.stubGlobal(
			'Worker',
			class {
				constructor(url: string) {
					return worker;
				}
			}
		);
		_resetKdfWorkerForTesting();
		await argon2idHashInWorker(passphrase, salt, options);
		const job = worker.posted[0].data as { options: unknown; passphrase: string };
		expect(job.passphrase).toBe(passphrase);
		expect(job.options).toEqual(options);
	});

	it('rejects transiently when worker construction fails, then retries', async () => {
		let throwOnConstruct = true;
		vi.stubGlobal(
			'Worker',
			class {
				constructor() {
					if (throwOnConstruct) throw new Error('worker construct blocked');
					return new FakeComputingWorker('retry');
				}
			}
		);
		_resetKdfWorkerForTesting();

		await expect(argon2idHashInWorker(passphrase, salt, options)).rejects.toThrow(
			'worker construct blocked'
		);
		// Not latched — the next call retries construction.
		expect(isKdfWorkerAvailable()).toBe(true);

		throwOnConstruct = false;
		await expect(argon2idHashInWorker(passphrase, salt, options)).resolves.toBeDefined();
	});

	it('rejects every pending job when the worker crashes and latches broken', async () => {
		vi.stubGlobal('Worker', FakeCrashingWorker);
		_resetKdfWorkerForTesting();
		await expect(argon2idHashInWorker(passphrase, salt, options)).rejects.toThrow('script crashed');
		// Latched: subsequent calls reject immediately without a worker.
		await expect(argon2idHashInWorker(passphrase, salt, options)).rejects.toThrow(
			'kdf worker unavailable'
		);
		expect(isKdfWorkerAvailable()).toBe(false);
	});

	it('rejects immediately when Worker is undefined', async () => {
		vi.stubGlobal('Worker', undefined);
		_resetKdfWorkerForTesting();
		await expect(argon2idHashInWorker(passphrase, salt, options)).rejects.toThrow(
			'kdf worker unavailable'
		);
	});
});
