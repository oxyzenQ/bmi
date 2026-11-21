// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The chain engine (night-frontier-Z6, A2 - the chain checkpoint law).
 *
 * The Z3 witness chain recomputed every link through one
 * `crypto.subtle.digest` round-trip PER RECORD, twice per save (the
 * pre-state chain and the new-state chain). At the LTS horizon - years
 * of daily records - that is thousands of awaited round-trips per legit
 * write. This module moves the same construction onto the synchronous
 * path and adds a sound checkpoint cache:
 *
 *   1. Fully synchronous: SHA-256 (and the keyed HMAC-SHA256) run
 *      through @noble/hashes in a tight loop - zero async round-trips,
 *      zero per-record promise machinery. The construction is
 *      byte-identical (SHA-256 is SHA-256; the genesis seed and the
 *      canonical form are the same constants).
 *   2. The checkpoint cache: per (mode, key fingerprint), the module
 *      remembers the per-record verification digests and the chain
 *      links at fixed strides. On the append-dominated saves that
 *      dominate a ledger's life, the chain links are recomputed only
 *      from the divergence point - one new link for a typical append -
 *      while the links of the unchanged prefix are reused.
 *
 * Soundness law, stated exactly: the cache is NEVER trusted blindly.
 * Every compute re-derives the verification digest of every record in
 * the requested order and compares it against the cached digests; the
 * first divergence (a middle edit, a truncation, a replay, ANY change)
 * forces a rechain from the stride boundary below it, and every stale
 * checkpoint past the divergence point is dropped, so a stale or
 * poisoned cache can never produce a head the records do not imply.
 * The cost model is honest: per compute the module pays N sync
 * verifications plus (N - resume) chain links; a warm append save pays
 * N verifications and ONE chain link, where the old path paid N async
 * chain links twice per save. Soundness is why the cache cannot skip
 * work - it only deduplicates it.
 *
 * Honest limits: the cache is volatile per-realm memory (correctness
 * never depends on it - two realms hold two caches and must agree,
 * which the two-realm battery proves); the verification floor is O(N)
 * sync hashes by design - the law buys the elimination of the async
 * storm and the O(1)-amortized CHAIN work, not an O(1) total.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from './hex';
import type { WitnessMac } from './witness-key';
import type { BmiRecord } from '$lib/types/bmi-record';

/** The seed the chain starts from; also the head of an empty ledger. */
const GENESIS_SEED = 'bmi-stellar-ledger-v4-genesis';

/** Sync SHA-256 hex of the genesis seed - computed once per realm. */
const GENESIS_HEX = bytesToHex(sha256(new TextEncoder().encode(GENESIS_SEED)));

/** The public head of an empty ledger (identical in both modes). */
export function ledgerGenesisHex(): string {
	return GENESIS_HEX;
}

/**
 * Canonical serialization of one record: fixed key order, age omitted
 * when undefined. Two structurally identical records must produce the
 * same string no matter how their object keys were ordered.
 */
export function canonicalRecordJson(record: BmiRecord): string {
	return JSON.stringify({
		timestamp: record.timestamp,
		bmi: record.bmi,
		height: record.height,
		weight: record.weight,
		age: record.age
	});
}

export interface ChainHead {
	head: string;
	length: number;
}

/** The chain-link stride: chain links are checkpointed every K records. */
const CHECKPOINT_STRIDE = 64;

/** Cache entries held per realm; beyond this the oldest entry evicts. */
const CACHE_MAX_ENTRIES = 4;

interface ChainCache {
	/** Verification digest of every cached prefix record, in order. */
	digests: Uint8Array[];
	/** Chain links after exactly `index` records: index -> hex link. */
	checkpoints: Map<number, string>;
}

const chainCaches = new Map<string, ChainCache>();

/**
 * The cache identity: the attestation mode plus, for keyed mode, the
 * PUBLIC key fingerprint the caller passes (stable for the installed
 * key, rotating with the passphrase). Plain mode shares one entry.
 */
