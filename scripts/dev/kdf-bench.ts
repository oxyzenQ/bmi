// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The KDF engine A/B bench (night-enhance-1) - a measurement, not a promise.
 *
 * Derives the same production key (Argon2id, 64 MiB, t=3, p=1, 32-byte
 * output) alternately with the pure-JS engine and the Rust wasm engine,
 * then reports the per-engine mean and the speedup. Interleaved order
 * so thermal drift, allocator state, and JIT warmup hit both engines
 * the same way. Run: bun run scripts/dev/kdf-bench.ts
 */

import { argon2id } from '@noble/hashes/argon2.js';
import { loadArgon2idEngine, type Argon2idWasmEngine } from '../../src/lib/utils/kdf-wasm-engine';

const OPTIONS = { m: 64 * 1024, t: 3, p: 1, dkLen: 32 };
const PASSPHRASE = 'bmi-stellar kdf bench passphrase';
const SALT = new TextEncoder().encode('0123456789abcdef'); // 16 bytes

const timed = (fn: () => unknown): number => {
	const start = performance.now();
	fn();
	return performance.now() - start;
};

async function main(): Promise<void> {
	const loadStart = performance.now();
	const engine: Argon2idWasmEngine | null = await loadArgon2idEngine();
	const loadMs = performance.now() - loadStart;
	if (!engine) {
		console.error('bench aborted: wasm engine refused to load (digest or ABI failure)');
		process.exit(1);
	}

	const pass = new TextEncoder().encode(PASSPHRASE);
	// Byte-identity gate before timing: benching two engines that disagree
	// would be theater.
	const wasmBytes = engine.derive(pass, SALT, OPTIONS);
	const jsBytes = argon2id(pass, SALT, OPTIONS);
	if (Buffer.from(wasmBytes).toString('hex') !== Buffer.from(jsBytes).toString('hex')) {
		console.error('bench aborted: the engines disagree on the production derivation');
		process.exit(1);
	}

	const jsTimes: number[] = [];
	const wasmTimes: number[] = [];
	const ROUNDS = 3;
	for (let i = 0; i < ROUNDS; i++) {
		jsTimes.push(timed(() => argon2id(pass, SALT, OPTIONS)));
		wasmTimes.push(timed(() => engine.derive(pass, SALT, OPTIONS)));
	}

	const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
	const jsMean = mean(jsTimes);
	const wasmMean = mean(wasmTimes);
	const speedup = jsMean / wasmMean;

	console.log('kdf engine A/B bench - Argon2id 64 MiB, t=3, p=1, dkLen=32');
	console.log(`engine init (decode + digest + compile): ${loadMs.toFixed(1)} ms`);
	console.log(`byte-identity gate: wasm === js (hex equal)`);
	console.log('');
	console.log(`round | js engine (ms) | wasm engine (ms)`);
	for (let i = 0; i < ROUNDS; i++) {
		console.log(
			`${String(i + 1).padStart(5)} | ${jsTimes[i].toFixed(1).padStart(14)} | ${wasmTimes[i].toFixed(1).padStart(16)}`
		);
	}
	console.log('');
	console.log(`js mean:   ${jsMean.toFixed(1)} ms`);
	console.log(`wasm mean: ${wasmMean.toFixed(1)} ms`);
	console.log(
		`speedup:   ${speedup.toFixed(2)}x (${jsMean.toFixed(0)} -> ${wasmMean.toFixed(0)} ms)`
	);

	// ── The seal seat A/B (night-frontier-Z8): in-engine AES-256-GCM vs
	// WebCrypto on a realistic payload. Byte-identity gate first: same
	// key, same nonce, same plaintext, no associated data - the two
	// sides MUST agree byte-for-byte before anything is timed.
	const sealKey = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
	const sealIv = new Uint8Array(12).map((_, i) => (i * 11 + 1) & 0xff);
	const sealPayload = new TextEncoder().encode(
		JSON.stringify(
			Array.from({ length: 40 }, (_, i) => ({
				timestamp: 1_700_000_000_000 + i * 86_400_000,
				bmi: 22.5 + i * 0.01,
				height: 175,
				weight: 70,
				age: 30
			}))
		)
	);
	const handle = engine.sealPut(sealKey);
	if (!handle) {
		console.error('bench aborted: the seal seat refused the install');
		process.exit(1);
	}
	const engineSealed = engine.sealSeal(handle, sealIv, new Uint8Array(0), sealPayload);
	const gcmKey = await crypto.subtle.importKey('raw', sealKey.slice().buffer, 'AES-GCM', false, [
		'encrypt',
		'decrypt'
	]);
	const webSealed = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: sealIv.slice().buffer }, gcmKey, sealPayload)
	);
	if (Buffer.from(engineSealed).toString('hex') !== Buffer.from(webSealed).toString('hex')) {
		console.error('bench aborted: the seal seats disagree on the same plaintext');
		process.exit(1);
	}
	const engineSealTimes: number[] = [];
	const webSealTimes: number[] = [];
	const engineOpenTimes: number[] = [];
	const webOpenTimes: number[] = [];
	const SEAL_ROUNDS = 200;
	for (let i = 0; i < SEAL_ROUNDS; i++) {
		engineSealTimes.push(
			timed(() => engine.sealSeal(handle, sealIv, new Uint8Array(0), sealPayload))
		);
		engineOpenTimes.push(
			timed(() => engine.sealOpen(handle, sealIv, new Uint8Array(0), engineSealed))
		);
	}
	for (let i = 0; i < SEAL_ROUNDS; i++) {
		// WebCrypto is promise-based: the wall-clock runs to completion
		// (dispatch plus the event-loop hop), which is exactly the cost
		// the synchronous in-engine seat removes.
		const sealStart = performance.now();
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: sealIv.slice().buffer },
			gcmKey,
			sealPayload
		);
		webSealTimes.push(performance.now() - sealStart);
		const openStart = performance.now();
		await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealIv.slice().buffer }, gcmKey, webSealed);
		webOpenTimes.push(performance.now() - openStart);
	}
	const meanUs = (xs: number[]): number => (xs.reduce((a, b) => a + b, 0) / xs.length) * 1000;
	console.log('');
	console.log(
		`seal seat A/B - AES-256-GCM, ${String(sealPayload.length)}-byte ledger payload, ${String(SEAL_ROUNDS)} rounds`
	);
	console.log(`byte-identity gate: engine seal === webcrypto seal (hex equal)`);
	console.log(
		`engine seal/open mean: ${meanUs(engineSealTimes).toFixed(1)} / ${meanUs(engineOpenTimes).toFixed(1)} us`
	);
	// WebCrypto is promise-based: the wall-clock per call includes the
	// event-loop hop, which is exactly the cost the in-engine seat removes.
	console.log(
		`webcrypto seal/open mean (wall-clock incl. promise): ${meanUs(webSealTimes).toFixed(1)} / ${meanUs(webOpenTimes).toFixed(1)} us`
	);
	engine.keystoreWipe(handle);
}

void main();
