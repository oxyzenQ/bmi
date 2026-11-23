// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

import { describe, expect, it } from 'vitest';
import {
	AUTHORS_BYTE_LEN,
	AUTHORS_FINGERPRINT,
	AUTHORS_SEED,
	BMI_STELLAR_SIGNATURE,
	BMI_STELLAR_SIGNATURE_BUILDER,
	BMI_STELLAR_SIGNATURE_CONTACT,
	D3_DOMAIN,
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
} from '../signature';
import pkg from '../../../../package.json';

// Test oracles: the exact plaintext truths the masked words must
// materialize. These literals live ONLY in the test build - they are
// the one legitimate plaintext carrier in the module, because a test
// that cannot name its expected output proves nothing. Test files are
// never bundled into the app artifact (cosmostrix law).
const MANIFEST_ORACLE = 'BMI Stellar — Official Build by rezky_nightky (oxyzenQ) 2026';
const AUTHORS_ORACLE = 'rezky_nightky (oxyzenQ) <oxyzenQ@proton.me>';

/** Hex decode for signature byte material (lowercase pairs). */
function hexBytes(hex: string): Uint8Array {
	return new Uint8Array((hex.match(/../g) ?? []).map((c) => Number.parseInt(c, 16)));
}

describe('the provenance depth matrix (night-signature-advanced-2)', () => {
	it('layers materialize to the oracles', () => {
		const view = provenanceView();
		expect(view.manifest).toBe(MANIFEST_ORACLE);
		expect(view.authors).toBe(AUTHORS_ORACLE);
	});

	it('masked words are strings-invisible (no printable run of 4+)', () => {
		for (const words of [MASKED_MANIFEST_WORDS, MASKED_AUTHORS_WORDS]) {
			let run = 0;
			for (const word of words) {
				for (let byteIndex = 0n; byteIndex < 8n; byteIndex++) {
					const byte = Number((word >> (byteIndex * 8n)) & 0xffn);
					if (byte >= 0x20 && byte <= 0x7e) {
						run += 1;
						expect(run).toBeLessThan(4);
					} else {
						run = 0;
					}
				}
			}
		}
	});

	it('runtime folds reproduce the embedded D2 digests (BLAKE3-256)', () => {
		expect(blake3Hex(unmaskLayer(MASKED_MANIFEST_WORDS, MANIFEST_SEED, MANIFEST_BYTE_LEN))).toBe(
			MANIFEST_FINGERPRINT
		);
		expect(blake3Hex(unmaskLayer(MASKED_AUTHORS_WORDS, AUTHORS_SEED, AUTHORS_BYTE_LEN))).toBe(
			AUTHORS_FINGERPRINT
		);
	});

	it('tampered words break the fingerprint', () => {
		// Post-compile patching simulation: flipping one bit in any
		// masked word must change the digest - the D2 layer binds the
		// data it claims to protect.
		const tampered: bigint[] = [...MASKED_AUTHORS_WORDS];
		tampered[2] = (tampered[2] ?? 0n) ^ 0x80n;
		expect(blake3Hex(unmaskLayer(tampered, AUTHORS_SEED, AUTHORS_BYTE_LEN))).not.toBe(
			AUTHORS_FINGERPRINT
		);
	});

	it('identity core extraction and binding', () => {
		const core = identityCore(MANIFEST_ORACLE);
		expect(core).toBe('rezky_nightky (oxyzenQ)');
		expect(AUTHORS_ORACLE.startsWith(core ?? '')).toBe(true);
		// A rebranded manifest (different identity) breaks the binding:
		// the authors string no longer starts with the extracted core.
		const forgedCore = identityCore('BMI Stellar — Official Build by someone_else 2026');
		expect(AUTHORS_ORACLE.startsWith(forgedCore ?? '')).toBe(false);
		// Missing marker or missing year are tampering signals.
		expect(identityCore('BMI Stellar')).toBeNull();
		expect(identityCore('Official Build by rezky_nightky')).toBeNull();
	});

	it('provenance view shape is stable', () => {
		const { depthLine, status } = provenanceView();
		expect(status).toBe('verified');
		expect(depthLine.startsWith('Depth-matrix: fp=')).toBe(true);
		expect(depthLine).toContain(' status=verified ');
		// d3 layer shape pinned in the D3 describe block below (single source).
		const fp = depthLine.split(' status=')[0]?.slice('Depth-matrix: fp='.length) ?? '';
		expect(fp).toHaveLength(16);
		expect(fp).toMatch(/^[0-9a-f]+$/);
	});

	it('keeps the public signature contract derived from the materialized authors', () => {
		expect(BMI_STELLAR_SIGNATURE).toBe(AUTHORS_ORACLE);
		expect(BMI_STELLAR_SIGNATURE_BUILDER).toBe('rezky_nightky (oxyzenQ)');
		expect(BMI_STELLAR_SIGNATURE_CONTACT).toBe('oxyzenQ@proton.me');
		// The plain package author field doubles as an independent oracle:
		// the Cargo authors shape (identity + contact) rides the manifest.
		expect(pkg.author).toBe(BMI_STELLAR_SIGNATURE);
	});

	it('keeps the package signature field in masked parity', () => {
		expect((pkg as { signature?: string }).signature).toBe(MASKED_AUTHORS_FIELD);
		expect(MASKED_AUTHORS_FIELD).toMatch(/^[0-9a-f]{96}$/);
	});
});

