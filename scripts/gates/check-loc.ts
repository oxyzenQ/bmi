// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from 'node:fs/promises';
import { collectCoreFiles } from '../lib/audit-core-files';

// The zelynic-aligned LOC law (RULES.md "Line Count Discipline"), three
// tiers enforced in one walk:
//   1. 1000 lines - the hard cap for every core file, no exceptions;
//   2. 600 lines - the ratchet: any file at or above 600 must be recorded
//      with its exact count in scripts/loc-ratchet.json and may NEVER
//      grow past that watermark; a new file crossing 600 fails until its
//      entry is added by hand (visible debt in the diff);
//   3. shrink-only: a recorded file that drops below 600 must have its
//      entry removed in the same change - the debt ledger only shrinks.
const HARD_LIMIT = 1000;
const RATCHET_LIMIT = 600;
const RATCHET_MANIFEST = 'scripts/loc-ratchet.json';

interface RatchetManifest {
	$comment?: string;
	generated?: string;
	files?: Record<string, number>;
}

async function countLines(path: string) {
	const contents = await readFile(path, 'utf8');
	if (contents.length === 0) return 0;
	return contents.endsWith('\n') ? contents.split('\n').length - 1 : contents.split('\n').length;
}

const files = await collectCoreFiles();

let ratchet: RatchetManifest = {};
try {
	ratchet = JSON.parse(await readFile(RATCHET_MANIFEST, 'utf8')) as RatchetManifest;
} catch {
	// A missing manifest is legal only while no file crosses the ratchet
	// limit - the checks below still enforce exactly that.
}

const recorded = ratchet.files ?? {};
const violations: string[] = [];
const staleEntries: string[] = [];
const measured: { path: string; lines: number }[] = [];

for (const file of files) {
	const lines = await countLines(file.path);
	measured.push({ path: file.path, lines });

	if (lines > HARD_LIMIT) {
		violations.push(`- ${file.path}: ${lines} LOC (hard cap ${HARD_LIMIT})`);
		continue;
	}

	if (lines >= RATCHET_LIMIT) {
		const watermark = recorded[file.path];
		if (watermark === undefined) {
			violations.push(
				`- ${file.path}: ${lines} LOC crosses the ${RATCHET_LIMIT}-line ratchet and is not recorded in ${RATCHET_MANIFEST}`
			);
		} else if (lines > watermark) {
			violations.push(
				`- ${file.path}: ${lines} LOC grew past its recorded watermark ${watermark} (the ratchet only moves down)`
			);
		}
	} else if (recorded[file.path] !== undefined) {
		staleEntries.push(file.path);
	}
}

measured.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));

if (violations.length > 0) {
	console.error(`LOC rule failed (hard cap ${HARD_LIMIT}, ratchet ${RATCHET_LIMIT}):`);
	for (const violation of violations) console.error(violation);
	process.exit(1);
}

if (staleEntries.length > 0) {
	console.error(
		`LOC ratchet manifest carries ${staleEntries.length} stale entry(ies) below the ${RATCHET_LIMIT}-line ratchet - remove them:`
	);
	for (const path of staleEntries) console.error(`- ${path}`);
	process.exit(1);
}

const ratcheted = measured.filter(({ lines }) => lines >= RATCHET_LIMIT).length;
console.log(
	`LOC rule passed: ${files.length} core files under ${HARD_LIMIT} lines; ${ratcheted} ratcheted at ${RATCHET_LIMIT}+ (no growth allowed).`
);
