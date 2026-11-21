// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// @vitest-environment node
//
// night-frontier-Z6 (A2) - the chain checkpoint law battery.
//
// The engine's promises, proven directly against the sync core:
//   1. Byte-identity: warm-cache heads EQUAL cold-cache heads, and both
//      equal an independent raw-subtle reference. The cache can only
//      deduplicate work, never change the answer.
//   2. Soundness under mutation: middle edits, truncations, replays,
//      and reorderings diverge the cache exactly where the records
//      change - the recomputed head always matches the reference of the
//      ACTUAL records, never of the cached prefix.
//   3. The amortization: appending across many stride boundaries keeps
//      the head reference-exact at every step (the append-dominated
//      ledger shape that motivated the law).
//   4. Isolation: plain and keyed caches never cross-contaminate, and a
//      keyed request without a MAC fails closed at the engine too.

import { describe, it, expect, beforeEach } from 'vitest';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
	_resetChainCacheForTesting,
	_checkpointStrideForTesting,
	canonicalRecordJson,
	computeChainSync,
	ledgerGenesisHex,
	type ChainHead
} from '../ledger-chain';
import type { WitnessMac } from '../witness-key';

type Rec = { timestamp: number; bmi: number; height: number; weight: number; age?: number };

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

function randomRecords(prng: () => number, count: number): Rec[] {
	const base = 1_700_000_000_000;
	return Array.from({ length: count }, (_, i) => ({
		timestamp: base + i * 3_600_000 + Math.floor(prng() * 1000),
		bmi: Math.round((15 + prng() * 20) * 100) / 100,
		height: Math.round(120 + prng() * 80),
		weight: Math.round(30 + prng() * 100),
		age: prng() > 0.5 ? 10 + Math.floor(prng() * 70) : undefined
	}));
}

const KEY = new Uint8Array(32).map((_, i) => (i * 5 + 1) & 0xff);
const KEY_FINGERPRINT = 'battery-key-fingerprint';
const KEYED_MAC: WitnessMac = (msg: Uint8Array) => hmac(sha256, KEY, msg);

