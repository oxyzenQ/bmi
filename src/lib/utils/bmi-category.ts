/**
 * Shared BMI category definitions, colors, and utilities.
 *
 * Central source of truth for BMI category classification used across
 * BmiResults, BmiRadialGauge, BmiHealthRisk, BodyFatEstimate, BmiSnapshot.
 *
 * All color values are hex strings for use in both CSS (via style bindings)
 * and SVG attributes.  For opacity-variant colors, use the CSS variables
 * defined in tokens.css (e.g., --cat-green-30).
 */

// ── BMI Categories (English keys — language-independent)
// Display translation is handled at the component level via t('gauge.*')
export const BMI_CATEGORIES = {
  UNDERWEIGHT: 'Underweight',
  NORMAL_WEIGHT: 'Normal Weight',
  OVERWEIGHT: 'Overweight',
  OBESE: 'Obese',
} as const;

export type BmiCategory = (typeof BMI_CATEGORIES)[keyof typeof BMI_CATEGORIES];

// ── BMI category color palette (hex) ──
export const CATEGORY_COLORS: Record<BmiCategory, string> = {
  [BMI_CATEGORIES.UNDERWEIGHT]: '#4A90E2',
  [BMI_CATEGORIES.NORMAL_WEIGHT]: '#00C853',
  [BMI_CATEGORIES.OVERWEIGHT]: '#FFD600',
  [BMI_CATEGORIES.OBESE]: '#D50000',
} as const;

// ── Semantic color aliases for re-use ──
export const COLORS = {
  /** Primary blue — underweight / info */
  BLUE: '#4A90E2',
  /** Primary green — normal / success */
  GREEN: '#00C853',
  /** Primary yellow — overweight / warning */
  YELLOW: '#FFD600',
  /** Primary red — obese / danger */
  RED: '#D50000',
  /** Amber accent — body fat / warning variant */
  AMBER: '#F59E0B',
  /** Slate text — secondary descriptions */
  SLATE: '#94a3b8',
  /** Slate-dark text — muted labels */
  SLATE_DARK: '#64748b',
  /** Near-white text — headings */
  NEAR_WHITE: '#e2e8f0',
  /** Gauge inactive text */
  MUTED: '#6b7280',
  /** Dark elevated background */
  DARK_BG: '#1a1a2e',
} as const;

// ── BMI thresholds ──
export const BMI_THRESHOLDS = {
  MIN: 12,
  MAX: 40,
  UNDERWEIGHT_MAX: 18.5,
  NORMAL_MAX: 25.0,
  OVERWEIGHT_MAX: 30.0,
  IDEAL: 22,
} as const;

// ── Classification helpers ──
export function classifyBmi(bmi: number): BmiCategory {
  if (bmi < BMI_THRESHOLDS.UNDERWEIGHT_MAX) return BMI_CATEGORIES.UNDERWEIGHT;
  if (bmi < BMI_THRESHOLDS.NORMAL_MAX) return BMI_CATEGORIES.NORMAL_WEIGHT;
  if (bmi < BMI_THRESHOLDS.OVERWEIGHT_MAX) return BMI_CATEGORIES.OVERWEIGHT;
  return BMI_CATEGORIES.OBESE;
}

/**
 * Runtime type guard — narrows arbitrary string to BmiCategory.
 * Eliminates the unsafe `as BmiCategory` escape hatch.
 */
export function isBmiCategory(x: string): x is BmiCategory {
  return x in CATEGORY_COLORS;
}

export function getCategoryColor(category: string | null): string {
  if (!category || !isBmiCategory(category)) return COLORS.MUTED;
  return CATEGORY_COLORS[category];
}

/**
 * Clamp a BMI value into the display range [BMI_THRESHOLDS.MIN, BMI_THRESHOLDS.MAX].
 * Returns 0 for null/undefined input.
 */
export function clampBmiForDisplay(bmi: number | null | undefined): number {
  if (bmi == null || !Number.isFinite(bmi)) return 0;
  return Math.max(BMI_THRESHOLDS.MIN, Math.min(BMI_THRESHOLDS.MAX, bmi));
}

/**
 * Compute the 0–100 percentage for the gauge marker.
 */
export function bmiToPercent(bmi: number): number {
  return Math.max(0, Math.min(100,
    ((bmi - BMI_THRESHOLDS.MIN) / (BMI_THRESHOLDS.MAX - BMI_THRESHOLDS.MIN)) * 100
  ));
}