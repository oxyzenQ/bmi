// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The witness chain A/B bench (night-frontier-Z6, A2) - a measurement,
 * not a promise.
 *
 * Computes the SAME witness chain over the same record set alternately
 * with the legacy path (one awaited crypto.subtle.digest per record,
 * the Z3 construction exactly as it shipped) and the sync checkpoint
 * engine (ledger-chain.ts), then reports the per-path mean and the
 * speedup. Interleaved order so JIT warmup and GC hit both paths the
 * same way. Byte-identity is gated BEFORE timing: benching two paths
 * that disagree would be theater. Run: bun run scripts/dev/chain-bench.ts
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
	_resetChainCacheForTesting as resetForBench,
	computeChainSync,
	canonicalRecordJson,
	ledgerGenesisHex
} from '../../src/lib/utils/ledger-chain';

interface Rec {
	timestamp: number;
	bmi: number;
	height: number;
	weight: number;
	age?: number;
}

const KEY = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
const KEYED_MAC = (msg: Uint8Array): Uint8Array => hmac(sha256, KEY, msg);

function makePrng(seed: number): () => number {
	let s = seed | 0 || 1;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		s >>>= 0;
		return s / 0x100000000;
	};
}

function makeRecords(count: number): Rec[] {
	const prng = makePrng(0xbeef);
	const base = 1_700_000_000_000;
	return Array.from({ length: count }, (_, i) => ({
		timestamp: base + i * 3_600_000 + Math.floor(prng() * 1000),
		bmi: Math.round((15 + prng() * 20) * 100) / 100,
		height: Math.round(120 + prng() * 80),
		weight: Math.round(30 + prng() * 100),
		age: prng() > 0.5 ? 10 + Math.floor(prng() * 70) : undefined
	}));
}

async function legacyHead(records: Rec[], keyed: boolean): Promise<string> {
	let link = ledgerGenesisHex();
	const ordered = [...records].sort((a, b) => a.timestamp - b.timestamp);
	for (const record of ordered) {
		const input = new TextEncoder().encode(`${link}:${canonicalRecordJson(record)}`);
		if (keyed) {
			link = Array.from(KEYED_MAC(input), (b) => b.toString(16).padStart(2, '0')).join('');
		} else {
			const digest = await crypto.subtle.digest(
				'SHA-256',
				new Uint8Array(input).buffer as ArrayBuffer
			);
			link = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
		}
	}
	return link;
}

const timed = (fn: () => unknown): number => {
	const start = performance.now();
	fn();
	return performance.now() - start;
};

// Async lanes MUST await inside the timer - timing a promise without
// awaiting it measures only the chain build, not the work (the exact
// theater this bench exists to prevent).
const timedAsync = async (fn: () => Promise<unknown>): Promise<number> => {
	const start = performance.now();
	await fn();
	return performance.now() - start;
};

async function main(): Promise<void> {
	const COUNT = Number(process.env.CHAIN_BENCH_RECORDS ?? 2000);
	const ROUNDS = Number(process.env.CHAIN_BENCH_ROUNDS ?? 4);
	const records = makeRecords(COUNT);
	console.log(`chain A/B bench: ${COUNT} records, ${ROUNDS} interleaved rounds per mode`);

	// Byte-identity gate BEFORE timing: the two paths must agree byte for
	// byte on the plain and keyed heads, or the bench aborts.
	const legacyPlain = await legacyHead(records, false);
	const legacyKeyed = await legacyHead(records, true);
	const syncPlain = computeChainSync(records, 'plain', null, null);
	const syncKeyed = computeChainSync(records, 'keyed', KEYED_MAC, 'bench-key');
	if (legacyPlain !== syncPlain.head || legacyKeyed !== syncKeyed.head) {
		console.error('bench aborted: the legacy and sync paths disagree on the chain head');
		process.exit(1);
	}
	console.log('byte-identity gate: plain + keyed heads agree byte for byte');

	for (const mode of ['plain', 'keyed'] as const) {
		const keyed = mode === 'keyed';
		const legacyTimes: number[] = [];
		const coldTimes: number[] = [];
		const warmTimes: number[] = [];
		for (let round = 0; round < ROUNDS; round++) {
			legacyTimes.push(await timedAsync(() => legacyHead(records, keyed)));
			coldTimes.push(
				timed(() => {
					// A cold engine: clear the cache so every link recomputes.
					resetForBench();
					computeChainSync(records, mode, keyed ? KEYED_MAC : null, keyed ? 'bench-key' : null);
				})
			);
			warmTimes.push(
				timed(() =>
					computeChainSync(records, mode, keyed ? KEYED_MAC : null, keyed ? 'bench-key' : null)
				)
			);
		}
		const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
		console.log(
			`[${mode}] legacy async: ${mean(legacyTimes).toFixed(1)} ms | sync cold: ${mean(coldTimes).toFixed(1)} ms (${(mean(legacyTimes) / mean(coldTimes)).toFixed(1)}x) | sync warm-append: ${mean(warmTimes).toFixed(1)} ms (${(mean(legacyTimes) / mean(warmTimes)).toFixed(1)}x)`
		);
	}
	// The append lane - the shape that motivated the law: a warm ledger
	// grows one record at a time, the way daily use appends measurements.
	for (const mode of ['plain', 'keyed'] as const) {
		const keyed = mode === 'keyed';
		const growing = [...records];
		computeChainSync(growing, mode, keyed ? KEYED_MAC : null, keyed ? 'bench-key' : null);
		const appendTimes: number[] = [];
		const APPENDS = 50;
		for (let i = 0; i < APPENDS; i++) {
			growing.push({
				timestamp: records[records.length - 1].timestamp + (i + 1) * 60_000,
				bmi: 22 + (i % 8),
				height: 170,
				weight: 65 + (i % 30),
				age: 30
			});
			appendTimes.push(
				timed(() =>
					computeChainSync(growing, mode, keyed ? KEYED_MAC : null, keyed ? 'bench-key' : null)
				)
			);
		}
		const meanAppend = appendTimes.reduce((a, b) => a + b, 0) / appendTimes.length;
		// The legacy cost of the same append: a full recompute per save.
		const legacyAppend = await timedAsync(() => legacyHead(growing, keyed));
		console.log(
			`[${mode}] append (n=${growing.length}, ${APPENDS} appends): sync ${meanAppend.toFixed(1)} ms per save | legacy single recompute ${legacyAppend.toFixed(1)} ms (${(legacyAppend / meanAppend).toFixed(0)}x per save)`
		);
	}
	console.log(
		'honest note: the warm-append lane measures a recompute over the FULL set (the cache dedupes the chain links, the per-record verification pass still runs by design - soundness over showmanship)'
	);
}

void main();
