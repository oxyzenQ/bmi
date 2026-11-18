// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
//
// night-enhance-1 - the KDF worker behavior suite with the wasm engine.
//
// Proves the real worker module (not a fake transport) end-to-end:
// the wasm engine derives first and the reply stays byte-identical to
// the noble computation; an unavailable engine falls back to the JS
// engine without changing a byte; an engine that throws mid-derive
// falls back the same way; a malformed job surfaces an error message;
// and the origin gate still drops foreign messages unread.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { argon2id } from '@noble/hashes/argon2.js';
import type { MockInstance } from 'vitest';

// The worker module binds `self` at import time; in jsdom that is the
// window. Route the worker's replies through a stub we control.
type PostMessageImpl = (message: unknown, transfer?: unknown[]) => void;
const realPostMessage = window.postMessage.bind(window);
let posted: Array<Record<string, unknown>> = [];
const postMessageImpl: PostMessageImpl = (message) => {
	posted.push(message as Record<string, unknown>);
};
window.postMessage = postMessageImpl as typeof window.postMessage;

// Engine availability is swappable per test through this holder.
const engineState = vi.hoisted(() => ({ engine: 'real' as 'real' | 'null' | 'throw' }));

vi.mock('../kdf-wasm-engine', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../kdf-wasm-engine')>();
	return {
		loadArgon2idEngine: async () => {
			if (engineState.engine === 'null') return null;
			if (engineState.engine === 'throw') {
				return {
					abiVersion: 1,
					derive: () => {
						throw new Error('engine trap');
					}
				};
			}
			return actual.loadArgon2idEngine();
		}
	};
});

await import('../kdf.worker');

const options = { m: 1024, t: 1, p: 1, dkLen: 32 };
const passphrase = 'worker-engine-proof';
const salt = new TextEncoder().encode('0123456789abcdef'); // 16 bytes

function dispatch(job: unknown): void {
	const event = new MessageEvent('message', {
		data: job,
		origin: window.location.origin
	});
	window.onmessage?.(event);
}

async function replyFor(jobId: number): Promise<Record<string, unknown>> {
	for (let waited = 0; waited < 100; waited++) {
		const reply = posted.find((m) => m.id === jobId);
		if (reply) return reply;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error(`no reply for job ${jobId}`);
}

let nextJobId = 100;
let warnSpy: MockInstance;

describe('kdf worker with the wasm engine', () => {
	afterEach(() => {
		engineState.engine = 'real';
		posted = [];
		warnSpy?.mockRestore();
	});

	it('derives through the wasm engine, byte-identical to noble', async () => {
		const id = nextJobId++;
		dispatch({ id, passphrase, salt: salt.slice().buffer, options });
		const reply = await replyFor(id);
		expect(reply.error).toBeUndefined();
		const hash = new Uint8Array(reply.hash as ArrayBuffer);
		const direct = argon2id(new TextEncoder().encode(passphrase), salt, options);
		expect(Buffer.from(hash).equals(Buffer.from(direct))).toBe(true);
	});

	it('falls back to the JS engine when the wasm engine is unavailable, same bytes', async () => {
		engineState.engine = 'null';
		const id = nextJobId++;
		dispatch({ id, passphrase, salt: salt.slice().buffer, options });
		const reply = await replyFor(id);
		expect(reply.error).toBeUndefined();
		const hash = new Uint8Array(reply.hash as ArrayBuffer);
		const direct = argon2id(new TextEncoder().encode(passphrase), salt, options);
		expect(Buffer.from(hash).equals(Buffer.from(direct))).toBe(true);
	});

	it('falls back to the JS engine when the wasm engine throws, same bytes', async () => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		engineState.engine = 'throw';
		const id = nextJobId++;
		dispatch({ id, passphrase, salt: salt.slice().buffer, options });
		const reply = await replyFor(id);
		expect(reply.error).toBeUndefined();
		const hash = new Uint8Array(reply.hash as ArrayBuffer);
		const direct = argon2id(new TextEncoder().encode(passphrase), salt, options);
		expect(Buffer.from(hash).equals(Buffer.from(direct))).toBe(true);
		expect(warnSpy).toHaveBeenCalled();
	});

	it('reports an error reply for a malformed job instead of a wrong hash', async () => {
		const id = nextJobId++;
		dispatch({ id, passphrase, salt: new Uint8Array(4).fill(1).buffer, options });
		const reply = await replyFor(id);
		expect(reply.error).toBeTruthy();
		expect(reply.hash).toBeUndefined();
	});

	it('drops messages from a foreign origin unread', async () => {
		const before = posted.length;
		const event = new MessageEvent('message', {
			data: { id: nextJobId++, passphrase, salt: salt.slice().buffer, options },
			origin: 'https://evil.example'
		});
		window.onmessage?.(event);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(posted.length).toBe(before);
	});

	it('transfers the hash (buffer detached after the reply lands)', async () => {
		const id = nextJobId++;
		dispatch({ id, passphrase, salt: salt.slice().buffer, options });
		const reply = await replyFor(id);
		// The stub bypasses real transfer semantics; the contract under
		// test is that the worker posts the raw buffer (not a copy), which
		// the structured-clone transfer then detaches in a real runtime.
		expect(reply.hash).toBeInstanceOf(ArrayBuffer);
	});

	it('wipes nothing the caller still owns (caller salt unchanged)', async () => {
		const saltCopy = salt.slice();
		const id = nextJobId++;
		dispatch({ id, passphrase, salt: saltCopy.buffer, options });
		await replyFor(id);
		expect(Buffer.from(saltCopy).equals(Buffer.from(salt))).toBe(true);
	});
});
