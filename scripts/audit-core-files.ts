// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

export const CORE_EXTENSIONS = new Set(['.ts', '.js', '.svelte', '.css']);

const EXCLUDED_DIRS = new Set([
	'.git',
	'.svelte-kit',
	'.vercel',
	'node_modules',
	'dist',
	'build',
	'coverage'
]);

export interface CoreFile {
	path: string;
	extension: string;
}

export async function readProjectLicense() {
	const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { license?: string };
	return normalizeSpdxLicense(packageJson.license ?? '');
}

export function normalizeSpdxLicense(license: string) {
	if (license === 'GPL-3.0') return 'GPL-3.0-only';
	return license;
}

export async function collectCoreFiles(root = '.'): Promise<CoreFile[]> {
	const files: CoreFile[] = [];

	async function walk(path: string) {
		const entryStat = await stat(path);
		if (entryStat.isDirectory()) {
			const name = path.split(sep).at(-1) ?? path;
			if (EXCLUDED_DIRS.has(name)) return;

			const entries = await readdir(path, { withFileTypes: true });
			await Promise.all(entries.map((entry) => walk(join(path, entry.name))));
			return;
		}

		if (!entryStat.isFile()) return;
		const extension = extname(path);
		if (!CORE_EXTENSIONS.has(extension)) return;
		files.push({ path: relative(root, path) || path, extension });
	}

	await walk(root);
	return files.sort((a, b) => a.path.localeCompare(b.path));
}
