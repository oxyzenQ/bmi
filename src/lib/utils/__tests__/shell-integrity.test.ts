// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z7 (B3) - the shell integrity gate battery.
//
// The gate's promises, proven against a fake Cache Storage bucket:
//   1. The manifest: every precached body is digested at install time,
//      the digests match noble's SHA-256 byte-for-byte (one
//      construction, two implementations), and an unreadable entry
//      fails the install fail-closed.
//   2. Poisoning cannot survive: a tampered entry is detected at
//      verification, DELETED from the cache before anything else, and
//      re-fetched with cache:'reload' (healed) when the network
//      allows - the healed bytes are what the cache serves from then
//      on.
//   3. Offline poisoning still loses its seat: the entry is deleted
//      and reported as poisoned (the service worker withholds the
//      old-cache cleanup on any unresolved verdict) - poisoned state
//      does not survive, availability is re-earned from the network.
//   4. Honest degrades: no manifest (pre-Z7 caches) and a damaged
//      manifest both read 'unverified' - the gate adopts forward,
//      never misfires backward.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import {
	buildIntegrityManifest,
	verifyIntegrityGate,
	INTEGRITY_MANIFEST_KEY,
	type CacheLike
} from '../shell-integrity';

const hex = (bytes: Uint8Array): string =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const URLS = ['/_app/immutable/entry/start.js', '/_app/immutable/chunk/lib.js', '/'];

class FakeCache implements CacheLike {
	store = new Map<string, Response>();
	static keyOf(request: RequestInfo | URL): string {
		if (typeof request === 'string') return request;
		return request instanceof URL ? request.href : request.url;
	}
	async match(request: RequestInfo | URL): Promise<Response | undefined> {
		const hit = this.store.get(FakeCache.keyOf(request));
		return hit ? hit.clone() : undefined;
	}
	async put(request: RequestInfo | URL, response: Response): Promise<void> {
		this.store.set(FakeCache.keyOf(request), response.clone());
	}
	async delete(request: RequestInfo | URL): Promise<boolean> {
		return this.store.delete(FakeCache.keyOf(request));
	}
	async keys(): Promise<Request[]> {
		return [...this.store.keys()].map((k) => new Request(k));
	}
}

const bodyFor = (url: string): string => `body of ${url} :: bmi-stellar shell`;

/** The honest network: serves the true bytes for any URL. */
const honestFetch = vi.fn(async (request: RequestInfo | URL): Promise<Response> => {
	const key =
		typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
	return new Response(bodyFor(key), { status: 200 });
});

beforeEach(() => {
	honestFetch.mockClear();
});

async function installedCache(): Promise<FakeCache> {
	const cache = new FakeCache();
	for (const url of URLS) {
		await cache.put(url, new Response(bodyFor(url), { status: 200 }));
	}
	await buildIntegrityManifest(cache, URLS);
	return cache;
}

describe('shell integrity manifest (install time)', () => {
	it('digests every precached body and matches noble byte-for-byte', async () => {
		const cache = await installedCache();
		const manifestResponse = await cache.match(INTEGRITY_MANIFEST_KEY);
		expect(manifestResponse).toBeDefined();
		const manifest = (await manifestResponse!.json()) as {
			v: number;
			digests: Record<string, string>;
		};
		expect(manifest.v).toBe(1);
		for (const url of URLS) {
			const expected = hex(sha256(new TextEncoder().encode(bodyFor(url))));
			expect(manifest.digests[url]).toBe(expected);
			// And the stored response body really is what was digested.
			const stored = await cache.match(url);
			expect(hex(sha256(new Uint8Array(await stored!.arrayBuffer())))).toBe(expected);
		}
	});

	it('fails the install fail-closed when an entry is unreadable', async () => {
		const cache = new FakeCache();
		await cache.put(URLS[0], new Response(bodyFor(URLS[0]), { status: 200 }));
		// URLS[1] was never cached (addAll would have failed upstream).
		await expect(buildIntegrityManifest(cache, URLS)).rejects.toThrow(/unreadable/);
	});
});

describe('shell integrity gate (activate time)', () => {
	it('verifies an honest cache with no heals and no poisoned entries', async () => {
		const cache = await installedCache();
		const verdict = await verifyIntegrityGate(cache, honestFetch);
		expect(verdict).toEqual({ status: 'verified', healed: [], poisoned: [] });
		expect(honestFetch).not.toHaveBeenCalled();
	});

	it('a tampered entry is deleted, re-fetched, and healed byte-for-byte', async () => {
		const cache = await installedCache();
		// Out-of-band poison: rewrite one precached body under the same URL.
		await cache.put(URLS[1], new Response('poisoned shell payload', { status: 200 }));
		const verdict = await verifyIntegrityGate(cache, honestFetch);
		expect(verdict).toEqual({ status: 'verified', healed: [URLS[1]], poisoned: [] });
		// The cache now serves the true bytes, not the poison.
		const healed = await cache.match(URLS[1]);
		expect(await healed!.text()).toBe(bodyFor(URLS[1]));
		// And the honest network was hit exactly once, with reload intent.
		expect(honestFetch).toHaveBeenCalledTimes(1);
	});

	it('offline poisoning still loses its seat: deleted and reported', async () => {
		const cache = await installedCache();
		await cache.put(URLS[2], new Response('poisoned while offline', { status: 200 }));
		const offlineFetch = vi.fn(async () => {
			throw new Error('network unreachable');
		});
		const verdict = await verifyIntegrityGate(cache, offlineFetch as unknown as typeof fetch);
		expect(verdict.status).toBe('verified');
		if (verdict.status === 'verified') {
			expect(verdict.healed).toEqual([]);
			expect(verdict.poisoned).toEqual([URLS[2]]);
		}
		// The poisoned entry can never be served from this cache again.
		expect(await cache.match(URLS[2])).toBeUndefined();
		// The manifest no longer attests it: the digest seat is gone.
		const manifest = (await (await cache.match(INTEGRITY_MANIFEST_KEY))!.json()) as {
			digests: Record<string, string>;
		};
		expect(manifest.digests[URLS[2]]).toBeUndefined();
	});

	it('a missing precached entry heals through the network', async () => {
		const cache = await installedCache();
		await cache.delete(URLS[0]);
		const verdict = await verifyIntegrityGate(cache, honestFetch);
		expect(verdict).toEqual({ status: 'verified', healed: [URLS[0]], poisoned: [] });
		const restored = await cache.match(URLS[0]);
		expect(await restored!.text()).toBe(bodyFor(URLS[0]));
	});

	it('a missing manifest reads unverified (pre-Z7 caches adopt forward)', async () => {
		const cache = new FakeCache();
		await cache.put(URLS[0], new Response(bodyFor(URLS[0]), { status: 200 }));
		const verdict = await verifyIntegrityGate(cache, honestFetch);
		expect(verdict).toEqual({ status: 'unverified' });
		expect(honestFetch).not.toHaveBeenCalled();
	});

	it('a damaged manifest reads unverified instead of accusing', async () => {
		const cache = new FakeCache();
		await cache.put(INTEGRITY_MANIFEST_KEY, new Response('not the manifest', { status: 200 }));
		const verdict = await verifyIntegrityGate(cache, honestFetch);
		expect(verdict).toEqual({ status: 'unverified' });
	});
});
