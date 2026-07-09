// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

import { readFile } from 'node:fs/promises';
import { collectCoreFiles } from './audit-core-files';

const LIMIT = 1000;

async function countLines(path: string) {
	const contents = await readFile(path, 'utf8');
	if (contents.length === 0) return 0;
	return contents.endsWith('\n') ? contents.split('\n').length - 1 : contents.split('\n').length;
}

const files = await collectCoreFiles();

const violations = (
	await Promise.all(
		files.map(async (file) => ({
			path: file.path,
			lines: await countLines(file.path)
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
