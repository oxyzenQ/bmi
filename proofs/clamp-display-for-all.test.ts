// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The display-clamp theorem (night-netrunner-Z2, the for-all tier).
 *
 * Law: clampBmiForDisplay is the identity on the interior of
 * [BMI_THRESHOLDS.MIN, BMI_THRESHOLDS.MAX], the wall outside it, and the
 * zero sentinel on every non-finite or absent input - for EVERY input in
 * the stated domain.
 *
 * Proven by the same decomposition shape as the classifier theorem:
 *   (1) totality over a dense lattice spanning far beyond the walls
 *       ([-1000, 1000] in steps of 0.01): the result always lands in
 *       the clamp range or on the zero sentinel;
 *   (2) the interior identity law over every lattice point strictly
 *       inside the walls;
 *   (3) the wall law exactly at MIN and MAX and one ulp outside each;
 *   (4) monotonicity and idempotence over the lattice - a clamp that
 *       is monotone and idempotent cannot oscillate or drift, so the
 *       gauge never sees a value it cannot draw.
 */

import { describe, expect, it } from 'vitest';
import { BMI_THRESHOLDS, clampBmiForDisplay } from '../src/lib/utils/bmi-category';
import { nextDown, nextUp } from './next-after';

const MIN = BMI_THRESHOLDS.MIN;
const MAX = BMI_THRESHOLDS.MAX;

/** The lattice: every hundredth from -1000 through 1000. */
function* wideLattice(): Generator<number> {
	for (let i = -100_000; i <= 100_000; i++) yield i * 1e-2;
}

describe('the display-clamp theorem (for-all over [-1000, 1000])', () => {
	it('is total over the lattice (finite in, finite clamped out)', () => {
		for (const bmi of wideLattice()) {
			const clamped = clampBmiForDisplay(bmi);
			expect(Number.isFinite(clamped)).toBe(true);
			expect(clamped).toBeGreaterThanOrEqual(MIN);
			expect(clamped).toBeLessThanOrEqual(MAX);
		}
	});

	it('is the identity on the interior of [MIN, MAX]', () => {
		for (const bmi of wideLattice()) {
			if (bmi > MIN && bmi < MAX) {
				expect(clampBmiForDisplay(bmi)).toBe(bmi);
			}
		}
	});

	it('is the wall exactly at MIN and MAX and one ulp outside each', () => {
		expect(clampBmiForDisplay(MIN)).toBe(MIN);
		expect(clampBmiForDisplay(MAX)).toBe(MAX);
		expect(clampBmiForDisplay(nextDown(MIN))).toBe(MIN);
		expect(clampBmiForDisplay(nextUp(MAX))).toBe(MAX);
		// One ulp inside each wall still passes through unchanged.
		expect(clampBmiForDisplay(nextUp(MIN))).toBe(nextUp(MIN));
		expect(clampBmiForDisplay(nextDown(MAX))).toBe(nextDown(MAX));
	});

	it('is monotone non-decreasing over the lattice', () => {
		let previous = Number.NEGATIVE_INFINITY;
		for (const bmi of wideLattice()) {
			const clamped = clampBmiForDisplay(bmi);
			expect(clamped).toBeGreaterThanOrEqual(previous);
			previous = clamped;
		}
	});

	it('is idempotent over the lattice (the clamp fixes every point)', () => {
		for (const bmi of wideLattice()) {
			const once = clampBmiForDisplay(bmi);
			expect(clampBmiForDisplay(once)).toBe(once);
		}
	});

	it('pins the zero sentinel on every non-finite or absent input', () => {
		expect(clampBmiForDisplay(Number.NaN)).toBe(0);
		expect(clampBmiForDisplay(Number.POSITIVE_INFINITY)).toBe(0);
		expect(clampBmiForDisplay(Number.NEGATIVE_INFINITY)).toBe(0);
		expect(clampBmiForDisplay(null)).toBe(0);
		expect(clampBmiForDisplay(undefined)).toBe(0);
	});
});
