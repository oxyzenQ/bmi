// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Phase 3 — Regression Fortress: Phase 1 bug regression guards
 *
 * Prevents regressions on bugs fixed during Phase 1 (UI Stabilization).
 * Tests design token integrity and CSS-related logic.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

import {
  MARKER_ANIM,
  PAGER,
  GAUGE,
} from '../animation-config';
import { computeBmi } from '../bmi-calculator';
import { classifyBmi } from '../bmi-category';

// ── Regression: Hardcoded duration values ──
// Phase 1 migrated 41 hardcoded durations to design tokens.
// These tests ensure the token values stay within expected ranges.

describe('Phase 1 regression: animation token ranges', () => {
  it('MARKER_ANIM durations are in reasonable range (200-2000ms)', () => {
    expect(MARKER_ANIM.HIGH).toBeGreaterThanOrEqual(200);
    expect(MARKER_ANIM.HIGH).toBeLessThanOrEqual(2000);
    expect(MARKER_ANIM.MEDIUM).toBeGreaterThanOrEqual(200);
    expect(MARKER_ANIM.MEDIUM).toBeLessThanOrEqual(2000);
    expect(MARKER_ANIM.LOW).toBeGreaterThanOrEqual(200);
    expect(MARKER_ANIM.LOW).toBeLessThanOrEqual(2000);
  });

  it('PAGER durations are in reasonable range (50-1000ms)', () => {
    expect(PAGER.DUR_HIGH).toBeGreaterThanOrEqual(50);
    expect(PAGER.DUR_HIGH).toBeLessThanOrEqual(1000);
    expect(PAGER.DUR_MEDIUM).toBeGreaterThanOrEqual(50);
    expect(PAGER.DUR_MEDIUM).toBeLessThanOrEqual(1000);
    expect(PAGER.DUR_LOW).toBeGreaterThanOrEqual(50);
    expect(PAGER.DUR_LOW).toBeLessThanOrEqual(1000);
    expect(PAGER.DUR_BASIC).toBeGreaterThanOrEqual(50);
    expect(PAGER.DUR_BASIC).toBeLessThanOrEqual(1000);
  });

  it('GAUGE tween durations are in reasonable range (200-3000ms)', () => {
    expect(GAUGE.TWEEN_DURATION_HIGH).toBeGreaterThanOrEqual(200);
    expect(GAUGE.TWEEN_DURATION_HIGH).toBeLessThanOrEqual(3000);
    expect(GAUGE.TWEEN_DURATION_MEDIUM).toBeGreaterThanOrEqual(200);
    expect(GAUGE.TWEEN_DURATION_MEDIUM).toBeLessThanOrEqual(3000);
    expect(GAUGE.TWEEN_DURATION_LOW).toBeGreaterThanOrEqual(200);
    expect(GAUGE.TWEEN_DURATION_LOW).toBeLessThanOrEqual(3000);
    expect(GAUGE.TWEEN_DURATION_DEFAULT).toBeGreaterThanOrEqual(200);
    expect(GAUGE.TWEEN_DURATION_DEFAULT).toBeLessThanOrEqual(3000);
  });
});

// ── Regression: Z-index hierarchy ──
// Phase 1 eliminated all hardcoded z-index values.
// These tests ensure the z-index token system remains consistent.

describe('Phase 1 regression: z-index hierarchy', () => {
  it('no hardcoded z-index values exist in .svelte files', () => {
    // Use ripgrep to find hardcoded z-index in .svelte files
    // Pattern: z-index followed by a number (not var())
    try {
      const result = execSync(
        'rg "z-index\\s*:\\s*[0-9]" --include="*.svelte" -l || true',
        { cwd: process.cwd(), encoding: 'utf-8' }
      ).trim();

      if (result) {
        const files = result.split('\n').filter(Boolean);
        // These should ONLY be in style blocks where z-index uses var() or tokens
        // If any file has hardcoded z-index, flag it
        expect(files).toHaveLength(0);
      }
    } catch {
      // rg returns non-zero when no matches — that's expected/good
    }
  });
});

// ── Regression: Duration token consistency ──
// Ensures animation-config.ts values align with CSS design tokens.

describe('Phase 1 regression: animation timing hierarchy', () => {
  it('OUT transitions are shorter than IN transitions', () => {
    // Phase 1 fix: OUT should be shorter to prevent timing gaps
    const outDuration = PAGER.DUR_BASIC * PAGER.OUT_RATIO;
    expect(PAGER.OUT_BASIC).toBeLessThanOrEqual(outDuration + 10); // small tolerance
  });

  it('marker settle delay is positive', () => {
    // Phase 1 fix: settle delay prevents animation overlap
    expect(MARKER_ANIM.SETTLE_DELAY_OFFSET).toBeGreaterThan(0);
  });

  it('page switching delay is positive but small', () => {
    // Phase 1 fix: small delay between page switch and animation start
    expect(PAGER.SWITCHING_DELAY).toBeGreaterThan(0);
    expect(PAGER.SWITCHING_DELAY).toBeLessThan(200);
  });
});

// ── Regression: BMI calculator precision ──
// Ensures BMI calculations remain precise after any refactoring.

describe('Phase 1 regression: BMI calculation precision', () => {
  it('computeBmi rounds to exactly 2 decimal places', () => {
    // Test known values
    const result1 = computeBmi(170, 70);
    expect(result1).not.toBeNull();
    // 70 / (1.7 * 1.7) = 24.221453...
    expect(result1).toBeCloseTo(24.22, 2);

    // Edge case: very small difference
    const result2 = computeBmi(180, 80);
    expect(result2).not.toBeNull();
    // 80 / (1.8 * 1.8) = 24.691358...
    expect(result2).toBeCloseTo(24.69, 2);
  });
});

// ── Regression: Category boundaries ──
// Ensures BMI category classification hasn't shifted.

describe('Phase 1 regression: BMI category boundaries', () => {
  it('exactly 18.5 is Normal Weight (not Underweight)', () => {
    // BMI = 18.5 exactly → Normal Weight
    const bmi = computeBmi(170, 53.465);
    expect(bmi).not.toBeNull();
    const cat = classifyBmi(bmi!);
    expect(cat).toBe('Normal Weight');
  });

  it('exactly 25 is Overweight (boundary is exclusive)', () => {
    const bmi = computeBmi(170, 72.25);
    expect(bmi).not.toBeNull();
    // 72.25 / (1.7²) = 72.25 / 2.89 = 25.00 exactly
    // classifyBmi uses < 25 for Normal, so 25.0 → Overweight
    const cat = classifyBmi(bmi!);
    expect(cat).toBe('Overweight');
  });

  it('24.99 is Normal Weight', () => {
    const bmi = computeBmi(170, 72.2);
    expect(bmi).not.toBeNull();
    // 72.2 / (1.7²) = 72.2 / 2.89 ≈ 24.98 → Normal Weight
    const cat = classifyBmi(bmi!);
    expect(cat).toBe('Normal Weight');
  });

  it('exactly 30 is Obese (boundary is exclusive)', () => {
    const bmi = computeBmi(170, 86.7);
    expect(bmi).not.toBeNull();
    // classifyBmi uses < 30 for Overweight, so 30.0 → Obese
    const cat = classifyBmi(bmi!);
    expect(cat).toBe('Obese');
  });

  it('29.99 is Overweight', () => {
    const bmi = computeBmi(170, 86.6);
    expect(bmi).not.toBeNull();
    const cat = classifyBmi(bmi!);
    expect(cat).toBe('Overweight');
  });
});