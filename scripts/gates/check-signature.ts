// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * check-signature.ts - the provenance depth-matrix gate
 * (night-signature-1; silent upgrade in night-signature-advanced-2,
 * mirroring the cosmostrix scheme).
 *
 * The ownership claim lives only as XOR-masked 64-bit words in
 * src/lib/utils/signature.ts, with BLAKE3-256 digests over the clear
 * bytes as the D2 integrity layer. This gate never spells the plain
 * wording: it imports the module, verifies the runtime fold against
 * the digest pins recorded below (preimage-resistant - the digests
 * reveal nothing), recomputes the unmask+fold independently, checks
 * the identity binding, and probes every recorded surface for the
 * masked form or the module import. Fail closed otherwise. Removing
 * or rebranding the matrix means editing this file too - a visible
 * diff in the repository history.
 *
 * Fail-closed contract: the status verdict, the digest pins, the
 * mechanical strings-invisibility pin, and every recorded surface
 * must probe green or the tree is not committable. A surface is
 * removed only by removing its probe here in the same change.
 */

import { readFile } from 'node:fs/promises';
import {
	AUTHORS_BYTE_LEN,
	AUTHORS_FINGERPRINT,
	AUTHORS_SEED,
	BMI_STELLAR_SIGNATURE,
	MANIFEST_BYTE_LEN,
	MANIFEST_FINGERPRINT,
	MANIFEST_SEED,
	MASKED_AUTHORS_FIELD,
	MASKED_AUTHORS_WORDS,
	MASKED_MANIFEST_WORDS,
	OWNER_PUBLIC_KEY,
	OWNER_SIGNATURE,
	blake3Hex,
	ed25519Verify,
	identityCore,
	provenanceView,
	signablePayload,
	unmaskLayer
} from '../../src/lib/utils/signature';

// D2 digest pins recorded here by the generator run. The gate is the
// second truth anchor: regenerating the module constants coherently
// (words + digests together) still stops here, and editing these
// values is a visible, auditable diff.
const EXPECTED_MANIFEST_FINGERPRINT =
	'c1c1d1adda9e7bb0666b78a7fc8907e00ec8d147483b222b463bee21320d26b3';
const EXPECTED_AUTHORS_FINGERPRINT =
	'118a2237bace37140d951feb29342d86ccb83ef28e9d58e0ec259dcf08171516';

// D3 publisher key pin: the one place outside the module that names
// the owner's Ed25519 identity. A thief who swaps both the module
// constants and the module's key still stops here - replacing this
// pin means editing the gate, the loudest possible diff. The Python
// oracle (generate-provenance-words.py --check) pins the same value
// from its own side of the mirror.
const EXPECTED_OWNER_PUBLIC_KEY =
	'0aee05a0c96e92bd5bea6dff8b084849b098a597cf78820d7b160258d293345a';

function fail(message: string): never {
	console.error(`[FAIL] ${message}`);
	process.exit(1);
}

/** Hex decode, gate-local (no imports from the module beyond its exports). */
function hexToBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

// 1. The runtime verdict: materialize + two-fold verify (fingerprints
//    and identity binding) in one pass per layer.
const view = provenanceView();
if (view.status !== 'verified') {
	fail(`provenance depth matrix reports status=tampered (${view.depthLine})`);
}
console.log('[OK]   provenance materialized, status=verified (single-pass fold)');

// 2. The D2 digest pins: embedded digests must equal the recorded ones.
if (MANIFEST_FINGERPRINT !== EXPECTED_MANIFEST_FINGERPRINT) {
	fail('MANIFEST_FINGERPRINT drifted from the recorded pin');
}
if (AUTHORS_FINGERPRINT !== EXPECTED_AUTHORS_FINGERPRINT) {
	fail('AUTHORS_FINGERPRINT drifted from the recorded pin');
}
console.log('[OK]   D2 digests match the recorded pins (BLAKE3-256)');

// 3. Independent recompute: unmask + fold straight over the words,
//    bypassing provenanceView, and compare against the pins.
const recomputedManifest = blake3Hex(
	unmaskLayer(MASKED_MANIFEST_WORDS, MANIFEST_SEED, MANIFEST_BYTE_LEN)
);
const recomputedAuthors = blake3Hex(
	unmaskLayer(MASKED_AUTHORS_WORDS, AUTHORS_SEED, AUTHORS_BYTE_LEN)
);
if (recomputedManifest !== EXPECTED_MANIFEST_FINGERPRINT) {
	fail('independent manifest fold does not reproduce the recorded pin');
}
if (recomputedAuthors !== EXPECTED_AUTHORS_FINGERPRINT) {
	fail('independent authors fold does not reproduce the recorded pin');
}
console.log('[OK]   independent unmask+fold reproduces the pins');

// 4. Identity binding, checked directly.
const core = identityCore(view.manifest);
if (core === null || !BMI_STELLAR_SIGNATURE.startsWith(core)) {
	fail('identity binding broken: authors string does not start with the manifest core');
}
console.log('[OK]   identity binding holds (authors starts with the manifest core)');

