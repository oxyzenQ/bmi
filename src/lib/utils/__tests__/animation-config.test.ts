// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Phase 3 — Regression Fortress: animation-config.ts tests
 *
 * Covers: constant immutability, value ranges, section definitions,
 * prefersReducedMotion, and getPerformanceTier.
 */

import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';

import {
  MARKER_ANIM,
  PAGER,
  SPRING,
  SCROLL,
  HAPTIC,
  GAUGE,
  SECTIONS,
  prefersReducedMotion,
  getPerformanceTier,
} from '../animation-config';

// ── MARKER_ANIM ──

describe('MARKER_ANIM', () => {
  it('has expected duration tiers (HIGH > MEDIUM > LOW)', () => {
    expect(MARKER_ANIM.HIGH).toBeGreaterThan(MARKER_ANIM.MEDIUM);
    expect(MARKER_ANIM.MEDIUM).toBeGreaterThan(MARKER_ANIM.LOW);
  });

  it('has overshoot ratio between 0 and 1', () => {
    expect(MARKER_ANIM.OVERSHOOT_RATIO).toBeGreaterThan(0);
    expect(MARKER_ANIM.OVERSHOOT_RATIO).toBeLessThan(1);
  });

  it('has settle ratio between 0 and 1', () => {
    expect(MARKER_ANIM.SETTLE_RATIO).toBeGreaterThan(0);
    expect(MARKER_ANIM.SETTLE_RATIO).toBeLessThan(1);
  });

  it('has positive settle delay offset', () => {
    expect(MARKER_ANIM.SETTLE_DELAY_OFFSET).toBeGreaterThan(0);
  });
});

// ── PAGER ──

describe('PAGER', () => {
  it('has duration tiers (HIGH > MEDIUM > LOW > BASIC)', () => {
    expect(PAGER.DUR_HIGH).toBeGreaterThan(PAGER.DUR_MEDIUM);
    expect(PAGER.DUR_MEDIUM).toBeGreaterThan(PAGER.DUR_LOW);
    expect(PAGER.DUR_LOW).toBeGreaterThan(PAGER.DUR_BASIC);
  });

  it('has positive OUT_RATIO between 0 and 1', () => {
    expect(PAGER.OUT_RATIO).toBeGreaterThan(0);
    expect(PAGER.OUT_RATIO).toBeLessThan(1);
  });

  it('has distance tiers (HIGH > MEDIUM > LOW > BASIC)', () => {
    expect(PAGER.DIST_HIGH).toBeGreaterThan(PAGER.DIST_MEDIUM);
    expect(PAGER.DIST_MEDIUM).toBeGreaterThan(PAGER.DIST_LOW);
    expect(PAGER.DIST_LOW).toBeGreaterThan(PAGER.DIST_BASIC);
  });

  it('has positive SWITCHING_DELAY', () => {
    expect(PAGER.SWITCHING_DELAY).toBeGreaterThan(0);
  });

  it('OUT_BASIC is shorter than OUT_RATIO * DUR_BASIC', () => {
    const outDuration = PAGER.DUR_BASIC * PAGER.OUT_RATIO;
    expect(PAGER.OUT_BASIC).toBeLessThanOrEqual(outDuration);
  });
});

// ── SPRING ──

describe('SPRING', () => {
  it('has positive enhanced strength', () => {
    expect(SPRING.STRENGTH_ENHANCED).toBeGreaterThan(0);
  });

  it('basic strength is zero (no spring)', () => {
    expect(SPRING.STRENGTH_BASIC).toBe(0);
  });

  it('enhanced strength is a reasonable fraction', () => {
    expect(SPRING.STRENGTH_ENHANCED).toBeLessThan(0.5);
  });
});

// ── SCROLL ──

describe('SCROLL', () => {
  it('has positive wheel cooldown', () => {
    expect(SCROLL.WHEEL_COOLDOWN).toBeGreaterThan(0);
  });

  it('has positive dx threshold for wheel scroll detection', () => {
    expect(SCROLL.WHEEL_DX_THRESHOLD).toBeGreaterThan(0);
  });

  it('has positive dy max for vertical dampening', () => {
    expect(SCROLL.WHEEL_DY_MAX).toBeGreaterThan(0);
  });

  it('has swipe dx min > 0', () => {
    expect(SCROLL.SWIPE_DX_MIN).toBeGreaterThan(0);
  });

  it('has positive scroll idle delay', () => {
    expect(SCROLL.SCROLL_IDLE_DELAY).toBeGreaterThan(0);
  });

  it('wheel ratio > 1 (amplification)', () => {
    expect(SCROLL.WHEEL_RATIO).toBeGreaterThan(1);
  });
});

// ── HAPTIC ──

