// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// The proof census guard (night-netrunner-Z2) - the absence seat.
//
// Runs no harness at all. It re-reads the proof tier table
// (proofs/manifest.json) out of the tree and fails loudly the day the
// basis moves: a harness file deleted, a source law renamed away, a
// harness that stops importing the app source, an orphan harness
// riding outside the manifest, a lane seat missing from the
// proofs.yml matrix, or a census verdict going incomplete. The honest
// NOs are enforced, not merely archived - a red here is drift, never
// a skip.

import { readFile, readdir } from 'node:fs/promises';

const MANIFEST_PATH = 'proofs/manifest.json';
const LANE_PATH = '.github/workflows/proofs.yml';

interface HarnessEntry {
	file?: string;
	source?: string;
	laws?: string[];
	theorem?: string;
}

interface CensusEntry {
	instrument?: string;
	verdict?: string;
	reason?: string;
}

interface ProofManifest {
	tier?: string;
	lane?: string;
	oneInvocationPerHarness?: boolean;
	harnesses?: HarnessEntry[];
	census?: CensusEntry[];
}

const violations: string[] = [];

// ── The tier table itself ──
const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as ProofManifest;
if (manifest.tier !== 'for-all') {
	violations.push(`manifest tier must be "for-all", found: ${String(manifest.tier)}`);
}
if (manifest.oneInvocationPerHarness !== true) {
	violations.push(
		'manifest must pin oneInvocationPerHarness: true (a verdict is never lost to a sibling)'
	);
}

const harnesses = manifest.harnesses ?? [];
if (harnesses.length === 0) {
	violations.push('manifest lists no harnesses - the for-all tier is empty');
}

// ── Every harness exists, imports the app source, and exercises its laws ──
for (const harness of harnesses) {
	const harnessPath = `proofs/${harness.file}`;
	let harnessText: string;
	try {
		harnessText = await readFile(harnessPath, 'utf8');
	} catch {
		violations.push(`harness file missing: ${harnessPath}`);
		continue;
	}
	if (!harnessText.includes("'../src/")) {
		violations.push(`harness does not import the app source directly: ${harness.file}`);
	}
	if (!harness.theorem || harness.theorem.length < 20) {
		violations.push(`harness theorem statement missing or too thin: ${harness.file}`);
	}

	let sourceText: string;
	try {
		sourceText = await readFile(harness.source ?? '', 'utf8');
	} catch {
		violations.push(`source module missing: ${harness.source}`);
		continue;
	}
	for (const law of harness.laws ?? []) {
		const exported = new RegExp(`export (async )?(function|const) ${law}\\b`).test(sourceText);
		if (!exported) {
			violations.push(`law not exported by its source module: ${law} (${harness.source})`);
		}
		if (!harnessText.includes(law)) {
			violations.push(`law not exercised by its harness: ${law} (${harness.file})`);
		}
	}
}

// ── No orphan and no ghost: the tree and the table agree ──
const proofDirEntries = await readdir('proofs', { withFileTypes: true });
const testFiles = proofDirEntries
	.filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
	.map((entry) => entry.name)
	.sort();
const listedFiles = harnesses.map((harness) => harness.file ?? '');
for (const file of testFiles) {
	if (!listedFiles.includes(file)) {
		violations.push(`orphan harness on disk but not in the manifest: ${file}`);
	}
}
for (const file of listedFiles) {
	if (file && !testFiles.includes(file)) {
		violations.push(`ghost harness in the manifest but not on disk: ${file}`);
	}
}

// ── The lane carries one seat per harness, fail-fast off ──
let laneText = '';
try {
	laneText = await readFile(LANE_PATH, 'utf8');
} catch {
	violations.push(`proof lane missing: ${LANE_PATH}`);
}
if (laneText) {
	for (const file of listedFiles) {
		const seat = file.replace('.test.ts', '');
		if (seat && !laneText.includes(`- ${seat}`)) {
			violations.push(`lane matrix seat missing for harness: ${file}`);
		}
	}
	if (!laneText.includes('fail-fast: false')) {
		violations.push('lane matrix must set fail-fast: false (a verdict is never lost to a sibling)');
	}
	if (manifest.lane && manifest.lane !== LANE_PATH.replace(/\\/g, '/')) {
		violations.push(`manifest lane points elsewhere: ${manifest.lane}`);
	}
}

// ── The census: the honest NOs stand ──
const census = manifest.census ?? [];
if (census.length === 0) {
	violations.push('census is empty - the honest NOs are standing, not archival');
}
for (const entry of census) {
	if (!entry.instrument || !entry.verdict || !entry.reason) {
		violations.push(
			`census entry incomplete (instrument, verdict, reason): ${entry.instrument ?? '(unnamed)'}`
		);
	}
}

if (violations.length > 0) {
	console.error(`proof census guard FAILED (${violations.length} violation(s)):`);
	for (const violation of violations) console.error(`  - ${violation}`);
	process.exit(1);
}

console.log(
	`proof census guard passed: ${harnesses.length} harnesses, ` +
		`${testFiles.length} seats on disk, ${census.length} standing census verdicts, ` +
		'every law exported by its source and exercised by its harness.'
);
