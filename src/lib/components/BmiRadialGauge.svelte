<script lang="ts">
  import { Gauge } from 'lucide-svelte';
  import { onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { getPerformanceTier, prefersReducedMotion } from '$lib/utils/performance';

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
  let appliedColor = $state('rgba(124, 58, 237, 0.3)');
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

  const perfTier = getPerformanceTier();
  const reducedMotionPref = prefersReducedMotion();
  const displayBmi = tweened(0, { duration: 0, easing: cubicOut });

  let reducedMotion = $derived(reducedMotionPref && !ultraSmooth);

  const categoryColors: Record<string, string> = {
    'Underweight': '#60a5fa',
    'Normal Weight': '#a78bfa',
    'Overweight': '#f59e0b',
    'Obese': '#ef4444'
  };

  const categoryScale = [
    { label: 'Underweight', color: categoryColors['Underweight'], min: 0, max: 18.5 },
    { label: 'Normal Weight', color: categoryColors['Normal Weight'], min: 18.5, max: 25.0 },
    { label: 'Overweight', color: categoryColors['Overweight'], min: 25.0, max: 30.0 },
    { label: 'Obese', color: categoryColors['Obese'], min: 30.0, max: 40.0 }
  ];

  function getScaleClass(label: string): string {
    switch (label) {
      case 'Underweight': return 'sc-underweight';
      case 'Normal Weight': return 'sc-normal';
      case 'Overweight': return 'sc-overweight';
      case 'Obese': return 'sc-obese';
      default: return '';
    }
  }

  const gaugeSize = 280;
  const strokeWidth = 20;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const maxBMI = 40;

  // Sync visual state with inputs via a helper to avoid reactive self-dependency
  function applyInputs(nextBmi: number, nextCategory: string) {
    const nextColor = categoryColors[nextCategory] ?? '#a78bfa';
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

  // Reactive entry point — syncs props to visual state (side effects: mutations)
  $effect(() => {
    if (bmi > 0 && category) {
      applyInputs(bmi, category);
    } else {
      prevAppliedBmi = appliedBmi;
      appliedBmi = 0;
      appliedColor = 'rgba(124, 58, 237, 0.3)';
      appliedCategory = null;
    }
  });

  // Stroke driven by appliedBmi (persistent)
  let appliedPercentage = $derived(Math.max(0, Math.min(appliedBmi / maxBMI, 1)));
  const strokeDasharray = circumference;
  let strokeDashoffset = $derived(circumference - (appliedPercentage * circumference));

  // Center display + animation config — side effects (displayBmi.set) + state mutations
  $effect(() => {
    const ultraEnabled = ultraSmooth && !reducedMotion && perfTier !== 'low';
    useGlow = ultraEnabled && perfTier === 'high';
    usePulse = ultraEnabled;

    bmiTweenDuration = reducedMotion
      ? 0
      : ultraEnabled
        ? (perfTier === 'high' ? 1200 : 900)
        : (perfTier === 'low' ? 420 : 720);

    strokeDuration = reducedMotion
      ? '0ms'
      : ultraEnabled
        ? (perfTier === 'high' ? '1600ms' : '1400ms')
        : '1200ms';

    strokeDurationFill = reducedMotion
      ? '0ms'
      : ultraEnabled
        ? (perfTier === 'high' ? '2200ms' : '2000ms')
        : '1800ms';

    strokeDelayFill = ultraEnabled ? '160ms' : '120ms';
    pulseDuration = ultraEnabled ? '1.35s' : '1s';

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
  let categoryDisplayText = $derived(appliedCategory ?? 'N/A');

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

  let progressStart = $derived(appliedBmi > 0 ? appliedColor : 'rgba(124, 58, 237, 0.3)');
  let progressEnd = $derived(appliedBmi > 0 ? lighten(appliedColor, 0.25) : 'rgba(124, 58, 237, 0.15)');
</script>

<div class="gauge-container">
  <div class="gauge-header">
    <div class="gauge-title">
      <Gauge class="Gauge" />
      <h3>BMI Gauge</h3>
    </div>
    <div class="gauge-subtitle">Real-time BMI visualization</div>
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
          <stop offset="0%" stop-color="rgba(148, 163, 184, 0.06)" />
          <stop offset="100%" stop-color="rgba(148, 163, 184, 0.02)" />
        </linearGradient>

        <linearGradient id="gaugeProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#8000ff" />
          <stop offset="50%" stop-color={progressStart} />
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
          fill={appliedBmi > 0 ? appliedColor : '#6b7280'}
        >
          {bmiDisplayValue}
        </text>

        <text x={gaugeSize / 2} y={gaugeSize / 2 + 20} text-anchor="middle" class="bmi-label">
          BMI
        </text>

        <text
          x={gaugeSize / 2}
          y={gaugeSize / 2 + 40}
          text-anchor="middle"
          class="category-label"
          fill={appliedBmi > 0 ? appliedColor : '#6b7280'}
        >
          {categoryDisplayText}
        </text>
      </g>
    </svg>

    <!-- subtle reflection under the gauge -->
    <div class="gauge-reflection" aria-hidden="true"></div>

    <div class="scale-indicators">
      {#each categoryScale as sc (sc.label)}
        <div class="scale-item {getScaleClass(sc.label)}">
          <div class="scale-dot"></div>
          <span class="scale-label">{sc.label}</span>
          <span class="scale-range">{sc.min} - {sc.max}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- styles in global-styles.css -->
