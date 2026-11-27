// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { base, build, files, version } from '$service-worker';
import { BMI_STELLAR_SIGNATURE } from '$lib/utils/signature';
import {
	buildIntegrityManifest,
	noteShellWrite,
	verifyIntegrityGate,
	verifyNextIntegrityEntry
} from '$lib/utils/shell-integrity';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Cache names
const CACHE_NAME = `cache-${version}`;

const RUNTIME_CACHE = `runtime-${version}`;

const APP_SHELL_URL = `${base}/`;

// Assets to cache immediately
const PRECACHE_URLS = Array.from(new Set([...build, ...files]));

const MAX_RUNTIME_ENTRIES = 60;

let runtimeTrimInProgress = false;

function isUsableAppShell(response: Response | undefined | null): response is Response {
	if (!response || !response.ok) return false;
	const contentType = response.headers.get('content-type') ?? '';
	return contentType.includes('text/html');
}

async function fetchAndCacheAppShell(cache: Cache) {
	const response = await fetch(new Request(APP_SHELL_URL, { cache: 'reload' }));
	if (!isUsableAppShell(response)) {
		throw new Error(`Unable to cache app shell: ${response.status} ${response.statusText}`);
	}
	await cache.put(APP_SHELL_URL, response.clone());
}

async function findCachedAppShell(): Promise<Response | undefined> {
	const direct = await caches.match(APP_SHELL_URL);
	if (isUsableAppShell(direct)) return direct;

	const root = APP_SHELL_URL === '/' ? undefined : await caches.match('/');
	if (isUsableAppShell(root)) return root;

	const keys = await caches.keys();
	for (const key of keys) {
		const cache = await caches.open(key);
		const cached = await cache.match(APP_SHELL_URL);
		if (isUsableAppShell(cached)) return cached;
	}
}

async function cacheNavigationResponse(request: Request, response: Response) {
	if (!isUsableAppShell(response)) return;
	const cache = await caches.open(CACHE_NAME);
	await Promise.all([
		cache.put(request, response.clone()),
		cache.put(APP_SHELL_URL, response.clone())
	]);
	// Night-frontier-Z10: the reseat law — a legit runtime write re-seats
	// its manifest digests at the moment of the write, so a
	// navigation-rewritten shell can never false-heal on a later sweep
	// and the gate's invariant ("manifest matches cache after every legit
	// write") holds across the whole offline lifetime.
	await noteShellWrite(cache, [APP_SHELL_URL, request.url]);
}

function offlineFallbackResponse(): Response {
	return new Response(
		`<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>BMI Stellar Offline</title>
		<style>
			html, body { margin: 0; min-height: 100%; background: #000; color: #fff; font-family: system-ui, sans-serif; }
			body {
				display: grid;
				place-items: center;
				padding: 24px;
				text-align: center;
				background:
					radial-gradient(circle at 50% 20%, rgba(71, 209, 255, 0.16), transparent 32rem),
					linear-gradient(180deg, #070914 0%, #000 100%);
			}
			main {
				max-width: 430px;
				padding: 28px;
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 18px;
				background: rgba(4, 8, 18, 0.72);
				box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
			}
			h1 { font-size: 1.28rem; margin: 0 0 0.75rem; letter-spacing: 0; }
			p { color: rgba(255, 255, 255, 0.78); line-height: 1.55; margin: 0; }
			.sig { margin-top: 1.25rem; font-size: 0.8rem; letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.5); }
		</style>
	</head>
	<body>
		<main>
			<h1>BMI Stellar is offline</h1>
			<p>Reconnect and refresh to load the latest app shell.</p>
			<p class="sig">BMI Stellar — ${BMI_STELLAR_SIGNATURE}</p>
		</main>
	</body>
</html>`,
		{
			status: 503,
			statusText: 'Offline',
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-store'
			}
		}
	);
}

// The bounded navigation windows (the cold-start law): a launch must
// never wait on the radio. The cold-start window bounds how long a
// cache-less navigation tries the network before the offline fallback
// answers; the refresh window bounds the background revalidation of a
// cache-served shell. The raced fetch is discarded on timeout - its
// eventual rejection is swallowed and no cache write can ride a late
// answer, so a dead radio can never pin the worker or the launch.
const NAV_COLD_START_TIMEOUT_MS = 3000;
const NAV_REFRESH_TIMEOUT_MS = 8000;

function raceNavigationFetch(request: Request, timeoutMs: number): Promise<Response | undefined> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<undefined>((resolve) => {
		timer = setTimeout(() => resolve(undefined), timeoutMs);
	});
	const attempt: Promise<Response | undefined> = fetch(request).catch(() => undefined);
	return Promise.race([attempt, timeout]).finally(() => clearTimeout(timer));
}

async function refreshNavigationCache(request: Request): Promise<void> {
	const response = await raceNavigationFetch(request, NAV_REFRESH_TIMEOUT_MS);
	if (isUsableAppShell(response)) {
		await cacheNavigationResponse(request, response.clone());
	}
}

sw.addEventListener('message', (event) => {
	const trustedOrigin = sw.location.origin;
	if (event.origin && event.origin !== trustedOrigin) {
		return;
	}

	if (event.data?.type === 'SKIP_WAITING') {
		event.waitUntil(sw.skipWaiting());
	}

	if (event.data?.type === 'GET_VERSION' && event.source) {
		// The page asks which build this worker carries
		// (pwa-update.ts): the answer names the buckets the update
		// purge must spare, so the post-reload session keeps the
		// offline precache this worker built at install.
		(event.source as Client).postMessage({ type: 'VERSION', version });
	}
});

