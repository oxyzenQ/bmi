// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

import { readFile } from 'node:fs/promises';

const source = await readFile('src/service-worker.ts', 'utf8');

const requiredSnippets = [
	"import { base, build, files, version } from '$service-worker';",
	'const APP_SHELL_URL = `${base}/`;',
	'await fetchAndCacheAppShell(cache);',
	'await cache.put(APP_SHELL_URL, response.clone());',
	'async function findCachedAppShell()',
	'if (isUsableAppShell(shell)) {',
	'cache.put(APP_SHELL_URL, response.clone())',
	'offlineFallbackResponse()'
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

if (missing.length > 0) {
	console.error('PWA offline-shell audit failed.');
	for (const item of missing) {
		console.error(`- ${item}`);
	}
	process.exit(1);
}

console.log('PWA offline-shell audit passed.');
