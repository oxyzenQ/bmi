import { describe, it, expect } from 'vitest';
import {
  calculateBmi,
  isBmiResult,
  computeBmi,
  toMetric,
  validateInputs,
  IN_TO_CM,
  LB_TO_KG,
  KG_TO_LBS,
  INPUT_LIMITS,
} from '../bmi-calculator';

// ── Conversion constants ──

describe('conversion constants', () => {
  it('IN_TO_CM is 2.54', () => {
    expect(IN_TO_CM).toBe(2.54);
  });

  it('LB_TO_KG ≈ 0.453592', () => {
    expect(LB_TO_KG).toBeCloseTo(0.453592, 5);
  });

  it('KG_TO_LBS ≈ 2.20462', () => {
    expect(KG_TO_LBS).toBeCloseTo(2.20462, 4);
  });

  it('KG_TO_LBS is inverse of LB_TO_KG', () => {
    expect(KG_TO_LBS).toBeCloseTo(1 / LB_TO_KG, 10);
  });
});

// ── toMetric ──

describe('toMetric', () => {
  it('passes metric values through unchanged', () => {
    const result = toMetric(170, 70, 'metric');
    expect(result.heightCm).toBe(170);
    expect(result.weightKg).toBe(70);
  });

  it('converts imperial inches to cm', () => {
    const result = toMetric(66, 150, 'imperial');
    expect(result.heightCm).toBeCloseTo(66 * 2.54, 2);
  });

  it('converts imperial lbs to kg', () => {
    const result = toMetric(66, 154, 'imperial');
    expect(result.weightKg).toBeCloseTo(154 * 0.453592, 2);
  });

  it('handles zero values', () => {
    const result = toMetric(0, 0, 'metric');
    expect(result.heightCm).toBe(0);
    expect(result.weightKg).toBe(0);
  });
});

// ── validateInputs ──

describe('validateInputs', () => {
  it('returns null for valid inputs', () => {
    expect(validateInputs(170, 70)).toBeNull();
  });

  it('rejects non-finite height', () => {
    const result = validateInputs(NaN, 70);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('invalid_height');
  });

  it('rejects non-finite weight', () => {
    const result = validateInputs(170, Infinity);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('invalid_weight');
  });

  it('rejects zero height', () => {
    const result = validateInputs(0, 70);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('invalid_height');
  });

  it('rejects negative weight', () => {
    const result = validateInputs(170, -5);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('invalid_weight');
  });

  it('rejects height above max cm', () => {
    const result = validateInputs(311, 70);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('height_out_of_range');
  });

  it('rejects weight above max kg', () => {
    const result = validateInputs(170, 1001);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('weight_out_of_range');
  });

  it('accepts boundary values', () => {
    expect(validateInputs(310, 1000)).toBeNull();
  });
});

// ── computeBmi ──

