// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
	AUTHORS_BYTE_LEN,
	AUTHORS_FINGERPRINT,
	AUTHORS_SEED,
	BMI_STELLAR_SIGNATURE,
	BMI_STELLAR_SIGNATURE_BUILDER,
	BMI_STELLAR_SIGNATURE_YEAR,
	MANIFEST_BYTE_LEN,
	MANIFEST_FINGERPRINT,
	MANIFEST_SEED,
	MASKED_AUTHORS_FIELD,
	MASKED_AUTHORS_WORDS,
	MASKED_MANIFEST_WORDS,
	blake3Hex,
	identityCore,
	provenanceView,
	unmaskLayer
} from '../signature';
import pkg from '../../../../package.json';

// Test oracles: the exact plaintext truths the masked words must
// materialize. These literals live ONLY in the test build - they are
// the one legitimate plaintext carrier in the module, because a test
// that cannot name its expected output proves nothing. Test files are
// never bundled into the app artifact (cosmostrix law).
const MANIFEST_ORACLE = 'BMI Stellar — Official Build by rezky_nightky (oxyzenQ) 2026';
const AUTHORS_ORACLE = 'rezky_nightky (oxyzenQ) 2026';

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
		expect(depthLine).toContain('layers=d0:masked-words,d1:masked-words,d2:dual-fingerprint');
		const fp = depthLine.split(' status=')[0]?.slice('Depth-matrix: fp='.length) ?? '';
		expect(fp).toHaveLength(16);
		expect(fp).toMatch(/^[0-9a-f]+$/);
	});

	it('keeps the public signature contract derived from the materialized authors', () => {
		expect(BMI_STELLAR_SIGNATURE).toBe(AUTHORS_ORACLE);
		expect(BMI_STELLAR_SIGNATURE_BUILDER).toBe('rezky_nightky (oxyzenQ)');
		expect(BMI_STELLAR_SIGNATURE_YEAR).toBe('2026');
		// The plain package author field doubles as an independent oracle.
		expect(pkg.author).toBe(BMI_STELLAR_SIGNATURE_BUILDER);
	});

	it('keeps the package signature field in masked parity', () => {
		expect((pkg as { signature?: string }).signature).toBe(MASKED_AUTHORS_FIELD);
		expect(MASKED_AUTHORS_FIELD).toMatch(/^[0-9a-f]{64}$/);
	});
});
