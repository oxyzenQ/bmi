// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { base, build, files, version } from '$service-worker';

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
			body { display: grid; place-items: center; padding: 24px; text-align: center; }
			main { max-width: 420px; }
			h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
			p { color: rgba(255, 255, 255, 0.72); line-height: 1.5; margin: 0; }
		</style>
	</head>
	<body>
		<main>
			<h1>BMI Stellar is offline</h1>
			<p>Reconnect and refresh to load the latest app shell.</p>
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

sw.addEventListener('message', (event) => {
	const trustedOrigin = sw.location.origin;
	if (event.origin && event.origin !== trustedOrigin) {
		return;
	}

	if (event.data?.type === 'SKIP_WAITING') {
		event.waitUntil(sw.skipWaiting());
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
			})
			.then(() => sw.skipWaiting())
	);
});

// Activate event - clean up old caches only after this version has a usable shell
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

			if (isUsableAppShell(shell)) {
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

	// Navigation requests: network-first for HTML pages to avoid stale content
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					void cacheNavigationResponse(request, response.clone());
					return response;
				})
				.catch(() => {
					// Fallback to cache when offline
					return caches.match(request).then((cachedResponse) => {
						return (
							cachedResponse ||
							findCachedAppShell().then((shell) => shell || offlineFallbackResponse())
						);
					});
				})
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
