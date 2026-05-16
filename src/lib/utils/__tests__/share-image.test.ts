/**
 * Phase 3 — Regression Fortress: share-image.ts tests
 *
 * Covers: generateBmiCard null guard (SSR/missing canvas context).
 * Note: jsdom does not implement Canvas 2D context, so canvas-dependent
 * tests are skipped. We verify the null guard and module structure.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock i18n
vi.mock('$lib/i18n', () => ({
  t: (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      'share.card_header': 'BMI Result',
      'share.card_prime': 'BMI Prime',
      'share.card_ideal': 'Ideal Weight',
      'share.card_tdee': 'TDEE',
      'share.card_kcal': 'kcal',
      'share.card_branding': 'BMI Stellar',
      'share.card_text': 'My BMI is {n} ({category})',
      'share.card_insight_underweight': 'Consider consulting a healthcare provider.',
      'share.card_insight_normal': 'Maintain your healthy lifestyle.',
      'share.card_insight_overweight': 'Focus on gradual weight loss.',
      'share.card_insight_obese': 'Seek professional medical advice.',
      'share.card_height': 'Height',
      'share.card_weight': 'Weight',
    };
    let result = translations[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return result;
  },
  getLocale: vi.fn().mockReturnValue('en'),
}));

// Mock bmi-category
vi.mock('../../utils/bmi-category', () => ({
  CATEGORY_COLORS: {
    Underweight: '#4A90E2',
    'Normal Weight': '#00C853',
    Overweight: '#FFD600',
    Obese: '#D50000',
  },
  COLORS: {
    SLATE: '#94A3B8',
  },
  isBmiCategory: (cat: string) =>
    ['Underweight', 'Normal Weight', 'Overweight', 'Obese'].includes(cat),
}));

import { generateBmiCard } from '../../utils/share-image';

describe('generateBmiCard', () => {
  it('returns null when document is undefined (SSR)', async () => {
    const originalDocument = globalThis.document;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).document;

    const result = await generateBmiCard({
      bmi: 24.5,
      category: 'Normal Weight',
    });
    expect(result).toBeNull();

    globalThis.document = originalDocument;
  });

  it('returns null when canvas context is unavailable (jsdom)', async () => {
    // jsdom does not implement Canvas 2D context — function should return null
    const result = await generateBmiCard({
      bmi: 24.5,
      category: 'Normal Weight',
    });
    // In jsdom, getContext('2d') returns null, so generateBmiCard returns null
    expect(result).toBeNull();
  });

  it('does not crash with various category values', async () => {
    // These should not throw even if canvas is unavailable
    await expect(generateBmiCard({ bmi: 16.5, category: 'Underweight' })).resolves.not.toThrow();
    await expect(generateBmiCard({ bmi: 27.3, category: 'Overweight' })).resolves.not.toThrow();
    await expect(generateBmiCard({ bmi: 35.0, category: 'Obese' })).resolves.not.toThrow();
    await expect(generateBmiCard({ bmi: 22.0, category: 'Unknown' })).resolves.not.toThrow();
  });

  it('does not crash with optional fields', async () => {
    await expect(
      generateBmiCard({
        bmi: 24.5,
        category: 'Normal Weight',
        bmiPrime: 0.98,
        tdee: 2100,
        idealMin: 56.0,
        idealMax: 76.0,
        weightUnit: 'kg',
      })
    ).resolves.not.toThrow();
  });

  it('does not crash with personal data fields', async () => {
    await expect(
      generateBmiCard({
        bmi: 24.5,
        category: 'Normal Weight',
        bmiPrime: 0.98,
        tdee: 2100,
        idealMin: 56.0,
        idealMax: 76.0,
        weightUnit: 'kg',
        height: 170,
        weight: 70,
        heightUnit: 'cm',
      })
    ).resolves.not.toThrow();
  });

  it('does not crash with imperial personal data', async () => {
    await expect(
      generateBmiCard({
        bmi: 24.5,
        category: 'Normal Weight',
        weightUnit: 'lbs',
        height: 67,
        weight: 154,
        heightUnit: 'in',
      })
    ).resolves.not.toThrow();
  });

  it('does not crash with jpeg format', async () => {
    await expect(
      generateBmiCard({
        bmi: 24.5,
        category: 'Normal Weight',
        format: 'jpeg',
      })
    ).resolves.not.toThrow();
  });

  it('does not crash with all fields and jpeg format', async () => {
    await expect(
      generateBmiCard({
        bmi: 22.1,
        category: 'Normal Weight',
        bmiPrime: 0.88,
        tdee: 1850,
        idealMin: 55.0,
        idealMax: 75.0,
        weightUnit: 'kg',
        height: 175,
        weight: 68,
        heightUnit: 'cm',
        format: 'jpeg',
      })
    ).resolves.not.toThrow();
  });
});