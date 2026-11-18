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
}

void main();