async function referenceHead(records: Rec[], keyed: boolean): Promise<string> {
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

function compute(records: Rec[], keyed: boolean): ChainHead {
	return computeChainSync(
		records,
		keyed ? 'keyed' : 'plain',
		keyed ? KEYED_MAC : null,
		keyed ? KEY_FINGERPRINT : null
	);
}

beforeEach(() => {
	_resetChainCacheForTesting();
});

describe('chain checkpoint law: byte-identity cold and warm', () => {
	it('warm-cache heads equal cold-cache heads equal the reference (plain)', async () => {
		const records = randomRecords(makePrng(11), 100);
		const cold = compute(records, false);
		const warm = compute(records, false);
		expect(warm).toEqual(cold);
		expect(cold.head).toBe(await referenceHead(records, false));
		expect(cold.length).toBe(100);
	});

	it('warm-cache heads equal cold-cache heads equal the reference (keyed)', async () => {
		const records = randomRecords(makePrng(12), 100);
		const cold = compute(records, true);
		const warm = compute(records, true);
		expect(warm).toEqual(cold);
		expect(cold.head).toBe(await referenceHead(records, true));
	});

	it('repeated computes are deterministic (no hidden state drift)', () => {
		const records = randomRecords(makePrng(13), 40);
		const a = compute(records, true);
		for (let i = 0; i < 5; i++) {
			expect(compute(records, true)).toEqual(a);
		}
	});

	it('an empty ledger seals as the genesis head in both modes', () => {
		expect(compute([], false)).toEqual({ head: ledgerGenesisHex(), length: 0 });
		expect(compute([], true)).toEqual({ head: ledgerGenesisHex(), length: 0 });
	});
});

describe('chain checkpoint law: soundness under mutation', () => {
	const TAMPERS = [
		'truncate-front',
		'truncate-back',
		'truncate-middle',
		'edit-middle',
		'edit-tail',
		'replay-duplicate',
		'foreign-insert',
		'reverse-order'
	] as const;

	it('every tamper class rechains to the reference of the ACTUAL records', async () => {
		const stride = _checkpointStrideForTesting();
		expect(stride).toBeGreaterThan(1);
		for (let seed = 1; seed <= 6; seed++) {
			const records = randomRecords(makePrng(seed * 31), stride + Math.floor(stride / 2));
			// Warm the cache in both modes first.
			compute(records, false);
			compute(records, true);
			for (const tamper of TAMPERS) {
				let tampered: Rec[];
				switch (tamper) {
					case 'truncate-front':
						tampered = records.slice(1);
						break;
					case 'truncate-back':
						tampered = records.slice(0, -1);
						break;
					case 'truncate-middle':
						tampered = records.filter((_, i) => i !== Math.floor(records.length / 2));
						break;
					case 'edit-middle':
						tampered = records.map((r, i) =>
							i === Math.floor(records.length / 2) ? { ...r, weight: r.weight + 0.5 } : r
						);
						break;
					case 'edit-tail':
						tampered = records.map((r, i) =>
							i === records.length - 1 ? { ...r, bmi: r.bmi + 1 } : r
						);
						break;
					case 'replay-duplicate':
						tampered = [...records, records[0]];
						break;
					case 'foreign-insert':
						tampered = [...records];
						tampered.splice(Math.floor(records.length / 2), 0, {
							timestamp: Date.now() + 90_000,
							bmi: 23.4,
							height: 180,
							weight: 75,
							age: 40
						});
						break;
					case 'reverse-order':
						tampered = [...records].reverse();
						break;
				}
				// Warm cache over the tampered shape too - the reuse path is
				// exactly what a stale cache would ride.
				compute(tampered, false);
				compute(tampered, true);
				expect(compute(tampered, false).head).toBe(await referenceHead(tampered, false));
				expect(compute(tampered, true).head).toBe(await referenceHead(tampered, true));
			}
		}
	});

	it('a reversed input of distinct timestamps stays the logical no-op', async () => {
		const records = randomRecords(makePrng(21), 50);
		compute(records, true);
		const reversed = compute([...records].reverse(), true);
		expect(reversed.head).toBe(await referenceHead(records, true));
	});

	it('appending across many stride boundaries stays reference-exact at every step', async () => {
		const stride = _checkpointStrideForTesting();
		const prng = makePrng(31);
		let records: Rec[] = [];
		for (let i = 0; i < stride * 3 + 7; i++) {
			records = [
				...records,
				{
					timestamp: 1_700_000_000_000 + i * 60_000,
					bmi: Math.round((15 + prng() * 20) * 100) / 100,
					height: 170,
					weight: Math.round(30 + prng() * 100),
					age: 30
				}
			];
			// Each mode must match its own reference; keyed and plain heads
			// differ by design, so they are never compared to each other.
			const keyed = compute(records, true);
			const plain = compute(records, false);
			expect(keyed.head).toBe(await referenceHead(records, true));
			expect(plain.head).toBe(await referenceHead(records, false));
			// The warm keyed cache must agree with a cache-cold keyed compute.
			_resetChainCacheForTesting();
			expect(compute(records, true).head).toBe(keyed.head);
		}
	});

	it('a middle edit after a long warm prefix diverges exactly once', async () => {
		const stride = _checkpointStrideForTesting();
		const records = randomRecords(makePrng(41), stride * 2);
		compute(records, true);
		compute(records, true);
		const edited = records.map((r, i) =>
			i === Math.floor(stride / 2) ? { ...r, weight: r.weight + 1 } : r
		);
		// Warm the tampered shape, then demand the reference head.
		compute(edited, true);
		expect(compute(edited, true).head).toBe(await referenceHead(edited, true));
	});
});

describe('chain checkpoint law: mode isolation and fail-closed', () => {
	it('plain and keyed caches never cross-contaminate', async () => {
		const records = randomRecords(makePrng(51), 80);
		// Interleave modes over shared record shapes.
		for (let round = 0; round < 3; round++) {
			compute(records, false);
			compute(records, true);
		}
		expect(compute(records, false).head).toBe(await referenceHead(records, false));
		expect(compute(records, true).head).toBe(await referenceHead(records, true));
	});

	it('distinct keys hold distinct caches (rotation cannot reuse links)', async () => {
		const records = randomRecords(makePrng(52), 70);
		const otherMac: WitnessMac = (msg: Uint8Array) => hmac(sha256, new Uint8Array(32).fill(9), msg);
		const a = computeChainSync(records, 'keyed', KEYED_MAC, KEY_FINGERPRINT);
		const b = computeChainSync(records, 'keyed', otherMac, 'other-fingerprint');
		expect(a.head).not.toBe(b.head);
		// Both caches stay reference-exact after the interleaving.
		expect(computeChainSync(records, 'keyed', KEYED_MAC, KEY_FINGERPRINT).head).toBe(
			await referenceHead(records, true)
		);
		expect(computeChainSync(records, 'keyed', otherMac, 'other-fingerprint').head).not.toBe(a.head);
	});

	it('a keyed request without a MAC fails closed at the engine', () => {
		const records = randomRecords(makePrng(53), 5);
		expect(() => computeChainSync(records, 'keyed', null, null)).toThrow(
			/keyed witness chain requested without an attestation key/
		);
	});
});
