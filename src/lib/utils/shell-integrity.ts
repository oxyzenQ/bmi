// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The shell integrity gate (night-frontier-Z7, B3 - the
 * cache-integrity-gated shell).
 *
 * The service worker precaches the app shell and its build assets into
 * a versioned Cache Storage bucket, and serves them offline forever.
 * Cache Storage is same-origin state an out-of-band writer can reach
 * (device access, hostile extensions, a corrupted disk): a poisoned
 * precache entry survives every reload until the cache version turns
 * over. This module gives the update path a digest gate: at INSTALL
 * every precached body is SHA-256-digested into a manifest stored
 * alongside the assets; at ACTIVATE the manifest is re-verified entry
 * by entry, a mismatching entry is DELETED (it can never be served
 * again from this cache) and re-fetched from the network when the
 * network allows; the old-cache cleanup runs only once the gate has no
 * unresolved verdicts. Cache poisoning cannot survive an update.
 *
 * The gate rides the existing usability law: `isUsableAppShell` decides
 * whether an HTML response may act as the shell; the digest manifest
 * decides whether the CACHE those responses live in may be trusted
 * through an update.
 *
 * Honest limits, in the same breath:
 *   - Workbox precaching ships revision hashes today; the rare part
 *     here is the gate ADOPTION in a hand-written service worker - the
 *     primitive is prior art, the enforcement point is new.
 *   - The service worker itself is the root of trust: it computes the
 *     digests and reads them back. A compromised SW is outside this
 *     model (it could rewrite both sides); the gate targets state that
 *     OUTLIVES the SW - Cache Storage entries.
 *   - Verification runs on the update path (install/activate), not on
 *     every fetch: between installs a poisoned entry could serve if it
 *     was written after the last activation. The gate's claim is
 *     exactly the brief's: poisoning cannot SURVIVE an update. Since
 *     night-frontier-Z10 the window itself is bounded: ONE manifest
 *     entry is re-digested per navigation event, round-robin, with the
 *     heal/delete semantics of the full sweep verbatim — the whole
 *     precache is re-verified every N navigations (N = manifest size),
 *     amortized to zero measurable cost per fetch, and the per-fetch
 *     digest law stays intact. Legit runtime writes (the navigation
 *     shell the SW itself caches) re-seat their manifest digests at the
 *     moment of the write — the reseat law — so the gate's invariant is
 *     "the manifest matches the cache after every legit write; any
 *     other divergence is an out-of-band write" and a navigation-rewritten
 *     shell can never false-heal on an offline sweep.
 *   - Only the precache (build + static files + the shell) is
 *     digested; the runtime cache holds network-fetched content the
 *     origin already served, and digesting it per fetch would cost the
 *     offline path real time for no threat-model gain.
 *   - Old caches from pre-Z7 versions carry no manifest; their entries
 *     fall back to the existing usability checks (honest degrade, the
 *     gate adopts forward, never misfires backward).
 */

/** The synthetic cache entry holding the digest manifest. */
export const INTEGRITY_MANIFEST_KEY = '__shell-integrity-v1';

/** The manifest shape: one SHA-256 hex per precached URL. */
export interface ShellIntegrityManifest {
	v: 1;
	digests: Record<string, string>;
}