async function trimCache(cacheName: string, maxEntries: number) {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();
	if (keys.length <= maxEntries) return;
	const excess = keys.length - maxEntries;
	await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
}

async function trimRuntimeCacheOnce() {
	if (runtimeTrimInProgress) return;
	runtimeTrimInProgress = true;
	try {
		await trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
	} finally {
		runtimeTrimInProgress = false;
	}
}

// Install event - cache core assets
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then(async (cache) => {
				await cache.addAll(PRECACHE_URLS);
				await fetchAndCacheAppShell(cache);
				// Night-frontier-Z7 (B3): digest every precached body into the
				// integrity manifest stored beside the assets. A failure here
				// aborts the install exactly like a failed addAll - an
				// unverifiable cache never activates.
				await buildIntegrityManifest(cache, PRECACHE_URLS);
			})
			.then(() => sw.skipWaiting())
	);
});

// Activate event - clean up old caches only after this version has a usable shell
// AND its integrity gate has no unresolved verdicts (night-frontier-Z7, B3).
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			let shell = await cache.match(APP_SHELL_URL);
			if (!isUsableAppShell(shell)) {
				const previousShell = await findCachedAppShell();
				if (previousShell) {
					await cache.put(APP_SHELL_URL, previousShell.clone());
					shell = previousShell;
				}
			}

			// The integrity gate: re-verify every precached entry against the
			// install-time manifest. Mismatches are deleted on the spot (a
			// poisoned entry can never be served again) and re-fetched when
			// the network allows. Old-cache cleanup waits for a gate with no
			// unresolved verdicts - a poisoned, unhealed cache keeps the
			// previous buckets alive as the fallback instead of inheriting
			// their trust.
			const gate = await verifyIntegrityGate(cache);
			const gateClear = gate.status === 'unverified' || gate.poisoned.length === 0;

			if (isUsableAppShell(shell) && gateClear) {
				const keys = await caches.keys();
				await Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
						.map((key) => caches.delete(key))
				);
			}

			await sw.clients.claim();
		})()
	);
});

// Fetch event - serve from cache, fallback to network
sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Ignore non-GET requests
	if (request.method !== 'GET') return;

	// Ignore cross-origin requests
	if (url.origin !== sw.location.origin) return;

	// Let partial-content/media range requests pass through untouched.
	if (request.headers.has('range')) return;

	// Navigation requests: cache-first with a bounded background refresh.
	// History: this branch was network-first, and on a device whose radio
	// cannot reach the network (no wifi, no data) the unbounded
	// fetch(request) hung for a minute or more before the catch fell back
	// to the cache — an installed PWA sat on its black launch screen the
	// whole time (the Android 12 offline cold-start report). The
	// digest-verified precache answers first now; the network only re-seats
	// the shell for the NEXT navigation, inside the bounded windows above,
	// and freshness stays with the SW version cycle plus the update prompt
	// (pwa-update.ts) instead of blocking the launch on the radio.
	if (request.mode === 'navigate') {
		// Night-frontier-Z10: the bounded window — one precache entry is
		// re-digested per navigation event, round-robin, with the activate
		// sweep's delete/heal semantics verbatim. waitUntil keeps the
		// worker alive for the digest without delaying the response; the
		// whole precache is re-verified every N navigations (N = manifest
		// size), so a poisoned entry can no longer survive until the next
		// update — it survives at most a bounded number of navigations.
		event.waitUntil(
			(async () => {
				const cache = await caches.open(CACHE_NAME);
				await verifyNextIntegrityEntry(cache);
			})()
		);
		event.respondWith(
			(async () => {
				const cachedResponse = await caches.match(request);
				if (isUsableAppShell(cachedResponse)) {
					void refreshNavigationCache(request);
					return cachedResponse;
				}

				const appShell = await findCachedAppShell();
				if (appShell) {
					void refreshNavigationCache(request);
					return appShell;
				}

				// Cold cache (cleared storage, first offline run): one bounded
				// network attempt, then the offline fallback — never an
				// unbounded wait on the radio.
				const networkResponse = await raceNavigationFetch(request, NAV_COLD_START_TIMEOUT_MS);
				if (isUsableAppShell(networkResponse)) {
					await cacheNavigationResponse(request, networkResponse.clone());
					return networkResponse;
				}

				return offlineFallbackResponse();
			})()
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}

			// Clone the request
			return fetch(request.clone())
				.then((response) => {
					// Don't cache non-successful responses
					if (!response || response.status !== 200 || response.type === 'error') {
						return response;
					}

					// Cache runtime assets
					if (
						url.pathname.startsWith('/_app/') ||
						url.pathname.startsWith('/assets/') ||
						url.pathname.endsWith('.woff2') ||
						url.pathname.endsWith('.webp')
					) {
						const responseToCache = response.clone();
						caches.open(RUNTIME_CACHE).then((cache) => {
							cache.put(request, responseToCache).then(() => trimRuntimeCacheOnce());
						});
					}

					return response;
				})
				.catch(() => new Response(null, { status: 504, statusText: 'Gateway Timeout' }));
		})
	);
});
