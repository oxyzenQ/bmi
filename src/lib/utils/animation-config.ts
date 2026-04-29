/**
 * Animation and motion configuration constants.
 *
 * Extracted from +page.svelte to reduce its size and make
 * performance-tuning adjustments in one place.
 */

// ── BMI bar gauge ──
export const BMI_BAR = {
  MIN: 12,
  MAX: 40,
} as const;

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
// Fast elegant: shorter durations, shorter distances, tighter spring.
export const PAGER = {
  DUR_HIGH: 380,
  DUR_MEDIUM: 320,
  DUR_LOW: 260,
  DUR_BASIC: 180,
  OUT_RATIO: 0.65,
  OUT_BASIC: 140,
  DIST_HIGH: 140,
  DIST_MEDIUM: 120,
  DIST_LOW: 100,
  DIST_BASIC: 70,
  SWITCHING_DELAY: 80,
} as const;

// ── Spring animation strengths ──
// Lower = less overshoot/bounce for elegant feel.
export const SPRING = {
  STRENGTH_ENHANCED: 0.06,
  STRENGTH_BASIC: 0.03,
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

// ── BmiResults tween ──
export const RESULTS_TWEEN_DURATION = 720;

// ── Section navigation ──
export const SECTIONS = [
  { id: 'welcome', label: 'Welcome', labelKey: 'nav.welcome' },
  { id: 'calculator', label: 'Calculator', labelKey: 'nav.calculator' },
  { id: 'gauge', label: 'Gauge', labelKey: 'nav.gauge' },
  { id: 'reference', label: 'Reference', labelKey: 'nav.reference' },
  { id: 'about', label: 'About', labelKey: 'nav.about' },
  { id: 'info', label: 'Info', labelKey: 'nav.info' },
] as const;
