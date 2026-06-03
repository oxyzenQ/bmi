// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
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
	isBmiCategory,
	clampBmiForDisplay,
	getCategoryLabel
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

describe('getCategoryLabel', () => {
	it('returns i18n key for known categories', () => {
		expect(getCategoryLabel('Underweight')).toBeTruthy();
		expect(getCategoryLabel('Normal Weight')).toBeTruthy();
		expect(getCategoryLabel('Overweight')).toBeTruthy();
		expect(getCategoryLabel('Obese')).toBeTruthy();
	});

	it('returns the input string for unknown categories', () => {
		expect(getCategoryLabel('Unknown')).toBe('Unknown');
	});

	it('is case-insensitive', () => {
		expect(getCategoryLabel('underweight')).toBeTruthy();
		expect(getCategoryLabel('OBESE')).toBeTruthy();
	});
});

describe('isBmiCategory', () => {
	it('returns true for valid categories', () => {
		expect(isBmiCategory('Underweight')).toBe(true);
		expect(isBmiCategory('Normal Weight')).toBe(true);
		expect(isBmiCategory('Overweight')).toBe(true);
		expect(isBmiCategory('Obese')).toBe(true);
	});

	it('returns false for invalid strings', () => {
		expect(isBmiCategory('Unknown')).toBe(false);
		expect(isBmiCategory('')).toBe(false);
		expect(isBmiCategory('underweight')).toBe(false);
		expect(isBmiCategory('NORMAL WEIGHT')).toBe(false);
	});

	it('narrows type correctly for CATEGORY_COLORS access', () => {
		const cat: string = 'Normal Weight';
		if (isBmiCategory(cat)) {
			// TypeScript should infer cat as BmiCategory here
			const color = CATEGORY_COLORS[cat];
			expect(color).toBe(COLORS.GREEN);
		} else {
			expect.unreachable('should not reach here');
		}
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