describe('the D3 publisher layer (night-netrunner-Z1)', () => {
	// RFC 8032 section 7.1 known-answer vectors: the shipped verifier
	// must agree with the standard before anything else is trusted.
	it('verifies the RFC 8032 test vectors', () => {
		const vector1 = {
			publicKey: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
			message: '',
			signature:
				'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b'
		};
		const vector2 = {
			publicKey: '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c',
			message: '72',
			signature:
				'92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00'
		};
		expect(
			ed25519Verify(
				hexBytes(vector1.publicKey),
				hexBytes(vector1.message),
				hexBytes(vector1.signature)
			)
		).toBe(true);
		expect(
			ed25519Verify(
				hexBytes(vector2.publicKey),
				hexBytes(vector2.message),
				hexBytes(vector2.signature)
			)
		).toBe(true);
		// A one-bit message change must flip the verdict.
		expect(
			ed25519Verify(
				hexBytes(vector2.publicKey),
				new Uint8Array([0x73]),
				hexBytes(vector2.signature)
			)
		).toBe(false);
	});

	it('D3 constants are shaped and the signature verifies over the framed truths', () => {
		expect(D3_DOMAIN).toBe('bmi-stellar/depth-matrix/v1');
		expect(OWNER_PUBLIC_KEY).toMatch(/^[0-9a-f]{64}$/);
		expect(OWNER_SIGNATURE).toMatch(/^[0-9a-f]{128}$/);
		const payload = signablePayload(
			unmaskLayer(MASKED_MANIFEST_WORDS, MANIFEST_SEED, MANIFEST_BYTE_LEN),
			unmaskLayer(MASKED_AUTHORS_WORDS, AUTHORS_SEED, AUTHORS_BYTE_LEN)
		);
		// The runtime layer's own leg of the three-fold verify.
		expect(ed25519Verify(hexBytes(OWNER_PUBLIC_KEY), payload, hexBytes(OWNER_SIGNATURE))).toBe(
			true
		);
	});

	it('a minted matrix (thief re-runs the generator) fails the publisher leg', () => {
		// The forgery scenario from the depth-matrix threat model: the
		// attacker cannot patch masked words usefully (D2 catches that),
		// so they regenerate BOTH layers coherently for their own
		// identity. Self-consistent D0-D2 - but the D3 signature was
		// made by the owner's offline key over the owner's truths, so
		// the reframed payload no longer verifies.
		const manifest = new TextEncoder().encode(
			'BMI Stellar — Official Build by mallory_thief (malloryQ) 2026'
		);
		const authors = new TextEncoder().encode('mallory_thief (malloryQ) <mallory@evil.example>');
		const minted = signablePayload(manifest, authors);
		expect(ed25519Verify(hexBytes(OWNER_PUBLIC_KEY), minted, hexBytes(OWNER_SIGNATURE))).toBe(
			false
		);
	});

	it('one flipped signature hex digit breaks the publisher layer', () => {
		const payload = signablePayload(
			unmaskLayer(MASKED_MANIFEST_WORDS, MANIFEST_SEED, MANIFEST_BYTE_LEN),
			unmaskLayer(MASKED_AUTHORS_WORDS, AUTHORS_SEED, AUTHORS_BYTE_LEN)
		);
		const tampered = OWNER_SIGNATURE.startsWith('9')
			? `8${OWNER_SIGNATURE.slice(1)}`
			: `9${OWNER_SIGNATURE.slice(1)}`;
		expect(ed25519Verify(hexBytes(OWNER_PUBLIC_KEY), payload, hexBytes(tampered))).toBe(false);
	});

	it('depthLine carries the d3 layer and the verified status', () => {
		const { depthLine, status } = provenanceView();
		expect(status).toBe('verified');
		expect(depthLine).toContain(' status=verified ');
		expect(depthLine).toContain(
			'layers=d0:masked-words,d1:masked-words,d2:dual-fingerprint,d3:ed25519-publisher'
		);
	});
});
