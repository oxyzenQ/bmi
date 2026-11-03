// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Paranoid Masterclass audit — scientific precision suite.
//
// Proves, at the pure-function level:
//   1. Unit conversion constants are the EXACT published values
//      (2.54 cm/in by definition; 0.45359237 kg/lb per the 1959
//      international avoirdupois pound agreement) — no drift.
//   2. BMI stays finite, deterministic, and correctly rounded for
//      extreme-but-valid human inputs at every boundary of INPUT_LIMITS.
//   3. Mifflin-St Jeor BMR and the five published activity factors
//      produce the exact scientific values, including the male +5 /
//      female −161 offsets and the age-1..120 span the form accepts.

import { describe, it, expect } from 'vitest';
import {
	ACTIVITY_FACTORS,
	calculateBmi,
	computeBmi,
	computeBmrMifflinStJeor,
	computeTdee,
	isBmiResult,
	toMetric,
	validateInputs,
	IN_TO_CM,
	LB_TO_KG,
	KG_TO_LBS,
	INPUT_LIMITS,
	type BmiResult
} from '../bmi-calculator';

// ── 1. Exact conversion constants ──

describe('conversion constants are exact (no drift)', () => {
	it('IN_TO_CM is exactly 2.54 (inch definition)', () => {
		expect(IN_TO_CM).toBe(2.54);
	});

	it('LB_TO_KG is exactly 0.45359237 (1959 international pound)', () => {
		expect(LB_TO_KG).toBe(0.45359237);
	});

	it('KG_TO_LBS is the exact reciprocal of LB_TO_KG', () => {
		expect(KG_TO_LBS).toBe(1 / 0.45359237);
	});

	it('imperial conversion error stays below 1e-12 relative for human-range inputs', () => {
		// 250 lb must convert with no drift beyond double rounding
		const exact = 250 * 0.45359237;
		const converted = toMetric(0, 250, 'imperial').weightKg;
		expect(Math.abs(converted - exact) / exact).toBeLessThan(1e-12);

		// 78 in must convert with no drift beyond double rounding
		const exactCm = 78 * 2.54;
		const convertedCm = toMetric(78, 0, 'imperial').heightCm;
		expect(Math.abs(convertedCm - exactCm) / exactCm).toBeLessThan(1e-12);
	});

	it('imperial maxima stay inside the metric validation ceiling', () => {
		// 120 in = 304.8 cm ≤ 310 cm, 1500 lb = 680.39 kg ≤ 1000 kg
		const h = toMetric(INPUT_LIMITS.HEIGHT_MAX_IN, 0, 'imperial').heightCm;
		const w = toMetric(0, INPUT_LIMITS.WEIGHT_MAX_LBS, 'imperial').weightKg;
		expect(h).toBeLessThanOrEqual(INPUT_LIMITS.HEIGHT_MAX_CM);
		expect(w).toBeLessThanOrEqual(INPUT_LIMITS.WEIGHT_MAX_KG);
		expect(validateInputs(h, w)).toBeNull();
	});
});

// ── 2. Extreme-but-valid BMI inputs ──

describe('BMI at extreme-but-valid inputs', () => {
	it('height 50 cm, weight 10 kg → BMI 40.00 (Obese)', () => {
		expect(computeBmi(50, 10)).toBe(40);
		const r = calculateBmi('50', '10', 'metric');
		expect(isBmiResult(r)).toBe(true);
		expect((r as BmiResult).category).toBe('Obese');
	});

	it('height 250 cm, weight 300 kg → BMI 48.00 (Obese)', () => {
		expect(computeBmi(250, 300)).toBe(48);
	});

	it('height 250 cm, weight 10 kg → BMI 1.60 (Underweight)', () => {
		expect(computeBmi(250, 10)).toBe(1.6);
		const r = calculateBmi('250', '10', 'metric');
		expect((r as BmiResult).category).toBe('Underweight');
	});

	it('metric ceiling: 310 cm, 1000 kg → BMI 104.06', () => {
		expect(computeBmi(INPUT_LIMITS.HEIGHT_MAX_CM, INPUT_LIMITS.WEIGHT_MAX_KG)).toBe(104.06);
	});

	it('imperial ceiling: 120 in, 1500 lb stays valid and finite', () => {
		const r = calculateBmi('120', '1500', 'imperial');
		expect(isBmiResult(r)).toBe(true);
		const b = (r as BmiResult).bmi;
		expect(Number.isFinite(b)).toBe(true);
		// 680.388555 kg / (3.048 m)² = 73.25…
		expect(b).toBeCloseTo(73.26, 1);
	});

	it('BMI 25 boundary classifies as Overweight (half-up on the stored value)', () => {
		// w/h² = exactly 25 → 200 kg at ~2 m (h=200cm → 200/(2²)=50? no)
		// Direct: 80 kg, 178.885... cm is awkward; instead force it:
		// 60 kg at 154.919... cm — use 60 kg / (1.5491933…)² = 25.0
		// Simplest exact case: 100 kg at 200 cm → 25.00
		const r = calculateBmi('200', '100', 'metric');
		expect((r as BmiResult).bmi).toBe(25);
		expect((r as BmiResult).category).toBe('Overweight');
	});

	it('rounds deterministically to 2 decimals (banker-safe repeated calls)', () => {
		// 68 kg at 165 cm = 24.9771… → 24.98 (half-away, via toFixed)
		expect(computeBmi(165, 68)).toBe(24.98);
		// Same input always yields the same double
		expect(computeBmi(165, 68)).toBe(computeBmi(165, 68));
	});

	it('never yields Infinity or NaN across the full boundary matrix', () => {
		const heights = [1, 50, 120, 154.9, 250, 304.8, INPUT_LIMITS.HEIGHT_MAX_CM];
		const weights = [1, 10, 70, 300, 680.4, INPUT_LIMITS.WEIGHT_MAX_KG];
		for (const h of heights) {
			for (const w of weights) {
				const bmi = computeBmi(h, w);
				expect(bmi).not.toBeNull();
				expect(Number.isFinite(bmi as number)).toBe(true);
				expect(bmi as number).toBeGreaterThan(0);
			}
		}
	});
});