describe('computeBmi', () => {
  it('calculates BMI correctly for normal weight', () => {
    // 70 kg, 170 cm → BMI = 70 / (1.7²) = 24.22
    expect(computeBmi(170, 70)).toBeCloseTo(24.22, 2);
  });

  it('calculates BMI correctly for underweight', () => {
    // 50 kg, 175 cm → BMI = 50 / (1.75²) = 16.33
    expect(computeBmi(175, 50)).toBeCloseTo(16.33, 2);
  });

  it('calculates BMI correctly for overweight', () => {
    // 85 kg, 170 cm → BMI = 85 / (1.7²) = 29.41
    expect(computeBmi(170, 85)).toBeCloseTo(29.41, 2);
  });

  it('calculates BMI correctly for obese', () => {
    // 100 kg, 170 cm → BMI = 100 / (1.7²) = 34.60
    expect(computeBmi(170, 100)).toBeCloseTo(34.60, 2);
  });

  it('returns null for invalid inputs', () => {
    expect(computeBmi(0, 70)).toBeNull();
    expect(computeBmi(170, 0)).toBeNull();
    expect(computeBmi(NaN, 70)).toBeNull();
  });

  it('rounds to 2 decimal places', () => {
    // 68 kg, 165 cm → BMI = 68 / (1.65²) = 24.977... → 24.98
    const result = computeBmi(165, 68);
    expect(result).not.toBeNull();
    expect(result!.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});

// ── calculateBmi (end-to-end) ──

describe('calculateBmi', () => {
  it('returns valid result for metric inputs', () => {
    const result = calculateBmi('170', '70', 'metric');
    expect(isBmiResult(result)).toBe(true);
    const r = result as any;
    expect(r.bmi).toBeCloseTo(24.22, 2);
    expect(r.category).toBe('Normal Weight');
    expect(r.heightCm).toBe(170);
    expect(r.weightKg).toBe(70);
  });

  it('converts imperial inputs to metric in result', () => {
    // 66.93 in ≈ 170 cm, 154.32 lbs ≈ 70 kg
    const result = calculateBmi('66.93', '154.32', 'imperial');
    expect(isBmiResult(result)).toBe(true);
    const r = result as any;
    expect(r.bmi).toBeCloseTo(24.22, 1);
    expect(r.heightCm).toBeCloseTo(170, 0);
    expect(r.weightKg).toBeCloseTo(70, 0);
  });

  it('returns error for empty height', () => {
    const result = calculateBmi('', '70', 'metric');
    expect(isBmiResult(result)).toBe(false);
    expect((result as any).code).toBe('missing_height');
  });

  it('returns error for empty weight', () => {
    const result = calculateBmi('170', '', 'metric');
    expect(isBmiResult(result)).toBe(false);
    expect((result as any).code).toBe('missing_weight');
  });

  it('returns error for non-numeric height', () => {
    const result = calculateBmi('abc', '70', 'metric');
    expect(isBmiResult(result)).toBe(false);
  });

  it('returns error for out-of-range height', () => {
    const result = calculateBmi('400', '70', 'metric');
    expect(isBmiResult(result)).toBe(false);
    expect((result as any).code).toBe('height_out_of_range');
  });

  it('returns error for out-of-range weight', () => {
    const result = calculateBmi('170', '2000', 'metric');
    expect(isBmiResult(result)).toBe(false);
    expect((result as any).code).toBe('weight_out_of_range');
  });

  it('classifies underweight BMI', () => {
    const result = calculateBmi('175', '50', 'metric');
    expect(isBmiResult(result)).toBe(true);
    expect((result as any).category).toBe('Underweight');
  });

  it('classifies overweight BMI', () => {
    const result = calculateBmi('170', '80', 'metric');
    expect(isBmiResult(result)).toBe(true);
    expect((result as any).category).toBe('Overweight');
  });

  it('classifies obese BMI', () => {
    const result = calculateBmi('170', '100', 'metric');
    expect(isBmiResult(result)).toBe(true);
    expect((result as any).category).toBe('Obese');
  });

  it('handles decimal inputs', () => {
    const result = calculateBmi('170.5', '70.3', 'metric');
    expect(isBmiResult(result)).toBe(true);
    expect((result as any).bmi).toBeGreaterThan(0);
  });

  it('handles imperial decimal inputs', () => {
    const result = calculateBmi('67.1', '155.5', 'imperial');
    expect(isBmiResult(result)).toBe(true);
    expect((result as any).bmi).toBeGreaterThan(0);
  });
});

// ── isBmiResult (type guard) ──

describe('isBmiResult', () => {
  it('returns true for successful result', () => {
    const result = calculateBmi('170', '70', 'metric');
    expect(isBmiResult(result)).toBe(true);
  });

  it('returns false for error result', () => {
    const result = calculateBmi('', '70', 'metric');
    expect(isBmiResult(result)).toBe(false);
  });
});

// ── INPUT_LIMITS ──

describe('INPUT_LIMITS', () => {
  it('has expected values', () => {
    expect(INPUT_LIMITS.HEIGHT_MIN).toBe(0);
    expect(INPUT_LIMITS.HEIGHT_MAX_CM).toBe(310);
    expect(INPUT_LIMITS.HEIGHT_MAX_IN).toBe(120);
    expect(INPUT_LIMITS.WEIGHT_MIN).toBe(0);
    expect(INPUT_LIMITS.WEIGHT_MAX_KG).toBe(1000);
    expect(INPUT_LIMITS.WEIGHT_MAX_LBS).toBe(1500);
  });
});
