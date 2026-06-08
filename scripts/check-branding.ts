// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
/**
 * check-branding.ts — branding audit: ensure no old logo/screenshot names remain.
 *
 * Fail if any of these banned patterns appear in tracked source or asset files:
 *   - bmi-logo-rounded
 *   - new_bmi_logo
 *   - screenshot-wide.webp
 *   - screenshot-narrow.webp
 */

import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const BANNED = [
	'bmi-logo-rounded',
	'new_bmi_logo',
	'screenshot-wide.webp',
	'screenshot-narrow.webp'
] as const;

let failed = false;

for (const pattern of BANNED) {
	const result = execSync(
		`grep -RInE '${pattern}' src static README.md BRANDING.md docs package.json 2>/dev/null || true`,
		{ encoding: 'utf-8', cwd: process.cwd() }
	);
	const trimmed = result.trim();
	if (trimmed.length > 0) {
		console.error(`Branding audit FAILED — found banned pattern "${pattern}":`);
		console.error(trimmed);
		failed = true;
	}
}

// Also check that no old asset files exist on disk
const assetsDir = join(process.cwd(), 'static', 'assets');
let entries: string[];
try {
	entries = readdirSync(assetsDir);
} catch {
	console.error('Branding audit WARNING: cannot read static/assets/ directory.');
	process.exit(1);
}

for (const pattern of BANNED) {
	const matching = entries.filter((f) => f.includes(pattern));
	if (matching.length > 0) {
		console.error(`Branding audit FAILED — old asset files still present matching "${pattern}":`);
		for (const f of matching) {
			console.error(`  - static/assets/${f}`);
		}
		failed = true;
	}
}

if (failed) {
	console.error('Branding audit failed.');
	process.exit(1);
}

console.log('Branding audit passed.');
