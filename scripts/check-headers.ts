// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

import { readFile } from 'node:fs/promises';
import { collectCoreFiles, readProjectLicense } from './audit-core-files';

function expectedHeader(extension: string, license: string) {
	if (extension === '.svelte') {
		return [
			'<!-- Copyright (C) 2026 rezky_nightky -->',
			`<!-- SPDX-License-Identifier: ${license} -->`
		].join('\n');
	}

	if (extension === '.css') {
		return [
			'/* Copyright (C) 2026 rezky_nightky */',
			`/* SPDX-License-Identifier: ${license} */`
		].join('\n');
	}

	return ['// Copyright (C) 2026 rezky_nightky', `// SPDX-License-Identifier: ${license}`].join(
		'\n'
	);
}

const license = await readProjectLicense();
const files = await collectCoreFiles();
const violations: string[] = [];

for (const file of files) {
	const contents = await readFile(file.path, 'utf8');
	if (!contents.startsWith(expectedHeader(file.extension, license))) {
		violations.push(file.path);
	}
}

if (violations.length > 0) {
	console.error(`Header audit failed: expected copyright/SPDX header using ${license}.`);
	for (const path of violations) {
		console.error(`- ${path}`);
	}
	process.exit(1);
}

console.log(`Header audit passed: ${files.length} core files use ${license}.`);
