// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Main-thread client for the Argon2id KDF worker.
 *
 * The worker is bundled inline (`?worker&inline`): Vite emits a
 * self-contained script started from a blob URL, so the derivation
 * works offline with no extra fetch and no service-worker dependency.
 *
 * Semantics:
 *   - One lazily-created worker serves all derivations.
 *   - A construction failure is transient: it rejects the in-flight
 *     derivation (crypto.ts falls back to the main thread) and the next
 *     call retries.
 *   - A worker that errors after starting latches the client broken for
 *     the session; callers keep deriving on the main thread, so
 *     availability never trumps correctness.
 */
import KdfWorkerCtor from './kdf.worker?worker&inline';

export interface Argon2Options {
	m: number;
	t: number;
	p: number;
	dkLen: number;
}

let workerPromise: Promise<Worker> | null = null;
let broken = false;
let nextJobId = 1;
const pending = new Map<
	number,
	{ resolve: (bytes: Uint8Array) => void; reject: (err: Error) => void }
>();

/** Whether offloading is currently possible (Worker exists, not latched-broken). */
export function isKdfWorkerAvailable(): boolean {
	return !broken && typeof Worker !== 'undefined';
}

function attachHandlers(w: Worker): Worker {
	w.onmessage = (event: MessageEvent<{ id: number; hash?: ArrayBuffer; error?: string }>) => {
		const { id, hash, error } = event.data;
		const job = pending.get(id);
		if (!job) return;
		pending.delete(id);
		if (error || !hash) {
			job.reject(new Error(error ?? 'kdf worker returned no hash'));
		} else {
			job.resolve(new Uint8Array(hash));
		}
	};

	w.onerror = (event) => {
		// Latch: stop using workers for the rest of the session.
		broken = true;
		const err = new Error(event.message || 'kdf worker crashed');
		for (const job of pending.values()) job.reject(err);
		pending.clear();
		w.terminate();
		if (workerPromise) workerPromise = null;
	};

	return w;
}

function startWorker(): Promise<Worker> {
	return new Promise<Worker>((resolve) => {
		// Inline worker: the constructor builds the blob internally.
		resolve(attachHandlers(new KdfWorkerCtor()));
	});
}

function getWorker(): Promise<Worker> {
	if (!workerPromise) {
		workerPromise = startWorker().catch((err) => {
			// Transient failure: allow a retry on the next call.
			if (workerPromise) workerPromise = null;
			throw err;
		});
	}
	return workerPromise;
}

/**
 * Compute an argon2id hash inside the worker.
 * Byte-identical to computing argon2id(...) directly with the same options.
 */
export function argon2idHashInWorker(
	passphrase: string,
	salt: Uint8Array,
	options: Argon2Options
): Promise<Uint8Array> {
	if (!isKdfWorkerAvailable()) {
		return Promise.reject(new Error('kdf worker unavailable'));
	}
	const id = nextJobId++;
	const saltCopy = new Uint8Array(salt); // private copy — its buffer is transferred
	return getWorker()
		.then((w) => {
			return new Promise<Uint8Array>((resolve, reject) => {
				pending.set(id, { resolve, reject });
				w.postMessage({ id, passphrase, salt: saltCopy.buffer, options }, [saltCopy.buffer]);
			});
		})
		.catch((err) => {
			pending.delete(id);
			throw err;
		});
}

/** @internal Test-only: reset singleton state between tests. */
export function _resetKdfWorkerForTesting(): void {
	workerPromise?.then((w) => w.terminate()).catch(() => {});
	workerPromise = null;
	broken = false;
	const err = new Error('kdf worker client reset');
	for (const job of pending.values()) job.reject(err);
	pending.clear();
}
