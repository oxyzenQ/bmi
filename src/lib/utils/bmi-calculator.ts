// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Core BMI calculation logic — pure functions, no side-effects.
 *
 * Extracted from +page.svelte so the math can be unit-tested independently
 * and reused across components without coupling to Svelte reactivity.
 */

import { classifyBmi } from './bmi-category';

// ── Imperial ↔ Metric conversion factors ──

/** Inches to centimetres */
export const IN_TO_CM = 2.54;

/** Pounds to kilograms */
export const LB_TO_KG = 0.453592;

/** Kilograms to pounds */
export const KG_TO_LBS = 1 / LB_TO_KG; // ≈ 2.20462

// ── Input validation bounds ──

export const INPUT_LIMITS = {
  /** Minimum parseable height (any unit) */
  HEIGHT_MIN: 0,
  /** Maximum height in cm (covers all realistic human heights) */
  HEIGHT_MAX_CM: 310,
  /** Maximum height in inches */
  HEIGHT_MAX_IN: 120,
  /** Minimum parseable weight (any unit) */
  WEIGHT_MIN: 0,
  /** Maximum weight in kg */
  WEIGHT_MAX_KG: 1000,
  /** Maximum weight in lbs */
  WEIGHT_MAX_LBS: 1500,
} as const;

// ── Public types ──

export interface BmiResult {
  ok: true;
  /** Calculated BMI (kg/m²), rounded to 2 decimal places */
  bmi: number;
  /** Human-readable category string (e.g. "Normal Weight") */
  category: string;
  /** Height converted to centimetres */
  heightCm: number;
 /** Weight converted to kilograms */
  weightKg: number;
}

export type BmiErrorCode =
  | 'missing_height'
  | 'missing_weight'
  | 'invalid_height'
  | 'invalid_weight'
  | 'height_out_of_range'
  | 'weight_out_of_range';

export interface BmiError {
  ok: false;
  code: BmiErrorCode;
  message: string;
}

// ── Core calculation ──

/**
 * Convert imperial inputs to metric.
 * Returns the values unchanged when `unitSystem` is `'metric'`.
 */
export function toMetric(
  height: number,
  weight: number,
  unitSystem: 'metric' | 'imperial'
): { heightCm: number; weightKg: number } {
  if (unitSystem === 'imperial') {
    return { heightCm: height * IN_TO_CM, weightKg: weight * LB_TO_KG };
  }
  return { heightCm: height, weightKg: weight };
}

/**
 * Validate that parsed height and weight fall within acceptable ranges.
 * The limits depend on the unit system so that imperial users see
 * inch/pound-appropriate bounds rather than raw metric ones.
 */
export function validateInputs(
  heightCm: number,
  weightKg: number
): BmiError | null {
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    return { ok: false, code: 'invalid_height', message: 'Height must be a positive number.' };
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return { ok: false, code: 'invalid_weight', message: 'Weight must be a positive number.' };
  }
  if (heightCm > INPUT_LIMITS.HEIGHT_MAX_CM) {
    return { ok: false, code: 'height_out_of_range', message: `Height must be ≤ ${INPUT_LIMITS.HEIGHT_MAX_CM} cm.` };
  }
  if (weightKg > INPUT_LIMITS.WEIGHT_MAX_KG) {
    return { ok: false, code: 'weight_out_of_range', message: `Weight must be ≤ ${INPUT_LIMITS.WEIGHT_MAX_KG} kg.` };
  }
  return null;
}

/**
 * Compute BMI from metric values.
 * Returns `null` if the inputs are non-finite or out of range.
 */
export function computeBmi(heightCm: number, weightKg: number): number | null {
  const error = validateInputs(heightCm, weightKg);
  if (error) return null;

  const heightInM = heightCm / 100;
  const bmi = weightKg / (heightInM * heightInM);
  return parseFloat(bmi.toFixed(2));
}

/**
 * Full end-to-end BMI calculation.
 *
 * Accepts raw string inputs (as typed by the user), the unit system,
 * and returns either a `BmiResult` or a `BmiError`.
 *
 * This is the single source of truth — `+page.svelte` delegates here.
 */
export function calculateBmi(
  heightStr: string,
  weightStr: string,
  unitSystem: 'metric' | 'imperial'
): BmiResult | BmiError {
  // Parse raw strings
  const parsedHeight = parseFloat(heightStr);
  const parsedWeight = parseFloat(weightStr);

  if (!heightStr || !Number.isFinite(parsedHeight)) {
    return { ok: false, code: 'missing_height', message: 'Please enter your height.' };
  }
  if (!weightStr || !Number.isFinite(parsedWeight)) {
    return { ok: false, code: 'missing_weight', message: 'Please enter your weight.' };
  }

  // Convert to metric
  const { heightCm, weightKg } = toMetric(parsedHeight, parsedWeight, unitSystem);

  // Validate
  const error = validateInputs(heightCm, weightKg);
  if (error) return error;

  // Calculate
  const bmi = computeBmi(heightCm, weightKg)!;
  const category = classifyBmi(bmi);

  return { ok: true, bmi, category, heightCm, weightKg };
}

/**
 * Type guard — is the result a successful BmiResult?
 */
export function isBmiResult(result: BmiResult | BmiError): result is BmiResult {
  return result.ok === true;
}