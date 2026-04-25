/**
 * Unit tests for BMI category classification, color mapping, and utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
  BMI_CATEGORIES,
  BMI_THRESHOLDS,
  CATEGORY_COLORS,
  COLORS,
  classifyBmi,
  getCategoryColor,
  clampBmiForDisplay,
  bmiToPercent,
} from '$lib/utils/bmi-category';

describe('BMI_THRESHOLDS', () => {
  it('has correct threshold values', () => {
    expect(BMI_THRESHOLDS.UNDERWEIGHT_MAX).toBe(18.5);
    expect(BMI_THRESHOLDS.NORMAL_MAX).toBe(25.0);
    expect(BMI_THRESHOLDS.OVERWEIGHT_MAX).toBe(30.0);
    expect(BMI_THRESHOLDS.IDEAL).toBe(22);
    expect(BMI_THRESHOLDS.MIN).toBe(12);
    expect(BMI_THRESHOLDS.MAX).toBe(40);
  });
});

describe('classifyBmi', () => {
  it('classifies underweight BMI values', () => {
    expect(classifyBmi(10)).toBe(BMI_CATEGORIES.UNDERWEIGHT);
    expect(classifyBmi(15)).toBe(BMI_CATEGORIES.UNDERWEIGHT);
    expect(classifyBmi(18.49)).toBe(BMI_CATEGORIES.UNDERWEIGHT);
  });

  it('classifies normal weight BMI values', () => {
    expect(classifyBmi(18.5)).toBe(BMI_CATEGORIES.NORMAL_WEIGHT);
    expect(classifyBmi(22)).toBe(BMI_CATEGORIES.NORMAL_WEIGHT);
    expect(classifyBmi(24.99)).toBe(BMI_CATEGORIES.NORMAL_WEIGHT);
  });

  it('classifies overweight BMI values', () => {
    expect(classifyBmi(25.0)).toBe(BMI_CATEGORIES.OVERWEIGHT);
    expect(classifyBmi(27.5)).toBe(BMI_CATEGORIES.OVERWEIGHT);
    expect(classifyBmi(29.99)).toBe(BMI_CATEGORIES.OVERWEIGHT);
  });

  it('classifies obese BMI values', () => {
    expect(classifyBmi(30.0)).toBe(BMI_CATEGORIES.OBESE);
    expect(classifyBmi(35)).toBe(BMI_CATEGORIES.OBESE);
    expect(classifyBmi(50)).toBe(BMI_CATEGORIES.OBESE);
  });

  it('handles boundary edge cases', () => {
    // Exactly at boundaries
    expect(classifyBmi(18.5)).toBe(BMI_CATEGORIES.NORMAL_WEIGHT);
    expect(classifyBmi(25.0)).toBe(BMI_CATEGORIES.OVERWEIGHT);
    expect(classifyBmi(30.0)).toBe(BMI_CATEGORIES.OBESE);
  });
});

describe('getCategoryColor', () => {
  it('returns correct color for each category', () => {
    expect(getCategoryColor('Underweight')).toBe(COLORS.BLUE);
    expect(getCategoryColor('Normal Weight')).toBe(COLORS.GREEN);
    expect(getCategoryColor('Overweight')).toBe(COLORS.YELLOW);
    expect(getCategoryColor('Obese')).toBe(COLORS.RED);
  });

  it('returns MUTED color for null/undefined category', () => {
    expect(getCategoryColor(null)).toBe(COLORS.MUTED);
    expect(getCategoryColor(undefined as unknown as null)).toBe(COLORS.MUTED);
  });

  it('returns MUTED color for unknown category string', () => {
    expect(getCategoryColor('Unknown')).toBe(COLORS.MUTED);
    expect(getCategoryColor('')).toBe(COLORS.MUTED);
  });
});

describe('clampBmiForDisplay', () => {
  it('returns 0 for null/undefined input', () => {
    expect(clampBmiForDisplay(null)).toBe(0);
    expect(clampBmiForDisplay(undefined)).toBe(0);
  });

  it('returns 0 for non-finite values', () => {
    expect(clampBmiForDisplay(NaN)).toBe(0);
    expect(clampBmiForDisplay(Infinity)).toBe(0);
    expect(clampBmiForDisplay(-Infinity)).toBe(0);
  });

  it('clamps values to [MIN, MAX] range', () => {
    expect(clampBmiForDisplay(0)).toBe(BMI_THRESHOLDS.MIN);
    expect(clampBmiForDisplay(5)).toBe(BMI_THRESHOLDS.MIN);
    expect(clampBmiForDisplay(50)).toBe(BMI_THRESHOLDS.MAX);
    expect(clampBmiForDisplay(100)).toBe(BMI_THRESHOLDS.MAX);
  });

  it('returns value unchanged when in range', () => {
    expect(clampBmiForDisplay(22)).toBe(22);
    expect(clampBmiForDisplay(18.5)).toBe(18.5);
    expect(clampBmiForDisplay(30)).toBe(30);
  });
});

describe('bmiToPercent', () => {
  it('returns 0 for MIN boundary', () => {
    expect(bmiToPercent(BMI_THRESHOLDS.MIN)).toBe(0);
  });

  it('returns 100 for MAX boundary', () => {
    expect(bmiToPercent(BMI_THRESHOLDS.MAX)).toBe(100);
  });

  it('returns 50 for midpoint of range', () => {
    const mid = (BMI_THRESHOLDS.MIN + BMI_THRESHOLDS.MAX) / 2;
    expect(bmiToPercent(mid)).toBe(50);
  });

  it('clamps values outside range', () => {
    expect(bmiToPercent(0)).toBe(0);
    expect(bmiToPercent(100)).toBe(100);
  });

  it('calculates correct percentage for known BMI values', () => {
    const expected = ((22 - BMI_THRESHOLDS.MIN) / (BMI_THRESHOLDS.MAX - BMI_THRESHOLDS.MIN)) * 100;
    expect(bmiToPercent(22)).toBeCloseTo(expected, 5);
  });
});

describe('CATEGORY_COLORS', () => {
  it('has all four BMI categories', () => {
    expect(CATEGORY_COLORS['Underweight']).toBeDefined();
    expect(CATEGORY_COLORS['Normal Weight']).toBeDefined();
    expect(CATEGORY_COLORS['Overweight']).toBeDefined();
    expect(CATEGORY_COLORS['Obese']).toBeDefined();
  });

  it('uses valid hex color format', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const color of Object.values(CATEGORY_COLORS)) {
      expect(color).toMatch(hexRegex);
    }
  });
});

describe('COLORS', () => {
  it('has all expected semantic color constants', () => {
    expect(COLORS.BLUE).toBeDefined();
    expect(COLORS.GREEN).toBeDefined();
    expect(COLORS.YELLOW).toBeDefined();
    expect(COLORS.RED).toBeDefined();
    expect(COLORS.AMBER).toBeDefined();
    expect(COLORS.SLATE).toBeDefined();
    expect(COLORS.MUTED).toBeDefined();
  });

  it('uses valid hex color format', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const color of Object.values(COLORS)) {
      expect(color).toMatch(hexRegex);
    }
  });
});