// 5. The D3 publisher layer: the module's key equals the pin, and the
//    signature verifies over the independently recomputed payload
//    (unmask both layers straight from the words, frame them with the
//    domain, check). The gate never trusts the module's own verdict.
if (OWNER_PUBLIC_KEY !== EXPECTED_OWNER_PUBLIC_KEY) {
	fail(
		'OWNER_PUBLIC_KEY drifted from the recorded pin (publisher key rotation without a gate edit)'
	);
}
const payloadBytes = signablePayload(
	unmaskLayer(MASKED_MANIFEST_WORDS, MANIFEST_SEED, MANIFEST_BYTE_LEN),
	unmaskLayer(MASKED_AUTHORS_WORDS, AUTHORS_SEED, AUTHORS_BYTE_LEN)
);
if (OWNER_SIGNATURE === '') {
	fail(
		'OWNER_SIGNATURE is empty - sign the current truths (generate-provenance-words.py --signing-key) and paste the block'
	);
}
if (
	!ed25519Verify(hexToBytes(EXPECTED_OWNER_PUBLIC_KEY), payloadBytes, hexToBytes(OWNER_SIGNATURE))
) {
	fail('the D3 signature does not verify under the pinned key (RFC 8032, recomputed payload)');
}
console.log('[OK]   D3 publisher signature verifies under the pinned Ed25519 key');

// 5. Machine field parity: the masked authors words concatenate to the
//    field recorded in both manifests.
const field = MASKED_AUTHORS_WORDS.map((word) => word.toString(16).padStart(16, '0')).join('');
if (field !== MASKED_AUTHORS_FIELD) {
	fail('MASKED_AUTHORS_FIELD does not match the masked authors words');
}
console.log('[OK]   machine field parity (masked authors hex)');

// 6. The strings-invisibility contract, pinned mechanically: no
//    printable ASCII run of four or more bytes survives in any masked
//    word, so strings(1)/rg scans find nothing.
function longestAsciiRun(words: readonly bigint[]): number {
	let longest = 0;
	let run = 0;
	for (const word of words) {
		for (let b = 0n; b < 8n; b++) {
			const byte = Number((word >> (b * 8n)) & 0xffn);
			if (byte >= 0x20 && byte <= 0x7e) {
				run += 1;
				longest = Math.max(longest, run);
			} else {
				run = 0;
			}
		}
	}
	return longest;
}
const manifestRun = longestAsciiRun(MASKED_MANIFEST_WORDS);
const authorsRun = longestAsciiRun(MASKED_AUTHORS_WORDS);
if (manifestRun >= 4 || authorsRun >= 4) {
	fail(`masked words leak ASCII (runs ${manifestRun}/${authorsRun})`);
}
console.log(
	`[OK]   strings-invisible (longest printable run ${manifestRun}/${authorsRun}, floor 4)`
);

// 7. The generator truth source is present and carries the same law.
const generator = await readFile('scripts/release/generate-provenance-words.py', 'utf8').catch(
	() => null
);
if (
	generator === null ||
	!generator.includes('splitmix64_mix') ||
	!generator.includes('SEED_MANIFEST')
) {
	fail('scripts/release/generate-provenance-words.py is missing or does not carry the masking law');
}
console.log('[OK]   generator truth source present (splitmix64 mask law)');

// The app.html author-meta needle, derived at runtime from the
// materialized authors: numeric character references render plain in
// every browser while the source tree stays value-blind.
const entity = [...view.authors].map((ch) => `&#${ch.codePointAt(0) ?? 0};`).join('');

type Surface = {
	label: string;
	path: string;
	probe: (contents: string) => boolean;
};

const surfaces: Surface[] = [
	{
		label: 'masked words + D2 digests (src/lib/utils/signature.ts)',
		path: 'src/lib/utils/signature.ts',
		probe: (c) =>
			c.includes('MASKED_MANIFEST_WORDS') &&
			c.includes('MASKED_AUTHORS_WORDS') &&
			c.includes(MANIFEST_FINGERPRINT) &&
			c.includes(AUTHORS_FINGERPRINT)
	},
	{
		label: 'About rows (src/lib/components/sections/AboutSection.svelte)',
		path: 'src/lib/components/sections/AboutSection.svelte',
		probe: (c) =>
			c.includes("from '$lib/utils/signature'") &&
			c.includes('BMI_STELLAR_SIGNATURE') &&
			c.includes('provenanceView') &&
			c.includes('depthLine')
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
			return manifest.signature === MASKED_AUTHORS_FIELD;
		}
	},
	{
		label: 'package manifest (package.json)',
		path: 'package.json',
		probe: (c) => {
			const pkg = JSON.parse(c) as { signature?: string };
			return pkg.signature === MASKED_AUTHORS_FIELD;
		}
	},
	{
		label: '-V/--version banner (scripts/build.sh)',
		path: 'scripts/build.sh',
		probe: (c) => c.includes('provenanceView') && c.includes('sig_report')
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
			'Restore the constants from src/lib/utils/signature.ts ' +
			'or remove the surface and its probe in the same change.'
	);
	process.exit(1);
}
console.log(
	`OK: provenance depth matrix verified (status=verified, BLAKE3-pinned, Ed25519-published, strings-invisible) and present at every recorded surface (${surfaces.length}/${surfaces.length}).`
);
