/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Cache names
const CACHE_NAME = `cache-${version}`;
const STATIC_CACHE = `static-${version}`;
const RUNTIME_CACHE = `runtime-${version}`;

// Assets to cache immediately
const PRECACHE_URLS = [...build, ...files];

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
						.filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
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

	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}

			// Clone the request
			return fetch(request.clone()).then((response) => {
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
						cache.put(request, responseToCache);
					});
				}

				return response;
			});
		})
	);
});