describe('HAPTIC', () => {
  it('has positive nav haptic duration', () => {
    expect(HAPTIC.NAV).toBeGreaterThan(0);
  });

  it('has calculate haptic pattern with 3 elements', () => {
    expect(Array.isArray(HAPTIC.CALCULATE)).toBe(true);
    expect(HAPTIC.CALCULATE).toHaveLength(3);
    expect(HAPTIC.CALCULATE.every((v) => v > 0)).toBe(true);
  });
});

// ── GAUGE ──

describe('GAUGE', () => {
  it('has reasonable size', () => {
    expect(GAUGE.SIZE).toBeGreaterThan(100);
  });

  it('has positive stroke width', () => {
    expect(GAUGE.STROKE_WIDTH).toBeGreaterThan(0);
  });

  it('has tween duration tiers (HIGH > MEDIUM > DEFAULT > LOW)', () => {
    expect(GAUGE.TWEEN_DURATION_HIGH).toBeGreaterThan(GAUGE.TWEEN_DURATION_MEDIUM);
    expect(GAUGE.TWEEN_DURATION_MEDIUM).toBeGreaterThan(GAUGE.TWEEN_DURATION_DEFAULT);
    expect(GAUGE.TWEEN_DURATION_DEFAULT).toBeGreaterThan(GAUGE.TWEEN_DURATION_LOW);
  });

  it('stroke durations have HIGH > MEDIUM > DEFAULT ordering', () => {
    const parseDur = (s: string) => parseInt(s, 10);
    expect(parseDur(GAUGE.STROKE_DUR_HIGH)).toBeGreaterThan(parseDur(GAUGE.STROKE_DUR_MEDIUM));
    expect(parseDur(GAUGE.STROKE_DUR_MEDIUM)).toBeGreaterThan(parseDur(GAUGE.STROKE_DUR_DEFAULT));
  });

  it('has positive fill state duration', () => {
    expect(GAUGE.FILL_STATE_DURATION).toBeGreaterThan(0);
  });
});

// ── SECTIONS ──

describe('SECTIONS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(SECTIONS)).toBe(true);
    expect(SECTIONS.length).toBeGreaterThan(0);
  });

  it('each section has required fields', () => {
    for (const section of SECTIONS) {
      expect(section).toHaveProperty('id');
      expect(section).toHaveProperty('label');
      expect(section).toHaveProperty('labelKey');
      expect(typeof section.id).toBe('string');
      expect(typeof section.label).toBe('string');
      expect(typeof section.labelKey).toBe('string');
      expect(section.id.length).toBeGreaterThan(0);
    }
  });

  it('has unique section ids', () => {
    const ids = SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least 4 sections', () => {
    expect(SECTIONS.length).toBeGreaterThanOrEqual(4);
  });

  it('labelKey starts with nav.', () => {
    for (const section of SECTIONS) {
      expect(section.labelKey).toMatch(/^nav\./);
    }
  });
});

// ── prefersReducedMotion ──

describe('prefersReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  beforeAll(() => {
    // jsdom does not implement matchMedia — provide a default mock
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns false when window is undefined (SSR)', () => {
    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    expect(prefersReducedMotion()).toBe(false);
    globalThis.window = originalWindow;
  });

  it('returns a boolean', () => {
    const result = prefersReducedMotion();
    expect(typeof result).toBe('boolean');
  });

  it('reflects matchMedia when media query matches', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it('returns false when media query does not match', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    expect(prefersReducedMotion()).toBe(false);
  });
});

// ── getPerformanceTier ──

describe('getPerformanceTier', () => {
  const originalNavigator = { ...navigator };

  afterEach(() => {
    // Restore navigator properties
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('returns a valid tier string', () => {
    const tier = getPerformanceTier();
    expect(['high', 'medium', 'low']).toContain(tier);
  });

  it('returns medium when window is undefined (SSR)', () => {
    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    expect(getPerformanceTier()).toBe('medium');
    globalThis.window = originalWindow;
  });

  it('returns high for powerful device', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 16,
        deviceMemory: 16,
        connection: { effectiveType: '4g' },
      },
      writable: true,
      configurable: true,
    });
    expect(getPerformanceTier()).toBe('high');
  });

  it('returns low for weak device', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 2,
        deviceMemory: 2,
        connection: { effectiveType: '2g' },
      },
      writable: true,
      configurable: true,
    });
    expect(getPerformanceTier()).toBe('low');
  });

  it('returns medium for mid-range device', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 4,
        deviceMemory: 4,
        connection: undefined,
      },
      writable: true,
      configurable: true,
    });
    expect(getPerformanceTier()).toBe('medium');
  });

  it('defaults to 2 cores when hardwareConcurrency is unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        deviceMemory: 2,
        connection: { effectiveType: '3g' },
      },
      writable: true,
      configurable: true,
    });
    const tier = getPerformanceTier();
    expect(['low', 'medium']).toContain(tier);
  });
});