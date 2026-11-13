// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * check-signature.ts - the depth signature gate (night-signature-1;
 * silent upgrade in night-signature-advanced-2).
 *
 * The canonical attribution string lives only as an XOR-masked
 * payload in src/lib/utils/signature.ts. This gate never spells the
 * plain wording: it imports the module, decodes in memory, and pins
 * the decode against the SHA-256 digest below (preimage-resistant -
 * the digest reveals nothing about the value). Every recorded surface
 * must carry the masked form or the module import; fail closed
 * otherwise. Removing or rebranding the signature means editing this
 * file too - a visible diff in the repository history.
 *
 * Fail-closed contract: the digest pin and every recorded surface
 * must probe green or the tree is not committable. A surface is
 * removed only by removing its probe here in the same change.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { BMI_STELLAR_SIGNATURE, BMI_STELLAR_SIGNATURE_ENC } from '../../src/lib/utils/signature';

// SHA-256 of the canonical signature, recorded once here. This is the
// single identity pin: if the payload or the decoder drifts, the
// decode stops matching and the tree is not committable.
const EXPECTED_DIGEST = 'ee83e27fc1f29d29e0da81fd3808394949141aefff47a29b8529f1add9a44941';

const digest = createHash('sha256').update(BMI_STELLAR_SIGNATURE, 'utf8').digest('hex');
if (digest !== EXPECTED_DIGEST) {
	console.error('[FAIL] depth signature decode does not match the recorded digest');
	console.error(`       recorded: ${EXPECTED_DIGEST}`);
	console.error(`       decoded : ${digest}`);
	console.error(
		'The masked payload in src/lib/utils/signature.ts was altered or its decoder is broken.'
	);
	process.exit(1);
}
console.log('[OK]   decode digest pinned (sha-256)');

// Shape check without spelling the value anywhere in this file.
if (!/^[A-Za-z_]+ \([A-Za-z]+\) \d{4}$/.test(BMI_STELLAR_SIGNATURE)) {
	console.error(
		'[FAIL] decoded signature does not match the recorded shape (builder (handle) year)'
	);
	process.exit(1);
}
console.log('[OK]   decoded shape (builder (handle) year)');

// The app.html author-meta needle, derived at runtime from the decode:
// numeric character references render plain in every browser while the
// source tree stays value-blind.
const entity = [...BMI_STELLAR_SIGNATURE].map((ch) => `&#${ch.codePointAt(0) ?? 0};`).join('');

type Surface = {
	label: string;
	path: string;
	probe: (contents: string) => boolean;
};

const surfaces: Surface[] = [
	{
		label: 'masked payload (src/lib/utils/signature.ts)',
		path: 'src/lib/utils/signature.ts',
		probe: (c) => c.includes(BMI_STELLAR_SIGNATURE_ENC)
	},
	{
		label: 'About UI row (src/lib/components/sections/AboutSection.svelte)',
		path: 'src/lib/components/sections/AboutSection.svelte',
		probe: (c) => c.includes("from '$lib/utils/signature'") && c.includes('BMI_STELLAR_SIGNATURE')
	},
	{
		label: 'author meta (src/app.html)',
		path: 'src/app.html',
		// Whitespace-normalized probe: prettier wraps the long meta tag
		// across lines; the needle must survive any formatting.
		probe: (c) => c.replace(/\s+/g, ' ').includes(`<meta name="author" content="${entity}" />`)
	},
	{
		label: 'PWA manifest (static/manifest.json)',
		path: 'static/manifest.json',
		probe: (c) => {
			const manifest = JSON.parse(c) as { signature?: string };
			return manifest.signature === BMI_STELLAR_SIGNATURE_ENC;
		}
	},
	{
		label: 'package manifest (package.json)',
		path: 'package.json',
		probe: (c) => {
			const pkg = JSON.parse(c) as { signature?: string };
			return pkg.signature === BMI_STELLAR_SIGNATURE_ENC;
		}
	},
	{
		label: '-V/--version banner (scripts/build.sh)',
		path: 'scripts/build.sh',
		probe: (c) => c.includes(BMI_STELLAR_SIGNATURE_ENC) && c.includes('sig_decode')
	},
	{
		label: 'offline shell footer (src/service-worker.ts)',
		path: 'src/service-worker.ts',
		probe: (c) => c.includes("from '$lib/utils/signature'") && c.includes('BMI_STELLAR_SIGNATURE')
	}
];

const violations: string[] = [];

for (const surface of surfaces) {
	const contents = await readFile(surface.path, 'utf8').catch(() => null);
	if (contents !== null && surface.probe(contents)) {
		console.log(`[OK]   ${surface.label}`);
	} else {
		violations.push(surface.label);
		console.error(`[FAIL] ${surface.label} - the masked depth signature is missing`);
	}
}

if (violations.length > 0) {
	console.error(
		`FAIL: masked depth signature missing on ${violations.length}/${surfaces.length} recorded surface(s). ` +
			'Restore the payload from src/lib/utils/signature.ts ' +
			'or remove the surface and its probe in the same change.'
	);
	process.exit(1);
}
console.log(
	`OK: masked depth signature present at every recorded surface (${surfaces.length}/${surfaces.length}), decode digest pinned.`
);