function cacheKeyFor(mode: 'plain' | 'keyed', fingerprint: string | null): string {
	return mode === 'keyed' ? `keyed:${fingerprint ?? ''}` : 'plain';
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function pruneCaches(): void {
	while (chainCaches.size > CACHE_MAX_ENTRIES) {
		const oldest = chainCaches.keys().next().value;
		if (oldest === undefined) break;
		chainCaches.delete(oldest);
	}
}

/**
 * Compute the chain over the LOGICAL ledger (records sorted ascending
 * by timestamp, stable sort) in the given attestation mode. `mac` is
 * the witness HMAC for keyed mode (resolved from witness-key.ts);
 * `fingerprint` is that key's public identity (null for plain). Fully
 * synchronous, checkpoint-cached, and sound: the cached prefix is
 * re-verified digest by digest on every call.
 */
export function computeChainSync(
	records: BmiRecord[],
	mode: 'plain' | 'keyed',
	mac: WitnessMac | null,
	fingerprint: string | null
): ChainHead {
	// Fail-closed at the engine too: a keyed request without a MAC can
	// neither bless nor accuse - the wrapper guards it, and so does the
	// math, so no caller can bypass the law by reaching past it.
	if (mode === 'keyed' && !mac) {
		throw new Error('keyed witness chain requested without an attestation key');
	}
	const key = cacheKeyFor(mode, fingerprint);
	const cache = chainCaches.get(key);
	const ordered = [...records].sort((a, b) => a.timestamp - b.timestamp);
	const n = ordered.length;

	// Canonical strings and their verification digests, in order. The
	// digest of the canonical form is the soundness witness: equal
	// digests prove equal records (collision-negligible), so the cached
	// prefix can only be reused over PROVEN-identical records.
	const canonicals: string[] = new Array(n);
	const digests: Uint8Array[] = new Array(n);
	let divergeAt = n;
	for (let i = 0; i < n; i++) {
		canonicals[i] = canonicalRecordJson(ordered[i]);
		const digest = sha256(new TextEncoder().encode(canonicals[i]));
		digests[i] = digest;
		if (i < divergeAt) {
			if (cache && i < cache.digests.length) {
				if (!bytesEqual(digest, cache.digests[i])) divergeAt = i;
			} else {
				// Past the cached prefix: everything from here is unproven.
				divergeAt = i;
			}
		}
	}

	// Resume from the largest checkpoint at or below the divergence
	// point; the verification pass proved every record up to it.
	let resume = 0;
	let link = GENESIS_HEX;
	if (cache && divergeAt > 0) {
		for (const [idx, cachedLink] of cache.checkpoints) {
			if (idx <= divergeAt && idx > resume) {
				resume = idx;
				link = cachedLink;
			}
		}
	}

	// The chain itself: only the links past the resume point run. Every
	// checkpoint written here is derived from the CURRENT verified
	// records, so it is valid no matter where the divergence was.
	const fresh = new Map<number, string>();
	for (let i = resume; i < n; i++) {
		const input = new TextEncoder().encode(`${link}:${canonicals[i]}`);
		link = bytesToHex(mac ? mac(input) : sha256(input));
		if ((i + 1) % CHECKPOINT_STRIDE === 0) fresh.set(i + 1, link);
	}
	if (n > 0 && n % CHECKPOINT_STRIDE === 0 && resume < n) fresh.set(n, link);

	// Store: keep pre-existing checkpoints only up to the divergence
	// point (past it they describe records that no longer exist), then
	// add this compute's fresh checkpoints.
	const checkpoints = new Map<number, string>();
	if (cache) {
		for (const [idx, cachedLink] of cache.checkpoints) {
			if (idx <= divergeAt) checkpoints.set(idx, cachedLink);
		}
	}
	for (const [idx, freshLink] of fresh) checkpoints.set(idx, freshLink);
	chainCaches.set(key, { digests, checkpoints });
	pruneCaches();

	return { head: link, length: n };
}

/** @internal Test-only: drop the volatile cache (correctness never
 * depends on it; the battery proves heads are identical cold and warm). */
export function _resetChainCacheForTesting(): void {
	chainCaches.clear();
}

/** @internal Test-only: the checkpoint stride, pinned by the battery. */
export function _checkpointStrideForTesting(): number {
	return CHECKPOINT_STRIDE;
}
