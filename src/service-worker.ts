// Copyright (c) 2025 - 2026 rezky_nightky
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Cache names
const CACHE_NAME = `cache-${version}`;

const RUNTIME_CACHE = `runtime-${version}`;

// Assets to cache immediately
const PRECACHE_URLS = [...build, ...files];

const MAX_RUNTIME_ENTRIES = 60;

let runtimeTrimInProgress = false;

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
			.then((cache) => cache.addAll(PRECACHE_URLS))
			.then(() => sw.skipWaiting())
	);
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
						.map((key) => caches.delete(key))
				);
			})
			.then(() => sw.clients.claim())
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
					// Cache successful responses for offline fallback
					if (response && response.status === 200) {
						const responseToCache = response.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(request, responseToCache);
						});
					}
					return response;
				})
				.catch(() => {
					// Fallback to cache when offline
					return caches.match(request).then((cachedResponse) => {
						return (
							cachedResponse || caches.match('/').then((root) => root || offlineFallbackResponse())
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