// ── 3. Mifflin-St Jeor BMR / TDEE constants ──

describe('Mifflin-St Jeor BMR matches the published equation', () => {
	it('male: 10kg + 6.25cm − 5age + 5', () => {
		// 70 kg, 170 cm, 25 y → 700 + 1062.5 − 125 + 5 = 1642.5
		expect(computeBmrMifflinStJeor(70, 170, 25, 'male')).toBe(1642.5);
	});

	it('female: 10kg + 6.25cm − 5age − 161', () => {
		// 70 kg, 170 cm, 25 y → 700 + 1062.5 − 125 − 161 = 1476.5
		expect(computeBmrMifflinStJeor(70, 170, 25, 'female')).toBe(1476.5);
	});

	it('form bounds: age 1 and age 120 both compute', () => {
		// 10 kg, 50 cm, age 1, male → 100 + 312.5 − 5 + 5 = 412.5
		expect(computeBmrMifflinStJeor(10, 50, 1, 'male')).toBe(412.5);
		// 70 kg, 170 cm, age 120, female → 700 + 1062.5 − 600 − 161 = 1001.5
		expect(computeBmrMifflinStJeor(70, 170, 120, 'female')).toBe(1001.5);
	});

	it('rejects non-positive and non-finite inputs', () => {
		expect(computeBmrMifflinStJeor(0, 170, 25, 'male')).toBeNull();
		expect(computeBmrMifflinStJeor(70, 0, 25, 'male')).toBeNull();
		expect(computeBmrMifflinStJeor(70, 170, 0, 'male')).toBeNull();
		expect(computeBmrMifflinStJeor(NaN, 170, 25, 'male')).toBeNull();
		expect(computeBmrMifflinStJeor(70, Infinity, 25, 'male')).toBeNull();
	});

	it('genderless callers get the female-offset branch (documented behavior)', () => {
		// UI guards gender before calling; the pure function treats
		// null as the female-offset branch (no +5).
		expect(computeBmrMifflinStJeor(70, 170, 25, null)).toBe(1476.5);
	});
});

describe('activity factors are the exact published Mifflin-St Jeor multipliers', () => {
	it('all five constants match the 1990 paper companion values', () => {
		expect(ACTIVITY_FACTORS.sedentary).toBe(1.2);
		expect(ACTIVITY_FACTORS.light).toBe(1.375);
		expect(ACTIVITY_FACTORS.moderate).toBe(1.55);
		expect(ACTIVITY_FACTORS.active).toBe(1.725);
		expect(ACTIVITY_FACTORS.very_active).toBe(1.9);
	});

	it('TDEE = BMR × factor for every level (70 kg, 170 cm, 25 y, male)', () => {
		const bmr = 1642.5;
		expect(computeTdee(70, 170, 25, 'male', 'sedentary')).toBeCloseTo(bmr * 1.2, 9);
		expect(computeTdee(70, 170, 25, 'male', 'light')).toBeCloseTo(bmr * 1.375, 9);
		expect(computeTdee(70, 170, 25, 'male', 'moderate')).toBeCloseTo(bmr * 1.55, 9);
		expect(computeTdee(70, 170, 25, 'male', 'active')).toBeCloseTo(bmr * 1.725, 9);
		expect(computeTdee(70, 170, 25, 'male', 'very_active')).toBeCloseTo(bmr * 1.9, 9);
	});

	it('TDEE returns null when BMR is null', () => {
		expect(computeTdee(0, 170, 25, 'male', 'light')).toBeNull();
	});
});
