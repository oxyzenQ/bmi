/**
 * Animation and motion configuration constants.
 *
 * Extracted from +page.svelte to reduce its size and make
 * performance-tuning adjustments in one place.
 */

// ── Marker animation durations (ms) ──
export const MARKER_ANIM = {
  HIGH: 860,
  MEDIUM: 780,
  LOW: 680,
  OVERSHOOT_RATIO: 0.62,
  SETTLE_RATIO: 0.48,
  SETTLE_DELAY_OFFSET: 80,
} as const;

// ── Pager transition durations (ms) ──
// Safe Premium Spring: spring-inspired page transitions.
// IN uses backOut easing for natural overshoot + settle (iOS feel).
// OUT uses cubicOut for clean, decisive exit. No gimmicks.
export const PAGER = {
  DUR_HIGH: 360,
  DUR_MEDIUM: 340,
  DUR_LOW: 320,
  DUR_BASIC: 260,
  OUT_RATIO: 0.4,
  OUT_BASIC: 100,
  DIST_HIGH: 16,
  DIST_MEDIUM: 14,
  DIST_LOW: 12,
  DIST_BASIC: 10,
  SWITCHING_DELAY: 60,
} as const;

// ── Spring animation strengths ──
// Safe Premium Spring: moderate strength for satisfying overshoot on IN phase.
export const SPRING = {
  STRENGTH_ENHANCED: 0.07,
  STRENGTH_BASIC: 0,
} as const;

// ── Scroll behavior ──
export const SCROLL = {
  WHEEL_COOLDOWN: 520,
  WHEEL_DX_THRESHOLD: 60,
  WHEEL_DY_MAX: 12,
  WHEEL_RATIO: 1.8,
  SCROLL_IDLE_DELAY: 2000,
  IS_SCROLLING_DELAY: 300,
  SCROLL_TOP_THRESHOLD: 300,
  SWIPE_DX_MIN: 60,
  SWIPE_ANGLE_RATIO: 1.2,
  TOUCH_SWIPE_DX_MIN: 96,
  TOUCH_SWIPE_ANGLE_RATIO: 1.75,
  TOUCH_SWIPE_MAX_MS: 420,
  TOUCH_VERTICAL_CANCEL_PX: 28,
  SCROLL_DELTA_EPSILON: 8,
  TOUCH_SCROLL_DELTA_EPSILON: 14,
  TOUCH_SCROLL_MODE_IDLE_DELAY: 240,
} as const;

// ── Haptic patterns ──
export const HAPTIC = {
  NAV: 5,
  CALCULATE: [15, 30, 15] as number[],
} as const;

// ── Radial gauge ──
export const GAUGE = {
  SIZE: 280,
  STROKE_WIDTH: 20,
  TWEEN_DURATION_HIGH: 1200,
  TWEEN_DURATION_MEDIUM: 900,
  TWEEN_DURATION_LOW: 420,
  TWEEN_DURATION_DEFAULT: 720,
  STROKE_DUR_HIGH: '1600ms',
  STROKE_DUR_MEDIUM: '1400ms',
  STROKE_DUR_DEFAULT: '1200ms',
  STROKE_FILL_DUR_HIGH: '2200ms',
  STROKE_FILL_DUR_MEDIUM: '2000ms',
  STROKE_FILL_DUR_DEFAULT: '1800ms',
  STROKE_DELAY_FILL_ENHANCED: '160ms',
  STROKE_DELAY_FILL_DEFAULT: '120ms',
  PULSE_DUR_ENHANCED: '1.35s',
  PULSE_DUR_DEFAULT: '1s',
  FILL_STATE_DURATION: 1400,
} as const;

// ── Section navigation ──
export const SECTIONS = [
  { id: 'welcome', label: 'Welcome', labelKey: 'nav.welcome' },
  { id: 'calculator', label: 'Calculator', labelKey: 'nav.calculator' },
  { id: 'gauge', label: 'Gauge', labelKey: 'nav.gauge' },
  { id: 'reference', label: 'Reference', labelKey: 'nav.reference' },
  { id: 'about', label: 'About', labelKey: 'nav.about' },
  { id: 'info', label: 'Info', labelKey: 'nav.info' },
] as const;

// ── Performance utilities (v18.0) ──
// Merged from performance.ts to reduce module count.

/**
 * Check if device prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get device performance tier (high, medium, low).
 *
 * Uses hardwareConcurrency, deviceMemory, and connection.effectiveType.
 * Defaults to 'medium' when APIs are unavailable.
 */
export function getPerformanceTier(): 'high' | 'medium' | 'low' {
  if (typeof window === 'undefined') return 'medium';

  // Check for hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency || 2;

  // Check for device memory (if available)
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;

  // Check for connection type
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  const effectiveType = connection?.effectiveType || '4g';

  // Determine tier
  if (cores >= 8 && memory >= 8 && (effectiveType === '4g' || !connection)) {
    return 'high';
  } else if (cores >= 4 && memory >= 4) {
    return 'medium';
  } else {
    return 'low';
  }
}
