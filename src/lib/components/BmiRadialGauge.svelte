<script lang="ts">
  import { Gauge } from 'lucide-svelte';
  import { onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { browser } from '$app/environment';
  import { getPerformanceTier, prefersReducedMotion } from '$lib/utils/performance';
  import { CATEGORY_COLORS, COLORS, BMI_THRESHOLDS, getCategoryColor, clampBmiForDisplay } from '$lib/utils/bmi-category';
  import { GAUGE } from '$lib/utils/animation-config';
  import { t as _t, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  interface Props {
    bmi?: number;
    category?: string | null;
    ultraSmooth?: boolean;
  }

  let {
    bmi = 0,
    category = null,
    ultraSmooth = false
  }: Props = $props();

  // Persisted dataset-like state (visual)
  let appliedBmi = $state(0);
  let appliedColor = $state('var(--cat-slate-30)');
  let appliedCategory = $state<string | null>(null);
  let prevAppliedBmi = $state(0);
  let isFilling = $state(false);
  let fillTimer: ReturnType<typeof setTimeout> | null = null;

  // Derived animation config
  let useGlow = $state(false);
  let usePulse = $state(false);
  let bmiTweenDuration = $state(0);
  let strokeDuration = $state('0ms');
  let strokeDurationFill = $state('0ms');
  let strokeDelayFill = $state('0ms');
  let pulseDuration = $state('1s');

  // Compute performance tier and reduced motion at mount time (not module level)
  // so lazy-loaded components get correct values
  let perfTier = $state<'high' | 'medium' | 'low'>('medium');
  let reducedMotionPref = $state(false);
  const displayBmi = tweened(0, { duration: 0, easing: cubicOut });

  let reducedMotion = $derived(reducedMotionPref && !ultraSmooth);

  const categoryColors = CATEGORY_COLORS;

  // Reactive scale — re-evaluates t() when locale changes (via _rv)
  let categoryScale = $derived([
    { key: 'Underweight', label: t('gauge.underweight'), color: categoryColors['Underweight'], min: 0, max: 18.5 },
    { key: 'Normal Weight', label: t('gauge.normal'), color: categoryColors['Normal Weight'], min: 18.5, max: 25.0 },
    { key: 'Overweight', label: t('gauge.overweight'), color: categoryColors['Overweight'], min: 25.0, max: 30.0 },
    { key: 'Obese', label: t('gauge.obese'), color: categoryColors['Obese'], min: 30.0, max: 40.0 }
  ]);

  function getScaleClass(key: string): string {
    switch (key) {
      case 'Underweight': return 'sc-underweight';
      case 'Normal Weight': return 'sc-normal';
      case 'Overweight': return 'sc-overweight';
      case 'Obese': return 'sc-obese';
      default: return '';
    }
  }

  const gaugeSize = GAUGE.SIZE;
  const strokeWidth = GAUGE.STROKE_WIDTH;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const maxBMI = BMI_THRESHOLDS.MAX;

  // Sync visual state with inputs via a helper to avoid reactive self-dependency
  function applyInputs(nextBmi: number, nextCategory: string) {
    const nextColor = getCategoryColor(nextCategory);
    if (nextBmi !== appliedBmi || nextColor !== appliedColor || nextCategory !== appliedCategory) {
      prevAppliedBmi = appliedBmi;
      appliedBmi = nextBmi;
      appliedColor = nextColor;
      appliedCategory = nextCategory;
      if (prevAppliedBmi <= 0 && appliedBmi > 0) {
        isFilling = true;
        if (fillTimer) clearTimeout(fillTimer);
        fillTimer = setTimeout(() => (isFilling = false), 1400);
      }
    }
  }

  onDestroy(() => {
    if (fillTimer) clearTimeout(fillTimer);
    // Cleanup tweened store subscription
    displayBmi.set(0, { duration: 0 });
  });

  // Cache isMobileTouch outside effects to avoid window.matchMedia reads
  // in the hot animation path (Bug-2 mobile perf).
  // Touch detection only needs to run once at mount.
  let isMobileTouchCached = $state(false);

  // Initialize perfTier, reducedMotion, and touch detection on mount
  $effect(() => {
    perfTier = getPerformanceTier();
    reducedMotionPref = prefersReducedMotion();
    if (browser) {
      isMobileTouchCached = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    }
  });

  // Reactive entry point — syncs props to visual state (side effects: mutations)
  $effect(() => {
    if (bmi > 0 && category) {
      applyInputs(bmi, category);
    } else {
      prevAppliedBmi = appliedBmi;
      appliedBmi = 0;
      appliedColor = 'var(--cat-slate-30)';
      appliedCategory = null;
    }
  });

  // Stroke driven by appliedBmi (persistent)
  let appliedPercentage = $derived(clampBmiForDisplay(appliedBmi) / maxBMI);
  const strokeDasharray = circumference;
  let strokeDashoffset = $derived(circumference - (appliedPercentage * circumference));

  // Center display + animation config — side effects (displayBmi.set) + state mutations
  $effect(() => {
    const ultraEnabled = ultraSmooth && !reducedMotion && perfTier !== 'low';
    useGlow = ultraEnabled && perfTier === 'high' && !isMobileTouchCached;
    usePulse = ultraEnabled;

    bmiTweenDuration = reducedMotion
      ? 0
      : ultraEnabled
        ? (perfTier === 'high' ? GAUGE.TWEEN_DURATION_HIGH : GAUGE.TWEEN_DURATION_MEDIUM)
        : (perfTier === 'low' ? GAUGE.TWEEN_DURATION_LOW : GAUGE.TWEEN_DURATION_DEFAULT);

    strokeDuration = reducedMotion
      ? '0ms'
      : ultraEnabled
        ? (perfTier === 'high' ? GAUGE.STROKE_DUR_HIGH : GAUGE.STROKE_DUR_MEDIUM)
        : GAUGE.STROKE_DUR_DEFAULT;

    strokeDurationFill = reducedMotion
      ? '0ms'
      : ultraEnabled
        ? (perfTier === 'high' ? GAUGE.STROKE_FILL_DUR_HIGH : GAUGE.STROKE_FILL_DUR_MEDIUM)
        : GAUGE.STROKE_FILL_DUR_DEFAULT;

    strokeDelayFill = ultraEnabled ? GAUGE.STROKE_DELAY_FILL_ENHANCED : GAUGE.STROKE_DELAY_FILL_DEFAULT;
    pulseDuration = ultraEnabled ? GAUGE.PULSE_DUR_ENHANCED : GAUGE.PULSE_DUR_DEFAULT;

    if (appliedBmi > 0) {
      displayBmi.set(appliedBmi, {
        duration: bmiTweenDuration,
        easing: cubicOut
      });
    } else {
      displayBmi.set(0, { duration: 0 });
    }
  });

  let bmiDisplayValue = $derived(appliedBmi > 0 ? $displayBmi.toFixed(2) : '—');
  // Map English category → i18n key for display translation
  const CATEGORY_I18N_KEYS: Record<string, string> = {
    'Underweight': 'gauge.underweight',
    'Normal Weight': 'gauge.normal',
    'Overweight': 'gauge.overweight',
    'Obese': 'gauge.obese',
  };

  // Translate category for display (appliedCategory is always English)
  let categoryDisplayText = $derived(
    appliedCategory
      ? t(CATEGORY_I18N_KEYS[appliedCategory] ?? 'gauge.normal')
      : t('gauge.na')
  );

  // Gradient helpers
  function lighten(hex: string, amount = 0.35) {
    const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (!m) return hex;
    const [, r, g, b] = m;
    const ri = parseInt(r, 16), gi = parseInt(g, 16), bi = parseInt(b, 16);
    const lr = Math.round(ri + (255 - ri) * amount);
    const lg = Math.round(gi + (255 - gi) * amount);
    const lb = Math.round(bi + (255 - bi) * amount);
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
  }

  let progressStart = $derived(appliedBmi > 0 ? appliedColor : 'var(--cat-slate-30)');
  let progressEnd = $derived(appliedBmi > 0 ? lighten(appliedColor, 0.25) : 'var(--cat-slate-30-light)');
</script>
<div class="gauge-container">
  <div class="gauge-header">
    <div class="gauge-title">
      <Gauge class="Gauge" />
      <h3>{t('gauge.title')}</h3>
    </div>
    <div class="gauge-subtitle">{t('gauge.subtitle')}</div>
  </div>

  <div class="gauge-wrapper">
    <svg
      class="radial-gauge"
      width={gaugeSize}
      height={gaugeSize}
      viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}
      aria-hidden="true"
      style={`--gauge-stroke-dur: ${strokeDuration}; --gauge-stroke-dur-fill: ${strokeDurationFill}; --gauge-stroke-delay-fill: ${strokeDelayFill}; --gauge-pulse-dur: ${pulseDuration};`}
    >
      <defs>
        <linearGradient id="gaugeBackground" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color: var(--sg-10)" />
          <stop offset="100%" style="stop-color: var(--sg-5)" />
        </linearGradient>

        <linearGradient id="gaugeProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color={progressStart} />
          <stop offset="100%" stop-color={progressEnd} />
        </linearGradient>

        {#if useGlow}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        {/if}
      </defs>

      <!-- Background ring -->
      <circle
        cx={gaugeSize / 2}
        cy={gaugeSize / 2}
        r={radius}
        fill="none"
        stroke="url(#gaugeBackground)"
        stroke-width={strokeWidth}
        stroke-linecap="round"
      />

      <!-- Progress arc: controlled by applied* state -->
      <circle
        cx={gaugeSize / 2}
        cy={gaugeSize / 2}
        r={radius}
        fill="none"
        stroke={appliedBmi > 0 ? 'url(#gaugeProgressGrad)' : 'url(#gaugeBackground)'}
        stroke-width={strokeWidth}
        stroke-linecap="round"
        stroke-dasharray={strokeDasharray}
        stroke-dashoffset={strokeDashoffset}
        transform={`rotate(-90 ${gaugeSize / 2} ${gaugeSize / 2})`}
        filter={useGlow ? 'url(#glow)' : undefined}
        class="gauge-progress {appliedBmi > 0 && usePulse ? 'pulsing' : ''} {isFilling ? 'filling' : ''}"
      />
      <!-- center text -->
      <g class="gauge-center">
        <text
          x={gaugeSize / 2}
          y={gaugeSize / 2 - 10}
          text-anchor="middle"
          class="bmi-value"
          fill={appliedBmi > 0 ? appliedColor : COLORS.MUTED}
        >
          {bmiDisplayValue}
        </text>

        <text x={gaugeSize / 2} y={gaugeSize / 2 + 20} text-anchor="middle" class="bmi-label">
          {t('gauge.bmi')}
        </text>

        <text
          x={gaugeSize / 2}
          y={gaugeSize / 2 + 40}
          text-anchor="middle"
          class="category-label"
          fill={appliedBmi > 0 ? appliedColor : COLORS.MUTED}
        >
          {categoryDisplayText}
        </text>
      </g>
    </svg>

    <!-- subtle reflection under the gauge -->
    <div class="gauge-reflection" aria-hidden="true"></div>

    <div class="scale-indicators">
      {#each categoryScale as sc (sc.key)}
        <div class="scale-item {getScaleClass(sc.key)}">
          <div class="scale-dot"></div>
          <span class="scale-label">{sc.label}</span>
          <span class="scale-range">{sc.min} - {sc.max}</span>
        </div>
      {/each}
    </div>

    {#if appliedBmi <= 0}
      <div class="gauge-empty-cta">
        <p>{t('gauge.empty')}</p>
        <button type="button" class="gauge-cta-btn" onclick={() => { if (browser) window.location.hash = '#calculator'; }}>
          {t('gauge.calculate')}
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- styles in global-styles.css -->
