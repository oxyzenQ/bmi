// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

import { readFile } from 'node:fs/promises';

const source = await readFile('src/service-worker.ts', 'utf8');

const requiredSnippets = [
	"import { base, build, files, version } from '$service-worker';",
	'const APP_SHELL_URL = `${base}/`;',
	'await fetchAndCacheAppShell(cache);',
	'await cache.put(APP_SHELL_URL, response.clone());',
	'async function findCachedAppShell()',
	'if (isUsableAppShell(shell) && gateClear) {',
	// night-frontier-Z7 (B3): the cleanup also waits for the integrity
	// gate - a poisoned, unhealed cache keeps the previous buckets alive
	// as the fallback instead of inheriting their trust.
	'const gate = await verifyIntegrityGate(cache);',
	"const gateClear = gate.status === 'unverified' || gate.poisoned.length === 0;",
	'cache.put(APP_SHELL_URL, response.clone())',
	'offlineFallbackResponse()',
	// night-frontier-Z10: the bounded window — the navigation path re-seats
	// legit writes into the manifest and re-digests ONE precache entry per
	// navigation, round-robin, so poisoning cannot survive a bounded
	// number of navigations (not just an update).
	'noteShellWrite(cache, [APP_SHELL_URL, request.url])',
	'verifyNextIntegrityEntry(cache)'
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));

const fallbackExactIndex = source.indexOf('const cachedResponse = await caches.match(request);');
const fallbackStableIndex = source.indexOf('const appShell = await findCachedAppShell();');
const fallbackOfflineIndex = source.indexOf('return offlineFallbackResponse();');

if (
	fallbackExactIndex === -1 ||
	fallbackStableIndex === -1 ||
	fallbackOfflineIndex === -1 ||
	!(fallbackExactIndex < fallbackStableIndex && fallbackStableIndex < fallbackOfflineIndex)
) {
	missing.push('navigation fallback order: exact cache -> app shell -> offline fallback');
}

// night-frontier-Z10: the runtime gate must ride the NAVIGATION branch
// (request.mode === 'navigate') and its waitUntil verify must be wired
// before the branch's respondWith; the re-seat must run inside
// cacheNavigationResponse after its cache.put calls.
const navBranchIndex = source.indexOf("if (request.mode === 'navigate')");
const rrVerifyIndex = source.indexOf('await verifyNextIntegrityEntry(cache);');
const navRespondWith = source.indexOf('event.respondWith(', navBranchIndex);
const noteIndex = source.indexOf('await noteShellWrite(cache,');
const navPutIndex = source.indexOf('cache.put(APP_SHELL_URL, response.clone());');
if (navBranchIndex === -1 || rrVerifyIndex === -1 || navRespondWith === -1) {
	missing.push('round-robin re-verification wiring (night-frontier-Z10)');
} else if (!(navBranchIndex < rrVerifyIndex && rrVerifyIndex < navRespondWith)) {
	missing.push(
		'round-robin re-verification must ride the navigation branch, before its respondWith'
	);
}
if (noteIndex === -1 || navPutIndex === -1 || !(navPutIndex < noteIndex)) {
	missing.push('legit-write re-seat must run after the navigation cache.put calls');
}

if (missing.length > 0) {
	console.error('PWA offline-shell audit failed.');
	for (const item of missing) {
		console.error(`- ${item}`);
	}
	process.exit(1);
}

console.log('PWA offline-shell audit passed.');
