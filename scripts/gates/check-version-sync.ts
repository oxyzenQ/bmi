// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * check-version-sync.ts - the version-surface parity gate (night-improve-3).
 *
 * package.json is the single version source of truth. Every display
 * surface must carry the same version or the tree is not committable:
 *   - DORMANT.md  "Version: `X.Y.Z`"  (the maintenance capsule, full version)
 *   - README.md   "Current release: `vX.Y.Z`"  (full version)
 *
 * A pre-release version (X.Y.Z-<suffix>, e.g. 80.0.0-night.1) is
 * legal on every surface - the suffix rides the same parity checks.
 *
 * Surfaces are probed honestly, the zelynic way: a surface that exists
 * but disagrees FAILS; a surface that does not exist at all is reported
 * as absent (a doc this gate never policed is not one it fails on).
 */

import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version?: string };
const version = pkg.version ?? '';

const violations: string[] = [];

if (!/^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/.test(version)) {
	violations.push(`package.json version "${version}" is not MAJOR.MINOR.PATCH[-LABEL]`);
}

let dormant: string;
try {
	dormant = await readFile('DORMANT.md', 'utf8');
} catch {
	dormant = '';
}
const dormantMatch = dormant.match(/Version: `(\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?)`/);
if (!dormantMatch) {
	violations.push('DORMANT.md: no "Version: `X.Y.Z`" capsule line found');
} else if (dormantMatch[1] !== version) {
	violations.push(`DORMANT.md capsule version ${dormantMatch[1]} != package.json ${version}`);
}

let readme: string;
try {
	readme = await readFile('README.md', 'utf8');
} catch {
	readme = '';
}
const releaseMatch = readme.match(/Current release: `v(\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.]+)?)`/);
if (!releaseMatch) {
	console.log('note: README.md carries no "Current release" surface - nothing to police there');
} else if (releaseMatch[1] !== version) {
	violations.push(`README.md current-release line v${releaseMatch[1]} != package.json ${version}`);
}

if (violations.length > 0) {
	console.error('Version sync failed:');
	for (const violation of violations) console.error(`- ${violation}`);
	process.exit(1);
}

console.log(
	`Version sync passed: package.json ${version} matches DORMANT.md${
		releaseMatch ? ` and the README v${version} surface` : ''
	}.`
);
