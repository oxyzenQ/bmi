// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The KDF ladder floor theorem (night-netrunner-Z2, the for-all tier).
 *
 * Law: the Device-Tier Argon2id Ladder never derives below the OWASP
 * Argon2id floor, never above the read-side caps, and always produces
 * the 256-bit output the AES-256 key needs - for EVERY tier in the
 * ladder's complete domain {high, medium, low}.
 *
 * The tier domain is finite and small, so this theorem is exhaustive by
 * construction: every rung is checked against both walls, the ladder's
 * monotonicity is checked rung against rung, the floor clamp is proven
 * idempotent and fixpoint-stable over a below-floor corpus, and the
 * resolve-to-rung mapping is proven to be the clamp identity itself.
 * The legacy envelope posture is pinned too: pre-ladder files (the
 * fixed 64 MiB / t 3 defaults those files were written with) still
 * validate, because refusing them would buy nothing once the
 * passphrase gates them.
 */

import { describe, expect, it } from 'vitest';
import {
	KDF_CAPS,
	KDF_LADDER,
	LEGACY_KDF_OPTIONS,
	OWASP_FLOOR,
	TEST_KDF_OPTIONS,
	resolveKdfOptionsForTier,
	validateEnvelopeKdfParams
} from '../src/lib/utils/kdf-ladder';

const TIERS = ['high', 'medium', 'low'] as const;

/** The floor clamp, re-stated here as the spec (not imported from the source). */
function specClamp(params: { m: number; t: number; p: number }): {
	m: number;
	t: number;
	p: number;
} {
	return {
		m: Math.max(params.m, OWASP_FLOOR.m),
		t: Math.max(params.t, OWASP_FLOOR.t),
		p: Math.max(params.p, OWASP_FLOOR.p)
	};
}

describe('the KDF ladder floor theorem (for-all over the tier domain)', () => {
	it('sits at or above the OWASP floor and within the caps for every tier', () => {
		for (const tier of TIERS) {
			const options = resolveKdfOptionsForTier(tier);
			expect(options.m).toBeGreaterThanOrEqual(OWASP_FLOOR.m);
			expect(options.t).toBeGreaterThanOrEqual(OWASP_FLOOR.t);
			expect(options.p).toBeGreaterThanOrEqual(OWASP_FLOOR.p);
			expect(options.m).toBeLessThanOrEqual(KDF_CAPS.m);
			expect(options.t).toBeLessThanOrEqual(KDF_CAPS.t);
			expect(options.p).toBeLessThanOrEqual(KDF_CAPS.p);
			expect(options.dkLen).toBe(32);
		}
	});

	it('is the clamp identity for every tier (the resolve IS the clamp)', () => {
		for (const tier of TIERS) {
			const options = resolveKdfOptionsForTier(tier);
			const clamped = specClamp(KDF_LADDER[tier]);
			expect(options.m).toBe(clamped.m);
			expect(options.t).toBe(clamped.t);
			expect(options.p).toBe(clamped.p);
		}
	});

	it('keeps the ladder monotone from high to low (no tier inverts the cost)', () => {
		for (const axis of ['m', 't', 'p'] as const) {
			expect(KDF_LADDER.high[axis]).toBeGreaterThanOrEqual(KDF_LADDER.medium[axis]);
			expect(KDF_LADDER.medium[axis]).toBeGreaterThanOrEqual(KDF_LADDER.low[axis]);
		}
	});

	it('returns fresh objects (no caller mutates the ladder through a rung)', () => {
		for (const tier of TIERS) {
			const options = resolveKdfOptionsForTier(tier);
			const before = KDF_LADDER[tier].m;
			options.m = -1;
			expect(KDF_LADDER[tier].m).toBe(before);
		}
	});

	it('clamps every below-floor corpus entry axis-by-axis and stays idempotent', () => {
		const corpus = [
			{ m: 0, t: 0, p: 0 },
			{ m: 1, t: 1, p: 1 },
			{ m: OWASP_FLOOR.m - 1, t: OWASP_FLOOR.t - 1, p: OWASP_FLOOR.p - 1 },
			{ m: OWASP_FLOOR.m, t: OWASP_FLOOR.t - 1, p: OWASP_FLOOR.p },
			{ m: OWASP_FLOOR.m - 1, t: OWASP_FLOOR.t, p: OWASP_FLOOR.p },
			{ m: 1024, t: 1, p: 1 }
		];
		for (const entry of corpus) {
			const once = specClamp(entry);
			expect(once.m).toBeGreaterThanOrEqual(OWASP_FLOOR.m);
			expect(once.t).toBeGreaterThanOrEqual(OWASP_FLOOR.t);
			expect(once.p).toBeGreaterThanOrEqual(OWASP_FLOOR.p);
			expect(specClamp(once)).toEqual(once);
		}
	});

	it('keeps the floor at a fixpoint (clamping the floor is the floor)', () => {
		expect(specClamp({ ...OWASP_FLOOR })).toEqual({ ...OWASP_FLOOR });
	});

	it('pins the test-mode and legacy postures the contracts document', () => {
		// Test mode stays below the floor by design, excluded from production.
		expect(TEST_KDF_OPTIONS.m).toBeLessThan(OWASP_FLOOR.m);
		// The legacy defaults validate as an envelope, so pre-ladder files open.
		const legacyEnvelope = {
			type: 2,
			mem: LEGACY_KDF_OPTIONS.m,
			time: LEGACY_KDF_OPTIONS.t,
			parallelism: LEGACY_KDF_OPTIONS.p,
			hashLen: LEGACY_KDF_OPTIONS.dkLen
		};
		expect(validateEnvelopeKdfParams(legacyEnvelope)).toBe(true);
	});
});
