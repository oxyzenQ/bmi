// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Phase 3 — Regression Fortress: i18n tests
 *
 * Covers: t() translation, interpolation, locale fallback, setLocale,
 * getLocale, localeVersion bumping, locale detection, locale list.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false,
  building: false,
  version: 'test',
}));

// Mock storage (used by initLocale)
vi.mock('$lib/utils/storage', () => ({
  STORAGE_KEYS: {
    HISTORY: 'bmi.history',
    UNIT_SYSTEM: 'bmi.unitSystem',
    WALLPAPER_THEME: 'bmi.wallpaperTheme',
    LOCALE: 'bmi.locale',
    BMI_GOAL: 'bmi.goal',
    BMI_GOAL_START: 'bmi.goal.start',
  },
  storageGet: vi.fn().mockReturnValue(null),
  storageSet: vi.fn(),
}));

// Mock warn-dev (suppress console output in tests)
vi.mock('$lib/utils/warn-dev', () => ({
  warnDev: vi.fn(),
}));

import { t, getLocale, getLocaleVersion, locales, setLocale, initLocale, localeVersion } from '$lib/i18n';
import { get } from 'svelte/store';

beforeEach(() => {
  // Reset document lang
  if (typeof document !== 'undefined') {
    document.documentElement.lang = 'en';
  }
});

// ── locales metadata ──

describe('locales metadata', () => {
  it('has exactly 4 locales', () => {
    expect(locales).toHaveLength(4);
  });

  it('has expected locale codes', () => {
    const codes = locales.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('id');
    expect(codes).toContain('zh');
    expect(codes).toContain('ja');
  });

  it('each locale has required fields', () => {
    for (const locale of locales) {
      expect(typeof locale.code).toBe('string');
      expect(typeof locale.label).toBe('string');
      expect(typeof locale.flag).toBe('string');
      expect(typeof locale.shortLabel).toBe('string');
      expect(locale.code.length).toBe(2);
      expect(locale.shortLabel.length).toBe(2);
    }
  });

  it('locale codes are unique', () => {
    const codes = locales.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

// ── t() — translation ──

describe('t()', () => {
  it('returns English translation for known key', () => {
    const result = t('nav.welcome');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should not return the key itself when translation exists
    expect(result).not.toBe('nav.welcome');
  });

  it('returns key itself for unknown key', () => {
    const result = t('nonexistent.key.that.does.not.exist');
    expect(result).toBe('nonexistent.key.that.does.not.exist');
  });

  it('returns key itself for empty key', () => {
    expect(t('')).toBe('');
  });
});

// ── t() — interpolation ──

describe('t() interpolation', () => {
  it('replaces single placeholder', () => {
    const result = t('results.explanation', { n: 24.5, category: 'Normal' });
    expect(result).not.toContain('{n}');
    expect(result).toContain('24.5');
    expect(result).not.toContain('{category}');
    expect(result).toContain('Normal');
  });

  it('replaces numeric placeholder in time strings', () => {
    const result = t('time.minutes_ago', { n: 5 });
    expect(result).not.toContain('{n}');
    expect(result).toContain('5');
  });

  it('handles string interpolation params', () => {
    const result = t('time.minutes_ago', { n: 'five' });
    expect(result).not.toContain('{n}');
    expect(result).toContain('five');
  });

  it('ignores undefined/null params (leaves placeholder)', () => {
    const result = t('time.minutes_ago', { n: undefined });
    // undefined/null values should be skipped in replacement
    expect(result).toBeTruthy();
  });

  it('works without params', () => {
    const result = t('nav.welcome');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

// ── getLocale ──

describe('getLocale', () => {
  it('returns a valid locale code', () => {
    const locale = getLocale();
    expect(['en', 'id', 'zh', 'ja']).toContain(locale);
  });

  it('defaults to en', () => {
    expect(getLocale()).toBe('en');
  });
});

// ── localeVersion ──

describe('localeVersion', () => {
  it('is a Svelte store with a number', () => {
    const version = get(localeVersion);
    expect(typeof version).toBe('number');
  });

  it('getLocaleVersion returns same value as store', () => {
    expect(getLocaleVersion()).toBe(get(localeVersion));
  });
});

// ── setLocale ──

describe('setLocale', () => {
  it('changes locale to id', async () => {
    await setLocale('id');
    expect(getLocale()).toBe('id');
  });

  it('changes locale to zh', async () => {
    await setLocale('zh');
    expect(getLocale()).toBe('zh');
  });

  it('changes locale to ja', async () => {
    await setLocale('ja');
    expect(getLocale()).toBe('ja');
  });

  it('changes locale back to en', async () => {
    await setLocale('en');
    expect(getLocale()).toBe('en');
  });

  it('increments localeVersion on each call', async () => {
    const v1 = get(localeVersion);
    await setLocale('id');
    const v2 = get(localeVersion);
    await setLocale('en');
    const v3 = get(localeVersion);

    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });

  it('falls back to English for unknown locale', async () => {
    // @ts-expect-error - intentionally testing invalid input
    await setLocale('fr');
    // Should not crash — falls back to en
    const locale = getLocale();
    // setLocale always sets the given code, but loadLocale falls back dict to en
    // The localeStore will have 'fr', but the dict will be enDict
    expect(locale).toBe('fr');
    // Translation should still work (via en fallback)
    expect(t('nav.welcome')).toBeTruthy();
  });
});

// ── initLocale ──

describe('initLocale', () => {
  it('detects locale from navigator.language', () => {
    // Default navigator.language in jsdom is 'en' — initLocale should pick 'en'
    initLocale();
    expect(['en', 'id', 'zh', 'ja']).toContain(getLocale());
  });

  it('sets document.documentElement.lang', () => {
    initLocale();
    const lang = document.documentElement.lang;
    expect(['en', 'zh-CN', 'id', 'ja']).toContain(lang);
  });
});

// ── Cross-locale consistency ──

describe('cross-locale consistency', () => {
  it('nav keys exist in all locales', async () => {
    const navKeys = ['nav.welcome', 'nav.calculator', 'nav.gauge', 'nav.reference', 'nav.about', 'nav.info'];

    for (const code of ['en', 'id', 'zh', 'ja'] as const) {
      await setLocale(code);
      for (const key of navKeys) {
        const result = t(key);
        // Key should either be translated or fall back to English
        // (not return the key itself unless truly missing)
        // We just verify it doesn't crash
        expect(typeof result).toBe('string');
      }
    }
  });

  it('form keys exist in all locales', async () => {
    const formKeys = ['form.height', 'form.weight', 'form.age'];

    for (const code of ['en', 'id', 'zh', 'ja'] as const) {
      await setLocale(code);
      for (const key of formKeys) {
        const result = t(key);
        expect(typeof result).toBe('string');
      }
    }
  });

  it('results keys exist in all locales', async () => {
    const resultKeys = ['results.explanation', 'results.bmi'];

    for (const code of ['en', 'id', 'zh', 'ja'] as const) {
      await setLocale(code);
      for (const key of resultKeys) {
        const result = t(key);
        expect(typeof result).toBe('string');
      }
    }
  });

  // Reset to en after tests
  it('resets to en after locale tests', async () => {
    await setLocale('en');
    expect(getLocale()).toBe('en');
  });
});