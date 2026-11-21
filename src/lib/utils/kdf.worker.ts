// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/// <reference lib="webworker" />
/**
 * Argon2id KDF worker.
 *
 * Engine order (night-enhance-1): the Rust wasm engine
 * (kdf-wasm-engine.ts, embedded from engine/argon2id, digest-verified
 * before use) is tried first; the pure-JS @noble/hashes engine stays
 * as the fallback for any engine load or derive failure. Both engines
 * implement standard Argon2id (RFC 9106, version 0x13) and are pinned
 * byte-identical by the known-answer and cross-check suites, so the
 * protocol output does not change.
 *
 * The 64 MiB, 3-iteration derivation blocks its calling thread for
 * seconds. Running it here keeps the main thread free to render frames
 * while the key derivation burns memory.
 *
 * Protocol: { id, passphrase, salt, options } in, { id, hash } out
 * (hash transferred) or { id, error } on failure. Byte-identical to the
 * main-thread implementation because every path implements the same
 * standard Argon2id with the same parameters.
 */
import { argon2id } from '@noble/hashes/argon2.js';
import { loadArgon2idEngine } from './kdf-wasm-engine';

interface KdfJob {
	id: number;
	passphrase: string;
	salt: ArrayBuffer;
	options: { m: number; t: number; p: number; dkLen: number };
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

async function computeHash(job: KdfJob): Promise<Uint8Array> {
	const password = new TextEncoder().encode(job.passphrase);
	const salt = new Uint8Array(job.salt);
	const engine = await loadArgon2idEngine();
	if (engine) {
		try {
			return engine.derive(password, salt, job.options);
		} catch (err) {
			console.warn('[kdf.worker] wasm engine derive failed; falling back to the JS engine', err);
		}
	}
	return argon2id(password, salt, job.options);
}

ctx.onmessage = (event: MessageEvent<KdfJob>) => {
	// Origin gate, mirroring the service-worker convention: the inline
	// blob worker can only be driven by its creating document, so any
	// message whose origin disagrees with the worker's own origin is
	// dropped unread.
	const trustedOrigin = ctx.location.origin;
	if (event.origin && event.origin !== trustedOrigin) return;
	const job = event.data;
	void computeHash(job)
		.then((hash) => {
			// The hash buffer is transferred, not copied: the worker-side copy
			// detaches on postMessage, so no raw key material survives here.
			ctx.postMessage({ id: job.id, hash: hash.buffer }, [hash.buffer]);
		})
		.catch((err: unknown) => {
			ctx.postMessage({
				id: job.id,
				error: err instanceof Error ? err.message : 'argon2id computation failed'
			});
		});
};
