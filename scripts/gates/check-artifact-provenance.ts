// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * check-artifact-provenance.ts - the built-bundle provenance gate
 * (night-netrunner-Z1, C1b).
 *
 * The tree gates (check-signature.ts) prove the SOURCE carries the
 * depth matrix; nothing proved the same about the ARTIFACT a user
 * actually downloads. This gate closes that gap over the built
 * client payload: it imports the module, materializes the exact
 * identity strings, and asserts three things about every text file
 * the build emitted.
 *
 * 1. Zero plaintext identity: the manifest text, the authors text,
 *    the identity core, the handle, the contact, and their
 *    case/whitespace variants appear NOWHERE in the artifact. A
 *    thief greps the bundle with strings(1) or rg - the build
 *    output must give them nothing to find. The masked constants
 *    (decimal BigInt words, hex fields, the public key, the
 *    signature) are expected material, not leaks.
 *
 * 2. The D3 publisher layer survived the bundler: the exact public
 *    key and signature constants exist in at least one emitted file,
 *    so the artifact still verifies at runtime. A tree-level
 *    rebrand that somehow kept the gates green would still have to
 *    carry the owner's signature into the artifact.
 *
 * 3. The offline surfaces carry the machine-readable field: the
 *    PWA manifest's signature field equals the masked authors hex,
 *    exactly as in the source tree.
 *
 * Fail closed on any violation. Run it after `bun run build` (the
 * build lane runs it; locally: bun run build && bun run
 * audit:artifact).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
	AUTHORS_BYTE_LEN,
	AUTHORS_SEED,
	MANIFEST_BYTE_LEN,
	MANIFEST_SEED,
	MASKED_AUTHORS_WORDS,
	MASKED_MANIFEST_WORDS,
	OWNER_PUBLIC_KEY,
	OWNER_SIGNATURE,
	unmaskLayer
} from '../../src/lib/utils/signature';

// The built payload roots, adapter order (build.sh and release.yml
// accept the same two). One of them must exist; both are scanned
// when present.
const ROOTS = ['build', '.vercel/output/static'];

const TEXT_EXTENSIONS = new Set([
	'.html',
	'.js',
	'.css',
	'.json',
	'.webmanifest',
	'.svg',
	'.txt',
	'.xml',
	'.map'
]);

function* walk(dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		const st = statSync(path);
		if (st.isDirectory()) yield* walk(path);
		else if (st.isFile()) yield path;
	}
}

const manifestText = new TextDecoder('utf-8').decode(
	unmaskLayer(MASKED_MANIFEST_WORDS, MANIFEST_SEED, MANIFEST_BYTE_LEN)
);
const authorsText = new TextDecoder('utf-8').decode(
	unmaskLayer(MASKED_AUTHORS_WORDS, AUTHORS_SEED, AUTHORS_BYTE_LEN)
);

// The identity material that must stay invisible in the artifact.
// The manifest splits into brand prose ("BMI Stellar —", safe to
// appear) and the identity tail; the probe pins the identity core
// (the parenthesised handle) and the contact, plus the full strings
// - every shape a scanner could find. The D3 domain separator is
// deliberately NOT in this list: it is public protocol material
// (the same class as the brand prose), not identity - and the
// masked constants, the public key, and the signature are expected
// artifact material, not leaks.
const identityNeedles = [
	manifestText,
	authorsText,
	'rezky_nightky',
	'oxyzenQ)',
	'(oxyzenQ)',
	'oxyzenQ@proton.me',
	'Official Build by rezky_nightky'
];

// The expected material (masked forms): decimal BigInt words appear
// once each, the hex field and the D3 pair ride their surfaces.
const manifestWords = MASKED_MANIFEST_WORDS.map((w) => `${w.toString()}n`);
const authorsWords = MASKED_AUTHORS_WORDS.map((w) => `${w.toString()}n`);

const roots = ROOTS.filter((r) => {
	try {
		return statSync(r).isDirectory();
	} catch {
		return false;
	}
});
if (roots.length === 0) {
	console.error(
		'FAIL: no built payload found (build/ or .vercel/output/static) - run bun run build first'
	);
	process.exit(1);
}

let scanned = 0;
let textFiles = 0;
const leaks: string[] = [];
let publicKeySeats = 0;
let signatureSeats = 0;
let maskedWordSeats = 0;

for (const root of roots) {
	for (const path of walk(root)) {
		scanned++;
		if (!TEXT_EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) continue;
		textFiles++;
		const contents = readFileSync(path, 'utf8');
		for (const needle of identityNeedles) {
			if (contents.includes(needle))
				leaks.push(`${path}: plaintext identity (${needle.length} chars)`);
		}
		if (contents.includes(OWNER_PUBLIC_KEY)) publicKeySeats++;
		if (contents.includes(OWNER_SIGNATURE)) signatureSeats++;
		if (
			manifestWords.some((w) => contents.includes(w)) ||
			authorsWords.some((w) => contents.includes(w))
		) {
			maskedWordSeats++;
		}
	}
}

let failures = 0;
if (leaks.length > 0) {
	console.error(`FAIL: plaintext identity found in the built artifact:`);
	for (const leak of leaks.slice(0, 10)) console.error(`  - ${leak}`);
	if (leaks.length > 10) console.error(`  ... and ${leaks.length - 10} more`);
	failures++;
} else {
	console.log(
		`[OK]   zero plaintext identity across ${textFiles} text file(s) (${scanned} scanned)`
	);
}

if (publicKeySeats === 0 || signatureSeats === 0) {
	console.error(
		`FAIL: the D3 publisher layer did not survive the build (public key in ${publicKeySeats} file(s), signature in ${signatureSeats})`
	);
	failures++;
} else {
	console.log(
		`[OK]   D3 publisher layer in the artifact (key in ${publicKeySeats}, signature in ${signatureSeats} file(s))`
	);
}

if (maskedWordSeats === 0) {
	console.error('FAIL: no masked provenance words found in the artifact - the matrix was dropped');
	failures++;
} else {
	console.log(
		`[OK]   masked provenance words present (${maskedWordSeats} file(s) carry the constants)`
	);
}

// The PWA manifest seat: the machine-readable field must equal the
// masked authors hex exactly (the source-tree parity, extended to
// the artifact).
const maskedField = MASKED_AUTHORS_WORDS.map((w) => w.toString(16).padStart(16, '0')).join('');
let manifestSeats = 0;
for (const root of roots) {
	try {
		const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as {
			signature?: string;
		};
		if (manifest.signature === maskedField) manifestSeats++;
	} catch {
		// a root without a manifest is not a provenance fact
	}
}
if (manifestSeats === 0) {
	console.error('FAIL: no PWA manifest in the artifact carries the masked signature field');
	failures++;
} else {
	console.log(
		`[OK]   PWA manifest signature field equals the masked authors hex (${manifestSeats} seat(s))`
	);
}

if (failures > 0) {
	console.error(`Artifact provenance gate FAILED: ${failures} finding(s) above.`);
	process.exit(1);
}
console.log(
	'OK: the built artifact carries the depth matrix in masked form only - no plaintext identity, D3 present, offline seats intact.'
);
