// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * check-headers.ts - the masterclass SPDX header gate (night-ux-orion-2,
 * the ecosystem standardization, byte-aligned with the zejtron law).
 *
 * Every living file carries the masterclass SPDX header within its
 * first 10 lines - the machine-readable disclosure every corporate
 * scanner (FOSSA, Black Duck) reads, plus the dual-license expression:
 *
 *   SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
 *   SPDX-License-Identifier: AGPL-3.0-only OR Commercial
 *
 * wrapped in the comment syntax of the file type: line comments for
 * code and config (.ts .js .rs .sh .py .yml .yaml .toml), single-line
 * HTML/C comments for markup and styles (.svelte .css), and the block
 * form for documents and the HTML shell (.md .html). The manifest is
 * the license truth source: package.json carries the machine-validated
 * SPDX expression (LicenseRef-Commercial), while the header spelling
 * keeps the human-readable "OR Commercial" form - the same law the
 * zejtron estate runs (bare "Commercial" is not a valid SPDX term, so
 * the manifest uses the LicenseRef- form and the headers keep the
 * prose spelling).
 *
 * Scope: git-tracked files PLUS untracked-but-present files (respecting
 * .gitignore), so a new source file missing its header fails the check
 * BEFORE it can be committed (pre-commit proxy parity).
 * Excluded: CHANGELOG.md - a frozen historical record, never rewritten
 * (the same exclusion policy as every other gate) - and everything
 * under docs/archive/ (the frozen era records). Machine-generated
 * files (locks, JSON manifests, images) carry no comment form and are
 * out of scope by extension.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { readProjectLicense } from '../lib/audit-core-files';

const HEADER_EXTENSIONS = new Set([
	'.ts',
	'.js',
	'.svelte',
	'.css',
	'.rs',
	'.sh',
	'.py',
	'.yml',
	'.yaml',
	'.toml',
	'.md',
	'.html'
]);

// Filename-form yaml configs (no standard extension, still yaml law).
const HEADER_FILENAMES = new Set(['.yamllint']);

const EXCLUDED_DIRS = new Set([
	'.git',
	'.svelte-kit',
	'.vercel',
	'node_modules',
	'dist',
	'build',
	'coverage'
]);

const EXCLUDED_FILES = new Set(['CHANGELOG.md']);
const EXCLUDED_PREFIXES = ['docs/archive/'];

const HOLDER = 'SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)';

interface LawfulFile {
	path: string;
	extension: string;
}

async function headerLicense(): Promise<string> {
	const manifestLicense = await readProjectLicense();
	// The header keeps the human-readable "OR Commercial" spelling; the
	// manifest carries the machine-validated LicenseRef- expression.
	return manifestLicense.replace('LicenseRef-Commercial', 'Commercial');
}

function blockFor(extension: string, license: string): string[] {
	if (extension === '.md' || extension === '.html') {
		return ['<!--', `  ${HOLDER}`, `  SPDX-License-Identifier: ${license}`, '-->'];
	}

	let prefix: string;
	let tail = '';
	if (extension === '.svelte') {
		prefix = '<!--';
		tail = ' -->';
	} else if (extension === '.css') {
		prefix = '/*';
		tail = ' */';
	} else {
		prefix = ['.ts', '.js', '.rs'].includes(extension) ? '//' : '#';
	}
	return [`${prefix} ${HOLDER}${tail}`, `${prefix} SPDX-License-Identifier: ${license}${tail}`];
}

async function collectLawfulFiles(root = '.'): Promise<LawfulFile[]> {
	const files: LawfulFile[] = [];

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
		const base = path.split(sep).at(-1) ?? path;
		const extension = HEADER_FILENAMES.has(base) ? '.yamllint' : extname(path);
		if (!HEADER_EXTENSIONS.has(extension)) return;
		const rel = relative(root, path) || path;
		if (EXCLUDED_FILES.has(base)) return;
		if (EXCLUDED_PREFIXES.some((prefix) => rel.split(sep).join('/').startsWith(prefix))) return;
		files.push({ path: rel, extension });
	}

	await walk(root);
	return files.sort((a, b) => a.path.localeCompare(b.path));
}

const license = await headerLicense();
const files = await collectLawfulFiles();
const violations: string[] = [];
const WINDOW = 10;

for (const file of files) {
	const contents = await readFile(file.path, 'utf8');
	const lines = contents
		.split('\n')
		.slice(0, WINDOW)
		.map((line) => line.trim());
	const expected = blockFor(file.extension, license);
	const copyrightLine = expected[0].trim();
	const licenseLine = expected[1].trim();
	const copyrightFound = lines.findIndex((line) => line === copyrightLine);
	const licenseFound = lines.findIndex((line) => line === licenseLine);
	if (
		copyrightFound === -1 ||
		licenseFound === -1 ||
		licenseFound >= WINDOW ||
		licenseFound < copyrightFound
	) {
		violations.push(file.path);
	}
}

if (violations.length > 0) {
	console.error(
		`Header audit failed: expected the masterclass SPDX header (${license}) within the first ${WINDOW} lines.`
	);
	for (const path of violations) {
		console.error(`- ${path}`);
	}
	process.exit(1);
}

console.log(
	`Header audit passed: ${files.length} living files carry the masterclass SPDX header (${license}).`
);
