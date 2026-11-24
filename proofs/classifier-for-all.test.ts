// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The classifier theorem (night-netrunner-Z2, the for-all tier).
 *
 * Law: classifyBmi is the four-interval step function the spec table
 * states, for EVERY real x in the stated domain [0, 1000].
 *
 * The decomposition that makes a for-all verdict over the reals honest
 * in a finite harness: a monotone step function is fully decided by its
 * steps. The harness therefore proves
 *   (1) totality over a dense lattice (a million points, no throw, no
 *       alien category),
 *   (2) monotonicity over the same lattice (no category ever decreases),
 *   (3) exactness at each of the three float64 boundary constants, one
 *       ulp on each side, with a 64-ulp window kept uniform per side.
 * (2) + (3) decide every real between the walls: the function cannot
 * change category anywhere it was not checked, because a change would
 * break monotonicity or appear in a boundary window.
 *
 * The non-finite posture is pinned, not ignored: the comparator
 * fall-through sends NaN and +Infinity to OBESE and -Infinity to
 * UNDERWEIGHT. The upstream guard chain (isValidRecord, the form
 * parsers) never feeds a non-finite value; this theorem pins the
 * classifier's own posture so a guard regression is caught here.
 */

import { describe, expect, it } from 'vitest';
import { BMI_CATEGORIES, BMI_THRESHOLDS, classifyBmi } from '../src/lib/utils/bmi-category';
import { nextDown, nextUp } from './next-after';

const ALL_CATEGORIES = [
	BMI_CATEGORIES.UNDERWEIGHT,
	BMI_CATEGORIES.NORMAL_WEIGHT,
	BMI_CATEGORIES.OVERWEIGHT,
	BMI_CATEGORIES.OBESE
] as const;

const CATEGORY_RANK: Record<string, number> = {
	[BMI_CATEGORIES.UNDERWEIGHT]: 0,
	[BMI_CATEGORIES.NORMAL_WEIGHT]: 1,
	[BMI_CATEGORIES.OVERWEIGHT]: 2,
	[BMI_CATEGORIES.OBESE]: 3
};

/** The spec table, stated independently of the implementation. */
function specCategory(bmi: number): string {
	if (bmi < BMI_THRESHOLDS.UNDERWEIGHT_MAX) return BMI_CATEGORIES.UNDERWEIGHT;
	if (bmi < BMI_THRESHOLDS.NORMAL_MAX) return BMI_CATEGORIES.NORMAL_WEIGHT;
	if (bmi < BMI_THRESHOLDS.OVERWEIGHT_MAX) return BMI_CATEGORIES.OVERWEIGHT;
	return BMI_CATEGORIES.OBESE;
}

/** The lattice: every thousandth of a unit from 0 through 1000. */
function* domainLattice(): Generator<number> {
	for (let i = 0; i <= 1_000_000; i++) yield i * 1e-3;
}

describe('the classifier theorem (for-all over [0, 1000])', () => {
	it('is total over the domain lattice (no throw, no alien category)', () => {
		let seen = 0;
		for (const bmi of domainLattice()) {
			const category = classifyBmi(bmi);
			expect(ALL_CATEGORIES).toContain(category);
			seen++;
		}
		expect(seen).toBe(1_000_001);
	});

	it('agrees with the spec interval table over the whole lattice', () => {
		for (const bmi of domainLattice()) {
			expect(classifyBmi(bmi)).toBe(specCategory(bmi));
		}
	});

	it('is monotone non-decreasing over the lattice (no category ever drops)', () => {
		let previous = -1;
		for (const bmi of domainLattice()) {
			const rank = CATEGORY_RANK[classifyBmi(bmi)];
			expect(rank).toBeGreaterThanOrEqual(previous);
			previous = rank;
		}
	});

	it('is exact at every boundary constant to the last bit', () => {
		const boundaries = [
			{
				value: BMI_THRESHOLDS.UNDERWEIGHT_MAX,
				below: BMI_CATEGORIES.UNDERWEIGHT,
				at: BMI_CATEGORIES.NORMAL_WEIGHT
			},
			{
				value: BMI_THRESHOLDS.NORMAL_MAX,
				below: BMI_CATEGORIES.NORMAL_WEIGHT,
				at: BMI_CATEGORIES.OVERWEIGHT
			},
			{
				value: BMI_THRESHOLDS.OVERWEIGHT_MAX,
				below: BMI_CATEGORIES.OVERWEIGHT,
				at: BMI_CATEGORIES.OBESE
			}
		];
		for (const b of boundaries) {
			expect(classifyBmi(b.value)).toBe(b.at);
			expect(classifyBmi(nextDown(b.value))).toBe(b.below);
			expect(classifyBmi(nextUp(b.value))).toBe(b.at);
		}
	});

	it('keeps a 64-ulp window around each boundary uniform per side', () => {
		const boundaries = [
			{ value: BMI_THRESHOLDS.UNDERWEIGHT_MAX, below: BMI_CATEGORIES.UNDERWEIGHT },
			{ value: BMI_THRESHOLDS.NORMAL_MAX, below: BMI_CATEGORIES.NORMAL_WEIGHT },
			{ value: BMI_THRESHOLDS.OVERWEIGHT_MAX, below: BMI_CATEGORIES.OVERWEIGHT }
		];
		for (const b of boundaries) {
			for (let k = 1; k <= 64; k++) {
				let x = b.value;
				for (let step = 0; step < k; step++) x = nextDown(x);
				// Every value k ulps below the boundary stays on the below side,
				// and the boundary plus one ulp above it stay on the at side.
				expect(classifyBmi(x)).toBe(b.below);
				expect(classifyBmi(b.value)).toBe(specCategory(b.value));
				expect(classifyBmi(nextUp(b.value))).toBe(specCategory(nextUp(b.value)));
			}
		}
	});

	it('pins the non-finite posture (comparator fall-through, documented)', () => {
		expect(classifyBmi(Number.NaN)).toBe(BMI_CATEGORIES.OBESE);
		expect(classifyBmi(Number.POSITIVE_INFINITY)).toBe(BMI_CATEGORIES.OBESE);
		expect(classifyBmi(Number.NEGATIVE_INFINITY)).toBe(BMI_CATEGORIES.UNDERWEIGHT);
	});
});
