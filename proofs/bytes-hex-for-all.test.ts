// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The hex-encoding theorem (night-netrunner-Z2, the for-all tier).
 *
 * Law: bytesToHex is the canonical lowercase zero-padded two-chars-per-
 * byte encoding, for EVERY byte value and EVERY length in the stated
 * domain. This is the encoding every digest, signature, and witness
 * chain link in the tree speaks - a single drifted byte would break the
 * chain, so the whole byte alphabet is verified, not sampled:
 *   (1) every single byte b in [0, 255] encodes to exactly the spec
 *       two-char lowercase string;
 *   (2) every pair (b1, b2) in [0, 255]^2 (all 65,536) encodes to the
 *       concatenation of the single-byte laws - the encoder is exactly
 *       length-2 chunked, with no separator drift;
 *   (3) the harness-side reference decoder (written independently of
 *       any decoder in the tree) round-trips every byte and every pair;
 *   (4) the length law holds for every length 0..64 under two fill
 *       patterns (deterministic stride and constant fill);
 *   (5) the alphabet law: every character of every pair output is drawn
 *       from [0-9a-f] (the lowercase wall - uppercase leaks nowhere).
 */

import { describe, expect, it } from 'vitest';
import { bytesToHex } from '../src/lib/utils/hex';

const HEX_DIGITS = '0123456789abcdef';

/** The harness-side reference encoder, built from the spec, not the source. */
function specByteHex(b: number): string {
	return HEX_DIGITS[b >>> 4] + HEX_DIGITS[b & 0x0f];
}

/** The harness-side reference decoder, the round-trip witness. */
function referenceDecode(hex: string): number[] {
	const out: number[] = [];
	for (let i = 0; i < hex.length; i += 2) {
		out.push(parseInt(hex.slice(i, i + 2), 16));
	}
	return out;
}

describe('the hex-encoding theorem (for-all over the byte alphabet)', () => {
	it('encodes every single byte exactly as the spec states', () => {
		for (let b = 0; b <= 255; b++) {
			expect(bytesToHex(Uint8Array.of(b))).toBe(specByteHex(b));
		}
	});

	it('encodes every byte pair as the exact concatenation of its chunk laws', () => {
		for (let b1 = 0; b1 <= 255; b1++) {
			for (let b2 = 0; b2 <= 255; b2++) {
				const out = bytesToHex(Uint8Array.of(b1, b2));
				expect(out).toBe(specByteHex(b1) + specByteHex(b2));
				expect(out.length).toBe(4);
			}
		}
	});

	it('round-trips every byte and every pair through the reference decoder', () => {
		for (let b = 0; b <= 255; b++) {
			expect(referenceDecode(bytesToHex(Uint8Array.of(b)))).toEqual([b]);
		}
		for (let b1 = 0; b1 <= 255; b1++) {
			for (let b2 = 0; b2 <= 255; b2++) {
				expect(referenceDecode(bytesToHex(Uint8Array.of(b1, b2)))).toEqual([b1, b2]);
			}
		}
	});

	it('holds the alphabet law on every character of every pair output', () => {
		for (let b1 = 0; b1 <= 255; b1++) {
			for (let b2 = 0; b2 <= 255; b2++) {
				for (const ch of bytesToHex(Uint8Array.of(b1, b2))) {
					expect(HEX_DIGITS.includes(ch)).toBe(true);
				}
			}
		}
	});

	it('holds the length law for every length 0..64 under two fill patterns', () => {
		for (let n = 0; n <= 64; n++) {
			const stride = new Uint8Array(n).map((_, i) => (i * 7 + 3) & 0xff);
			expect(bytesToHex(stride).length).toBe(2 * n);
			const constant = new Uint8Array(n).fill(0xab);
			expect(bytesToHex(constant).length).toBe(2 * n);
		}
		expect(bytesToHex(new Uint8Array(0))).toBe('');
	});
});