/** The minimum Cache surface this module touches (testable without SW globals). */
export interface CacheLike {
	match(request: RequestInfo | URL): Promise<Response | undefined>;
	put(request: RequestInfo | URL, response: Response): Promise<void>;
	delete(request: RequestInfo | URL): Promise<boolean>;
	keys(): Promise<Request[]>;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function bodyDigest(cache: CacheLike, url: string): Promise<string | null> {
	try {
		const response = await cache.match(url);
		if (!response || !response.ok) return null;
		return await sha256Hex(await response.clone().arrayBuffer());
	} catch {
		return null;
	}
}

/**
 * Digest every precached entry and store the manifest inside the same
 * cache. Throws when any entry is unreadable at install time - the
 * caller (install) aborts the cache, exactly like a failed addAll.
 */
export async function buildIntegrityManifest(
	cache: CacheLike,
	urls: readonly string[]
): Promise<ShellIntegrityManifest> {
	const digests: Record<string, string> = {};
	for (const url of urls) {
		const digest = await bodyDigest(cache, url);
		if (digest === null) {
			throw new Error(`shell integrity: precached entry unreadable at ${url}`);
		}
		digests[url] = digest;
	}
	const manifest: ShellIntegrityManifest = { v: 1, digests };
	await cache.put(
		INTEGRITY_MANIFEST_KEY,
		new Response(JSON.stringify(manifest), {
			headers: { 'Content-Type': 'application/json' }
		})
	);
	return manifest;
}

async function readManifest(cache: CacheLike): Promise<ShellIntegrityManifest | null> {
	try {
		const response = await cache.match(INTEGRITY_MANIFEST_KEY);
		if (!response) return null;
		const parsed = (await response.json()) as ShellIntegrityManifest;
		if (parsed?.v !== 1 || typeof parsed.digests !== 'object' || parsed.digests === null) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Verify a cache against its stored manifest: every digest mismatch or
 * missing entry is DELETED immediately (a poisoned entry can never be
 * served from this cache again), then re-fetched from the network with
 * `cache: 'reload'` when possible (healed entries are re-digested into
 * the manifest). An unreadable manifest returns 'unverified' - the
 * honest degrade for pre-Z7 caches, which keep the existing usability
 * checks.
 */
export async function verifyIntegrityGate(
	cache: CacheLike,
	networkFetch: typeof fetch = fetch
): Promise<
	{ status: 'unverified' } | { status: 'verified'; healed: string[]; poisoned: string[] }
> {
	const manifest = await readManifest(cache);
	if (!manifest) return { status: 'unverified' };
	const healed: string[] = [];
	const poisoned: string[] = [];
	const digests: Record<string, string> = {};
	for (const [url, expected] of Object.entries(manifest.digests)) {
		const actual = await bodyDigest(cache, url);
		if (actual === expected) {
			digests[url] = expected;
			continue;
		}
		// Mismatch or missing: the entry loses its seat in this cache
		// before anything else happens.
		await cache.delete(url);
		try {
			const fresh = await networkFetch(url, { cache: 'reload' });
			if (fresh && fresh.ok) {
				await cache.put(url, fresh.clone());
				const redigest = await bodyDigest(cache, url);
				if (redigest !== null) {
					digests[url] = redigest;
					healed.push(url);
					continue;
				}
			}
		} catch {
			// Offline or refused: the entry stays deleted - poisoned state
			// does not survive, availability is re-earned from the network.
		}
		poisoned.push(url);
	}
	await cache.put(
		INTEGRITY_MANIFEST_KEY,
		new Response(JSON.stringify({ v: 1, digests } satisfies ShellIntegrityManifest), {
			headers: { 'Content-Type': 'application/json' }
		})
	);
	return { status: 'verified', healed, poisoned };
}

// ── Night-frontier-Z10: the bounded window ──

/**
 * Manifest mutations are serialized in one per-realm promise chain (the
 * same discipline as the per-key IDB write queue): the round-robin
 * verdict and a legit-write re-seat can never interleave a read of the
 * manifest with the other's write, so the manifest always reflects the
 * last ordered mutation.
 */
let manifestChain: Promise<unknown> = Promise.resolve();
function withManifestLock<T>(op: () => Promise<T>): Promise<T> {
	const run = manifestChain.then(op, op);
	manifestChain = run.catch(() => {});
	return run;
}

/** The round-robin cursor: one manifest entry per navigation event. */
let rrCursor = 0;

/** @internal Test-only: reset the cursor (and the lock chain) between batteries. */
export function _resetShellIntegrityForTesting(): void {
	rrCursor = 0;
	manifestChain = Promise.resolve();
}

async function writeManifest(cache: CacheLike, digests: Record<string, string>): Promise<void> {
	await cache.put(
		INTEGRITY_MANIFEST_KEY,
		new Response(JSON.stringify({ v: 1, digests } satisfies ShellIntegrityManifest), {
			headers: { 'Content-Type': 'application/json' }
		})
	);
}

/**
 * Re-seat the manifest digests for entries the service worker ITSELF
 * just wrote at runtime (the navigation shell) — the reseat law: a legit
 * write updates the manifest at the moment of the write, so the gate's
 * invariant ("manifest matches cache after every legit write") holds
 * and a navigation-rewritten shell can never false-heal on a later
 * sweep. An absent manifest is a no-op: a pre-Z7 cache never arms the
 * gate from a runtime write (its other entries were never digested, so
 * arming here would false-accuse them later). Unreadable entries are
 * skipped, never judged from a note — the sweeps own the verdicts.
 */
export function noteShellWrite(cache: CacheLike, urls: readonly string[]): Promise<void> {
	return withManifestLock(async () => {
		const manifest = await readManifest(cache);
		if (!manifest) return;
		const digests = { ...manifest.digests };
		let changed = false;
		for (const url of urls) {
			const digest = await bodyDigest(cache, url);
			if (digest === null || digests[url] === digest) continue;
			digests[url] = digest;
			changed = true;
		}
		if (changed) await writeManifest(cache, digests);
	});
}

/**
 * Re-digest ONE manifest entry, round-robin, with the full sweep's
 * semantics verbatim (night-frontier-Z10): a match reads clean; a
 * mismatch or missing entry is DELETED on the spot, re-fetched with
 * `cache: 'reload'` when the network allows (healed entries are
 * re-digested into the manifest), and otherwise stays deleted with its
 * manifest seat dropped — poisoned state cannot survive a bounded
 * number of navigations (every entry is re-verified at least once per
 * N navigations, N = manifest size). The absent-manifest degrade is
 * identical to the sweep: 'unverified', nothing touched. Amortized
 * cost per navigation: one match + one SHA-256 of a single entry — the
 * per-fetch digest law stays intact.
 */
export function verifyNextIntegrityEntry(
	cache: CacheLike,
	networkFetch: typeof fetch = fetch
): Promise<
	| { status: 'unverified' }
	| { status: 'verified'; url: string; verdict: 'clean' | 'healed' | 'poisoned' }
> {
	return withManifestLock(async () => {
		const manifest = await readManifest(cache);
		if (!manifest) return { status: 'unverified' };
		const urls = Object.keys(manifest.digests);
		if (urls.length === 0) return { status: 'verified', url: '', verdict: 'clean' };
		const url = urls[rrCursor % urls.length];
		rrCursor = (rrCursor + 1) % urls.length;
		const actual = await bodyDigest(cache, url);
		if (actual === manifest.digests[url]) {
			return { status: 'verified', url, verdict: 'clean' };
		}
		// Mismatch or missing — the full sweep's semantics, one entry wide:
		// the entry loses its seat in this cache before anything else.
		await cache.delete(url);
		try {
			const fresh = await networkFetch(url, { cache: 'reload' });
			if (fresh && fresh.ok) {
				await cache.put(url, fresh.clone());
				const redigest = await bodyDigest(cache, url);
				if (redigest !== null) {
					await writeManifest(cache, { ...manifest.digests, [url]: redigest });
					return { status: 'verified', url, verdict: 'healed' };
				}
			}
		} catch {
			// Offline or refused: the entry stays deleted - poisoned state
			// does not survive, availability is re-earned from the network.
		}
		const digests = { ...manifest.digests };
		delete digests[url];
		await writeManifest(cache, digests);
		return { status: 'verified', url, verdict: 'poisoned' };
	});
}
