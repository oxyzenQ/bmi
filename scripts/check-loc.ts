// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const LIMIT = 1000;
const CORE_EXTENSIONS = new Set(['.ts', '.svelte', '.css']);
const SCAN_ROOTS = ['src', 'scripts'];
const ROOT_FILES = ['vite.config.ts', 'vitest.config.ts'];

async function collectFiles(path: string): Promise<string[]> {
	const entryStat = await stat(path);
	if (entryStat.isFile()) return CORE_EXTENSIONS.has(extname(path)) ? [path] : [];
	if (!entryStat.isDirectory()) return [];

	const entries = await readdir(path, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const next = join(path, entry.name);
			if (entry.isDirectory()) return collectFiles(next);
			if (entry.isFile() && CORE_EXTENSIONS.has(extname(entry.name))) return [next];
			return [];
		})
	);
	return nested.flat();
}

async function countLines(path: string) {
	const contents = await readFile(path, 'utf8');
	if (contents.length === 0) return 0;
	return contents.endsWith('\n') ? contents.split('\n').length - 1 : contents.split('\n').length;
}

const files = (
	await Promise.all([...SCAN_ROOTS, ...ROOT_FILES].map((path) => collectFiles(path)))
).flat();

const violations = (
	await Promise.all(
		files.map(async (path) => ({
			path,
			lines: await countLines(path)
		}))
	)
)
	.filter(({ lines }) => lines >= LIMIT)
	.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));

if (violations.length > 0) {
	console.error(`LOC rule failed: core files must stay under ${LIMIT} lines.`);
	for (const { path, lines } of violations) {
		console.error(`- ${path}: ${lines} LOC`);
	}
	process.exit(1);
}

console.log(`LOC rule passed: ${files.length} core files are under ${LIMIT} lines.`);
