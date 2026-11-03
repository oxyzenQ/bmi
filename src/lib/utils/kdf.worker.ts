// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference lib="webworker" />
/**
 * Argon2id KDF worker.
 *
 * The pure-JS Argon2id (64 MiB memory, 3 iterations) blocks the calling
 * thread for seconds. Running it here keeps the main thread free to
 * render frames while the key derivation runs.
 *
 * Protocol: { id, passphrase, salt, options } in, { id, hash } out
 * (hash transferred) or { id, error } on failure. Byte-identical to the
 * main-thread implementation because both call the same @noble/hashes
 * argon2id function with the same parameters.
 */
import { argon2id } from '@noble/hashes/argon2.js';

interface KdfJob {
	id: number;
	passphrase: string;
	salt: ArrayBuffer;
	options: { m: number; t: number; p: number; dkLen: number };
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<KdfJob>) => {
	// Origin gate, mirroring the service-worker convention: the inline
	// blob worker can only be driven by its creating document, so any
	// message whose origin disagrees with the worker's own origin is
	// dropped unread.
	const trustedOrigin = ctx.location.origin;
	if (event.origin && event.origin !== trustedOrigin) return;
	const job = event.data;
	try {
		const hash = argon2id(
			new TextEncoder().encode(job.passphrase),
			new Uint8Array(job.salt),
			job.options
		);
		ctx.postMessage({ id: job.id, hash: hash.buffer }, [hash.buffer]);
	} catch (err) {
		ctx.postMessage({
			id: job.id,
			error: err instanceof Error ? err.message : 'argon2id computation failed'
		});
	}
};
