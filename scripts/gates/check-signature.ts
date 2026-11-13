// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * check-signature.ts - the depth signature gate (night-signature-1).
 *
 * The canonical attribution string (src/lib/utils/signature.ts) is
 * embedded at every recorded depth of the project. This gate fails
 * closed if any recorded surface loses it, so the signature cannot
 * silently rot or be stripped - removing it means editing this file
 * too, which is a visible diff in the repository history.
 *
 * Fail-closed contract: every recorded surface must probe green or
 * the tree is not committable. A surface is removed only by removing
 * its probe here in the same change.
 */

import { readFile } from 'node:fs/promises';

const SIGNATURE = 'rezky_nightky (oxyzenQ) 2026';

type Surface = {
	label: string;
	path: string;
	probe: (contents: string) => boolean;
};

const surfaces: Surface[] = [
	{
		label: 'canonical constant (src/lib/utils/signature.ts)',
		path: 'src/lib/utils/signature.ts',
		probe: (c) => c.includes(SIGNATURE)
	},
	{
		label: 'About UI row (src/lib/components/sections/AboutSection.svelte)',
		path: 'src/lib/components/sections/AboutSection.svelte',
		probe: (c) => c.includes('BMI_STELLAR_SIGNATURE')
	},
	{
		label: 'author meta (src/app.html)',
		path: 'src/app.html',
		probe: (c) => c.includes(`<meta name="author" content="${SIGNATURE}" />`)
	},
	{
		label: 'PWA manifest (static/manifest.json)',
		path: 'static/manifest.json',
		probe: (c) => {
			const manifest = JSON.parse(c) as { signature?: string };
			return manifest.signature === SIGNATURE;
		}
	},
	{
		label: 'package manifest (package.json)',
		path: 'package.json',
		probe: (c) => {
			const pkg = JSON.parse(c) as { signature?: string };
			return pkg.signature === SIGNATURE;
		}
	},
	{
		label: '-V/--version banner (scripts/build.sh)',
		path: 'scripts/build.sh',
		probe: (c) => c.includes(SIGNATURE)
	},
	{
		label: 'offline shell footer (src/service-worker.ts)',
		path: 'src/service-worker.ts',
		probe: (c) => c.includes(SIGNATURE)
	}
];

const violations: string[] = [];

for (const surface of surfaces) {
	const contents = await readFile(surface.path, 'utf8').catch(() => null);
	if (contents !== null && surface.probe(contents)) {
		console.log(`[OK]   ${surface.label}`);
	} else {
		violations.push(surface.label);
		console.error(`[FAIL] ${surface.label} - the depth signature is missing`);
	}
}

if (violations.length > 0) {
	console.error(
		`FAIL: depth signature missing on ${violations.length}/${surfaces.length} recorded surface(s). ` +
			'Restore the canonical string from src/lib/utils/signature.ts ' +
			'or remove the surface and its probe in the same change.'
	);
	process.exit(1);
}
console.log(
	`OK: depth signature present at every recorded surface (${surfaces.length}/${surfaces.length}).`
);
