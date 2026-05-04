<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { backOut, cubicOut } from 'svelte/easing';
  import { tweened } from 'svelte/motion';
  import { browser } from '$app/environment';
  import { getPerformanceTier } from '$lib/utils/performance';
  import { importBmiHistory } from '$lib/utils/history-io';
  import { createLazyLoader, createPairedLazyLoader } from '$lib/utils/lazy-load';
  import { STORAGE_KEYS, storageGet, storageSet, storageSetJSON, storageRemove, storageGetJSON, storageInvalidate } from '$lib/utils/storage';
  import { BMI_THRESHOLDS } from '$lib/utils/bmi-category';
  import { calculateBmi, isBmiResult } from '$lib/utils/bmi-calculator';
  import { MARKER_ANIM, PAGER, SPRING, SCROLL, HAPTIC, SECTIONS } from '$lib/utils/animation-config';
  import Hero from '$lib/ui/Hero.svelte';
  import NotifyFloat from '$lib/components/NotifyFloat.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import {
    Lightbulb,
    Users,
    GitBranch,
    GitCompare,
    PackageCheck,
    ShieldCheck,
    Activity,
    AlertTriangle,
    Scale,
    Settings,
    Bot,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    ChevronUp
  } from 'lucide-svelte';
  import { t as _t, initLocale, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }
  type BmiFormComponentType = typeof import('$lib/components/BmiForm.svelte').default;
  type BmiResultsComponentType = typeof import('$lib/components/BmiResults.svelte').default;
  type BmiRadialGaugeComponentType = typeof import('$lib/components/BmiRadialGauge.svelte').default;
  type BmiHealthRiskComponentType = typeof import('$lib/components/BmiHealthRisk.svelte').default;
  type BmiSnapshotComponentType = typeof import('$lib/components/BmiSnapshot.svelte').default;
  type BodyFatEstimateComponentType = typeof import('$lib/components/BodyFatEstimate.svelte').default;
  type ReferenceTableComponentType = typeof import('$lib/components/ReferenceTable.svelte').default;
  type BmiGoalTrackerComponentType = typeof import('$lib/components/BmiGoalTracker.svelte').default;
  // ── Lazy-loaded component state (Svelte 5 $state) ──
  let BmiFormComponent: BmiFormComponentType | null = $state(null);
  let BmiResultsComponent: BmiResultsComponentType | null = $state(null);
  let BmiRadialGaugeComponent: BmiRadialGaugeComponentType | null = $state(null);
  let BmiHealthRiskComponent: BmiHealthRiskComponentType | null = $state(null);
  let BmiSnapshotComponent: BmiSnapshotComponentType | null = $state(null);
  let BodyFatEstimateComponent: BodyFatEstimateComponentType | null = $state(null);
  let ReferenceTableComponent: ReferenceTableComponentType | null = $state(null);
  let BmiGoalTrackerComponent: BmiGoalTrackerComponentType | null = $state(null);

  // ── Lazy loaders (deduplicate imports, bridge to $state via onLoad) ──
  const calculatorLoader = createPairedLazyLoader<BmiFormComponentType, BmiResultsComponentType>(
    () => import('$lib/components/BmiForm.svelte'),
    () => import('$lib/components/BmiResults.svelte'),
    (comp) => { BmiFormComponent = comp; },
    (comp) => { BmiResultsComponent = comp; }
  );
  const gaugeLoader = createLazyLoader<BmiRadialGaugeComponentType>({
    importer: () => import('$lib/components/BmiRadialGauge.svelte'),
    onLoad: (comp) => { BmiRadialGaugeComponent = comp; }
  });
  const healthRiskLoader = createLazyLoader<BmiHealthRiskComponentType>({
    importer: () => import('$lib/components/BmiHealthRisk.svelte'),
    onLoad: (comp) => { BmiHealthRiskComponent = comp; }
  });
  const snapshotLoader = createLazyLoader<BmiSnapshotComponentType>({
    importer: () => import('$lib/components/BmiSnapshot.svelte'),
    onLoad: (comp) => { BmiSnapshotComponent = comp; }
  });
  const bodyFatLoader = createLazyLoader<BodyFatEstimateComponentType>({
    importer: () => import('$lib/components/BodyFatEstimate.svelte'),
    onLoad: (comp) => { BodyFatEstimateComponent = comp; }
  });
  const referenceLoader = createLazyLoader<ReferenceTableComponentType>({
    importer: () => import('$lib/components/ReferenceTable.svelte'),
    onLoad: (comp) => { ReferenceTableComponent = comp; }
  });
  const goalTrackerLoader = createLazyLoader<BmiGoalTrackerComponentType>({
    importer: () => import('$lib/components/BmiGoalTracker.svelte'),
    onLoad: (comp) => { BmiGoalTrackerComponent = comp; }
  });
  // Track if BMI was already saved to prevent duplicates
  let lastSavedBmi: number | null = null;

  function saveBmiToHistory(bmi: number, h: number, w: number, a: string) {
    if (!browser) return;
    // Note: isSecureContext guard removed — localStorage is available regardless
    // of HTTPS. Only crypto operations (export encryption) need secure context.
    if (lastSavedBmi === bmi) return;

    let history: Array<{ timestamp: number; bmi: number; height: number; weight: number; age?: number }> = [];
    try {
      history = storageGetJSON(STORAGE_KEYS.HISTORY, []);
    } catch {
      storageRemove(STORAGE_KEYS.HISTORY);
    }

    const ageNum = a !== '' ? parseInt(a) : undefined;

    const newRecord = {
      timestamp: Date.now(),
      bmi,
      height: h,
      weight: w,
      age: ageNum
    };

    // Keep only last year of data
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const filtered = history.filter((h) => h.timestamp > oneYearAgo);
    filtered.push(newRecord);
    filtered.sort((a, b) => a.timestamp - b.timestamp);

    storageSetJSON(STORAGE_KEYS.HISTORY, filtered);
    lastSavedBmi = bmi;
  }

  let bmiValue: number | null = $state(null);
  let category: string | null = $state(null);

  // Form inputs default empty strings for validation UX
  let age: string = $state('');
  let height: string = $state('');
  let weight: string = $state('');
  let gender: 'male' | 'female' | '' = $state('');
  let activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '' = $state('');
  let unitSystem = $state<'metric' | 'imperial'>('metric');
  let unitSystemInitialized = $state(false);

  let calculating = $state(false);
  let resultsRunId = $state(0);

  // Notification state
  let showNotify = $state(false);
  let notifyType = $state<'success' | 'delete' | 'warn' | 'error'>('success');
  let notifyMessage = $state('');
  let notifyButtonText = $state('');
  let pendingImportText = $state<string | null>(null);

  // Staging spinner state (gear overlay before notifications)
  let stagingLoading = $state(false);
  const STAGING_NOTIFY_DELAY = 1200;


  const currentYear = new Date().getFullYear();

  // Git info - injected at build time by Vite
  const gitCommitId = typeof __GIT_COMMIT_ID__ !== 'undefined' ? __GIT_COMMIT_ID__ : 'dev';
  const gitBranch = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'main';

  const sections = SECTIONS;

  let activeIndex = $state(0);
  let lastIndex = $state(0);
  let prefersReducedMotion = $state(false);
  let perfTier = $state<'high' | 'medium' | 'low'>('medium');
  let smoothModeRequested = $state(false);

  let pagerNavEl: HTMLElement | null = null;
  let pagerNavCentered = $state(false);
  let pagerNavAlignRaf: number | null = null;

  // Auto-hide navbar state
  let lastScrollY = 0;
  let pagerControlsVisible = $state(true);
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  // Touch swipe state for mobile horizontal navigation
  let touchStartX: number | null = null;
  let touchStartY: number | null = null;
  let touchStartTime: number = 0;
  let touchHandled = false;
  let activePointerId: number | null = null;
  let lastWheelNavAt = 0;
  let switchingTimer: ReturnType<typeof setTimeout> | null = null;
  let pageDestroyed = $state(false);
  let showScrollTopFab = $state(false);



  function broadcastSmoothMode(enabled: boolean) {
    if (!browser) return;
    window.dispatchEvent(new CustomEvent('bmi:smoothMode', { detail: { enabled } }));
  }

  function triggerHaptic(pattern: number | number[] = HAPTIC.NAV) {
    if (!browser) return;
    try {
      if ('vibrate' in navigator) navigator.vibrate(pattern);
    } catch { /* vibrate not supported */ }
  }

  function scrollToTop() {
    if (!browser) return;
    const activeId = sections[activeIndex].id;
    const scroller = pagerEl?.querySelector<HTMLElement>(
      `[data-pager-scroll="true"][data-section-id="${activeId}"]`
    );
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    triggerHaptic(5);
  }

  function toggleSmoothMode() {
    smoothModeRequested = !smoothModeRequested;
    if (browser) {
      storageSet(STORAGE_KEYS.RENDER_MODE, smoothModeRequested ? '1' : '0');
      storageRemove(STORAGE_KEYS.SMOOTH_MODE);
      storageRemove(STORAGE_KEYS.ULTRA_SMOOTH);
      document.documentElement.dataset.graphics = smoothModeRequested ? 'render' : 'basic';
      broadcastSmoothMode(smoothModeRequested);
      void tick().then(schedulePagerNavAlignment);
    }
  }

  let reducedMotionEffective = $derived(prefersReducedMotion && !smoothModeRequested);
  let smoothModeEnhanced = $derived(smoothModeRequested && perfTier !== 'low');
  let smoothModeStatus = $derived(smoothModeRequested ? t('nav.on') : t('nav.off'));

  // Wallpaper theme toggle
  type ThemeKey = 'blackhole' | 'spaceship' | 'space';
  const THEMES: ThemeKey[] = ['blackhole', 'spaceship', 'space'];
  const THEME_URLS: Record<ThemeKey, string> = {
    blackhole: 'url("/images/blackhole.webp")',
    spaceship: 'url("/images/spaceshipx.webp")',
    space: 'url("/images/oxyzen-zenlysium.webp")',
  };
  const THEME_LABELS: Record<ThemeKey, () => string> = {
    blackhole: () => t('nav.blackhole'),
    spaceship: () => t('nav.spaceship'),
    space: () => t('nav.space'),
  };
  let currentTheme = $state<ThemeKey>('blackhole');
  let themeLabel = $derived(THEME_LABELS[currentTheme]());

  function toggleWallpaperTheme() {
    const idx = THEMES.indexOf(currentTheme);
    currentTheme = THEMES[(idx + 1) % THEMES.length];
    if (browser) {
      storageSet(STORAGE_KEYS.WALLPAPER_THEME, currentTheme);
      document.documentElement.style.setProperty('--wallpaper-current', THEME_URLS[currentTheme]);
    }
  }

  // Persist unit system in localStorage (only after initialization from onMount)
  $effect(() => {
    if (browser && unitSystemInitialized) {
      try {
        storageSet(STORAGE_KEYS.UNIT_SYSTEM, unitSystem);
      } catch {
        // storage unavailable
      }
    }
  });

  function springSimple(t: number, amount: number) {
    const base = backOut(t);
    return t + (base - t) * amount;
  }

  function pagerSpring(
    _node: Element,
    opts: {
      x: number;
      duration: number;
      phase: 'in' | 'out';
      strength: number;
    }
  ) {
    const x = opts.x;
    const duration = opts.duration;
    const phase = opts.phase;
    const strength = opts.strength;

    return {
      duration,
      css: (t: number) => {
        const linear = phase === 'in' ? t : 1 - t;
        const p = phase === 'in' ? springSimple(linear, strength) : cubicOut(linear);

        const dx = phase === 'in' ? (1 - p) * x : p * x;
        const opacity = phase === 'in' ? Math.min(1, p * 1.08) : Math.max(0, 1 - p * 1.15);

        const pe = phase === 'out' ? 'pointer-events: none;' : '';
        return `transform: translate3d(${dx.toFixed(3)}px, 0, 0); opacity: ${opacity.toFixed(4)}; ${pe}`;
      }
    };
  }

  const BMI_BAR_MIN = BMI_THRESHOLDS.MIN;
  const BMI_BAR_MAX = BMI_THRESHOLDS.MAX;

  // Animation duration constants (ms)
  const MARKER_ANIM_HIGH = MARKER_ANIM.HIGH;
  const MARKER_ANIM_MEDIUM = MARKER_ANIM.MEDIUM;
  const MARKER_ANIM_LOW = MARKER_ANIM.LOW;
  const OVERSHOOT_RATIO = MARKER_ANIM.OVERSHOOT_RATIO;
  const SETTLE_RATIO = MARKER_ANIM.SETTLE_RATIO;
  const SETTLE_DELAY_OFFSET = MARKER_ANIM.SETTLE_DELAY_OFFSET;

  // Pager motion duration constants (ms)
  const PAGER_DUR_HIGH = PAGER.DUR_HIGH;
  const PAGER_DUR_MEDIUM = PAGER.DUR_MEDIUM;
  const PAGER_DUR_LOW = PAGER.DUR_LOW;
  const PAGER_DUR_BASIC = PAGER.DUR_BASIC;
  const PAGER_OUT_RATIO = PAGER.OUT_RATIO;
  const PAGER_OUT_BASIC = PAGER.OUT_BASIC;

  // Pager motion distance constants (px)
  const PAGER_DIST_HIGH = PAGER.DIST_HIGH;
  const PAGER_DIST_MEDIUM = PAGER.DIST_MEDIUM;
  const PAGER_DIST_LOW = PAGER.DIST_LOW;
  const PAGER_DIST_BASIC = PAGER.DIST_BASIC;

  // Other animation constants
  const SWITCHING_DELAY = PAGER.SWITCHING_DELAY;
  const SPRING_STRENGTH_ENHANCED = SPRING.STRENGTH_ENHANCED;
  const SPRING_STRENGTH_BASIC = SPRING.STRENGTH_BASIC;

  let rangeMarker =
    $derived(
      bmiValue === null
        ? 0
        : Math.max(
            0,
            Math.min(
              100,
              ((bmiValue - BMI_BAR_MIN) / (BMI_BAR_MAX - BMI_BAR_MIN)) * 100
            )
          )
    );
  const animatedMarker = tweened(0, { duration: 0, easing: cubicOut });
  let lastMarker = 0;
  let markerTimer: ReturnType<typeof setTimeout> | null = null;

  function animateRangeMarker(target: number) {
    if (markerTimer) {
      clearTimeout(markerTimer);
      markerTimer = null;
    }

    if (reducedMotionEffective || !smoothModeRequested) {
      lastMarker = target;
      animatedMarker.set(target, { duration: 0 });
      return;
    }

    const base = perfTier === 'high' ? MARKER_ANIM_HIGH : perfTier === 'medium' ? MARKER_ANIM_MEDIUM : MARKER_ANIM_LOW;
    const overshootDur = Math.round(base * OVERSHOOT_RATIO);
    const settleDur = Math.round(base * SETTLE_RATIO);
    const delta = target - lastMarker;
    const overshoot = Math.max(0, Math.min(100, target + delta * 0.08));

    lastMarker = target;
    animatedMarker.set(overshoot, { duration: overshootDur, easing: backOut });
    markerTimer = setTimeout(() => {
      animatedMarker.set(target, { duration: settleDur, easing: cubicOut });
      markerTimer = null;
    }, Math.max(0, overshootDur - SETTLE_DELAY_OFFSET));
  }

  let pagerDirection = $derived(activeIndex >= lastIndex ? 1 : -1);
  let pagerMotionDuration = $derived(reducedMotionEffective
    ? 0
    : smoothModeRequested
      ? (perfTier === 'high' ? PAGER_DUR_HIGH : perfTier === 'medium' ? PAGER_DUR_MEDIUM : PAGER_DUR_LOW)
      : PAGER_DUR_BASIC);
  let pagerMotionDistance = $derived(reducedMotionEffective
    ? 0
    : smoothModeRequested
      ? (perfTier === 'high' ? PAGER_DIST_HIGH : perfTier === 'medium' ? PAGER_DIST_MEDIUM : PAGER_DIST_LOW)
      : PAGER_DIST_BASIC);

  let pagerEl: HTMLDivElement | null = null;
  let pointerStartX: number | null = null;
  let pointerStartY: number | null = null;

  function clampIndex(next: number) {
    return Math.min(sections.length - 1, Math.max(0, next));
  }

  function indexFromHash(hash: string) {
    const clean = hash.replace(/^#/, '').trim().toLowerCase();
    const idx = sections.findIndex((s) => s.id === clean);
    return idx >= 0 ? idx : null;
  }

  async function resetSectionScroll() {
    await tick();
    const activeId = sections[activeIndex].id;
    const scroller = pagerEl?.querySelector<HTMLElement>(
      `[data-pager-scroll="true"][data-section-id="${activeId}"]`
    );
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function setHash(id: string) {
    if (!browser) return;
    location.replace(`#${id}`);
  }

  function goTo(index: number, opts?: { skipHash?: boolean; skipSwitching?: boolean }) {
    const next = clampIndex(index);
    if (next === activeIndex) {
      if (!opts?.skipHash) setHash(sections[activeIndex].id);
      void resetSectionScroll();
      return;
    }

    if (browser && !reducedMotionEffective && !opts?.skipSwitching) {
      if (switchingTimer) clearTimeout(switchingTimer);
      document.body.classList.add('is-switching');
      const ms = Math.max(240, pagerMotionDuration) + SWITCHING_DELAY;
      switchingTimer = setTimeout(() => {
        document.body.classList.remove('is-switching');
        switchingTimer = null;
      }, ms);
    }

    lastIndex = activeIndex;
    activeIndex = next;
    showScrollTopFab = false;
    if (!opts?.skipHash) setHash(sections[activeIndex].id);
    void resetSectionScroll();
  }

  function prevSection() {
    if (activeIndex <= 0) return;
    triggerHaptic(5);
    goTo(activeIndex - 1);
  }

  function nextSection() {
    if (activeIndex >= sections.length - 1) return;
    triggerHaptic(5);
    goTo(activeIndex + 1);
  }

  function isEditableTarget(el: EventTarget | null) {
    const t = el as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      t.isContentEditable ||
      Boolean(t.closest('input, textarea, select, [contenteditable="true"]'))
    );
  }

  function handlePointerDown(event: PointerEvent) {
    // Touch is handled by dedicated touch handlers below;
    // pointer events only manage mouse/stylus input.
    if (event.pointerType === 'touch') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, label, [role="button"]')) return;
    if (target?.closest('.pager-nav, .pager-nav-shell, .pager-controls, .pager-controls-shell')) return;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    activePointerId = event.pointerId;
    try {
      pagerEl?.setPointerCapture(event.pointerId);
    } catch (e) {
      void e;
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    if (pointerStartX === null || pointerStartY === null) {
      if (activePointerId !== null) {
        try {
          pagerEl?.releasePointerCapture(activePointerId);
        } catch (e) {
          void e;
        }
      }
      activePointerId = null;
      return;
    }

    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;
    pointerStartX = null;
    pointerStartY = null;

    if (Math.abs(dx) < SCROLL.SWIPE_DX_MIN || Math.abs(dx) < Math.abs(dy) * SCROLL.SWIPE_ANGLE_RATIO) {
      if (activePointerId !== null) {
        try {
          pagerEl?.releasePointerCapture(activePointerId);
        } catch (e) {
          void e;
        }
      }
      activePointerId = null;
      return;
    }

    if (dx < 0) nextSection();
    else prevSection();

    if (activePointerId !== null) {
      try {
        pagerEl?.releasePointerCapture(activePointerId);
      } catch (e) {
        void e;
      }
    }
    activePointerId = null;
  }

  // ── Mobile touch swipe handlers ──
  // Detects horizontal swipes on touch devices to navigate between sections.
  // Uses touchstart/touchmove/touchend because pointer events for touch are
  // intentionally kept separate (pointer handles mouse/stylus only).
  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, label, [role="button"]')) return;
    if (target?.closest('.pager-nav, .pager-nav-shell, .pager-controls, .pager-controls-shell')) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    touchHandled = false;
  }

  function handleTouchMove(e: TouchEvent) {
    // NOTE: This listener uses { passive: true } — we do NOT call preventDefault().
    // Horizontal swipe detection is handled purely via touchstart/touchend.
    // This ensures the browser can process vertical scrolling on its own
    // compositor thread (60 fps) without waiting for JS — critical for
    // Bug-13 scroll jank fix on mobile/low-end devices.
    if (touchStartX === null || touchStartY === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);
    // Track whether horizontal swipe is dominant (used in handleTouchEnd)
    if (dx > dy * SCROLL.SWIPE_ANGLE_RATIO && dx > 15) {
      touchHandled = true;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchStartX === null || touchStartY === null) {
      touchStartX = null;
      touchStartY = null;
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) {
      touchStartX = null;
      touchStartY = null;
      return;
    }
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;
    touchStartX = null;
    touchStartY = null;

    // Swipe must be horizontal enough, exceed minimum distance, and be fast enough
    const isHorizontal = Math.abs(dx) > Math.abs(dy) * SCROLL.SWIPE_ANGLE_RATIO;
    const isLongEnough = Math.abs(dx) >= SCROLL.SWIPE_DX_MIN;
    const isFastEnough = elapsed < 500;

    if (isHorizontal && isLongEnough && isFastEnough) {
      triggerHaptic(HAPTIC.NAV);
      if (dx < 0) nextSection();
      else prevSection();
    }
  }

  function handleWheel(event: WheelEvent) {
    if (isEditableTarget(event.target)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.pager-nav, .pager-nav-shell, .pager-controls, .pager-controls-shell')) return;

    const now = Date.now();
    if (now - lastWheelNavAt < SCROLL.WHEEL_COOLDOWN) return;

    const dx = event.deltaX;
    const dy = event.deltaY;
    if (Math.abs(dx) < SCROLL.WHEEL_DX_THRESHOLD) return;
    if (Math.abs(dy) > SCROLL.WHEEL_DY_MAX) return;
    if (Math.abs(dx) < Math.abs(dy) * SCROLL.WHEEL_RATIO) return;

    const section = pagerEl?.querySelector<HTMLElement>('.pager-section') ?? null;
    if (section && section.scrollHeight > section.clientHeight + 2) {
      const maxY = section.scrollHeight - section.clientHeight;
      const midScroll = section.scrollTop > 2 && section.scrollTop < maxY - 2;
      if (midScroll) return;
    }

    if (target) {
      for (let el: HTMLElement | null = target; el && el !== pagerEl; el = el.parentElement) {
        if (el.scrollWidth > el.clientWidth + 2) {
          const maxX = el.scrollWidth - el.clientWidth;
          const canScrollX =
            (dx > 0 && el.scrollLeft < maxX - 1) ||
            (dx < 0 && el.scrollLeft > 1);
          if (canScrollX) return;
        }
      }
    }

    lastWheelNavAt = now;
    if (dx > 0) nextSection();
    else prevSection();
  }

  // Action: attach passive wheel listener (Svelte 5 doesn't support |passive modifier on onwheel)
  function passiveWheel(node: HTMLElement) {
    node.addEventListener('wheel', handleWheel, { passive: true });
    return {
      destroy() {
        node.removeEventListener('wheel', handleWheel);
      }
    };
  }

  function schedulePagerNavAlignment() {
    if (!browser) return;
    if (pagerNavAlignRaf !== null) return;
    if (pageDestroyed) return;
    pagerNavAlignRaf = requestAnimationFrame(() => {
      pagerNavAlignRaf = null;
      if (pageDestroyed) return;
      updatePagerNavAlignment();
    });
  }

  function updatePagerNavAlignment() {
    if (!pagerNavEl) return;
    const overflow = pagerNavEl.scrollWidth > pagerNavEl.clientWidth + 1;
    const nextCentered = !overflow;
    if (pagerNavCentered !== nextCentered) pagerNavCentered = nextCentered;
  }

  // Lazy-load components when section becomes active
  $effect(() => {
    if (!browser) return;
    if (activeIndex === 1) {
      void calculatorLoader.ensure();
    }
    if (activeIndex === 2) {
      void gaugeLoader.ensure();
      void healthRiskLoader.ensure();
      void snapshotLoader.ensure();
      void bodyFatLoader.ensure();
      void goalTrackerLoader.ensure();
    }
    if (activeIndex === 3) void referenceLoader.ensure();
  });

  onMount(() => {
    if (!browser) return;
    perfTier = getPerformanceTier();
    initLocale();
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Enhancement #12: Live listener for prefers-reduced-motion changes
    // If user toggles reduced-motion in OS settings while app is open,
    // animations update immediately without page reload.
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    motionQuery.addEventListener('change', onMotionChange);

    const storedRenderMode = storageGet(STORAGE_KEYS.RENDER_MODE);
    if (storedRenderMode === null) {
      const storedSmooth = storageGet(STORAGE_KEYS.SMOOTH_MODE);
      const storedUltra = storageGet(STORAGE_KEYS.ULTRA_SMOOTH);
      const hasLegacy = storedSmooth !== null || storedUltra !== null;
      smoothModeRequested =
        hasLegacy
          ? (storedSmooth === '1' || storedSmooth === 'true' || storedUltra === '1' || storedUltra === 'true')
          : true;
      storageSet(STORAGE_KEYS.RENDER_MODE, smoothModeRequested ? '1' : '0');
      storageRemove(STORAGE_KEYS.SMOOTH_MODE);
      storageRemove(STORAGE_KEYS.ULTRA_SMOOTH);
    } else {
      smoothModeRequested = storedRenderMode === '1' || storedRenderMode === 'true';
      storageRemove(STORAGE_KEYS.SMOOTH_MODE);
      storageRemove(STORAGE_KEYS.ULTRA_SMOOTH);
    }

    document.documentElement.dataset.graphics = smoothModeRequested ? 'render' : 'basic';
    document.documentElement.dataset.performanceTier = perfTier;
    broadcastSmoothMode(smoothModeRequested);

    try {
      const storedUnit = storageGet(STORAGE_KEYS.UNIT_SYSTEM);
      if (storedUnit === 'imperial' || storedUnit === 'metric') {
        unitSystem = storedUnit;
      }
    } catch {
      // storage unavailable
    }
    unitSystemInitialized = true;

    // Read wallpaper theme preference
    try {
      const storedTheme = storageGet(STORAGE_KEYS.WALLPAPER_THEME);
      if (storedTheme && THEMES.includes(storedTheme as ThemeKey)) {
        currentTheme = storedTheme as ThemeKey;
        document.documentElement.style.setProperty('--wallpaper-current', THEME_URLS[currentTheme]);
      }
    } catch {
      // localStorage unavailable
    }

    const idx = indexFromHash(window.location.hash);
    if (idx !== null) goTo(idx, { skipHash: true, skipSwitching: true });
    setHash(sections[activeIndex].id);

    const onHashChange = () => {
      const next = indexFromHash(window.location.hash);
      if (next !== null && next !== activeIndex) goTo(next, { skipHash: true });
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.UNIT_SYSTEM) {
        if (e.newValue === 'imperial' || e.newValue === 'metric') {
          unitSystem = e.newValue;
        } else if (e.newValue === null) {
          unitSystem = 'metric';
        }
        storageInvalidate(STORAGE_KEYS.UNIT_SYSTEM);
      }
    };
    window.addEventListener('storage', onStorage);

    window.addEventListener('hashchange', onHashChange);

    const onResize = () => schedulePagerNavAlignment();
    window.addEventListener('resize', onResize, { passive: true });

    // Mobile touch swipe listeners for horizontal page navigation.
    // All listeners use { passive: true } — Bug-13 fix.
    // Vertical scrolling is handled natively by the browser via
    // CSS touch-action on .pager-shell. We detect horizontal swipes
    // purely in touchstart/touchend without blocking the scroll thread.
    pagerEl?.addEventListener('touchstart', handleTouchStart, { passive: true });
    pagerEl?.addEventListener('touchmove', handleTouchMove, { passive: true });
    pagerEl?.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Unified scroll listener: is-scrolling class + pager-controls auto-hide
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    let scrollRafId: number | null = null;
    let pendingScrollTarget: HTMLElement | null = null;
    let pendingScrollY = 0;

    const flushScrollState = () => {
      scrollRafId = null;
      if (pendingScrollTarget) {
        const currentScrollY = pendingScrollY;
        const scrollingUp = currentScrollY < lastScrollY;

        if (!scrollingUp && currentScrollY > 50) {
          pagerControlsVisible = false;
        } else if (scrollingUp) {
          pagerControlsVisible = true;
        }

        showScrollTopFab = currentScrollY > SCROLL.SCROLL_TOP_THRESHOLD;

        lastScrollY = currentScrollY;
        pendingScrollTarget = null;

        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          pagerControlsVisible = true;
        }, SCROLL.SCROLL_IDLE_DELAY);
      }
    };

    const onScroll = (event: Event) => {
      // Pager-controls auto-hide: only for pager-section scroll
      // Debounce state updates via rAF to avoid triggering Svelte re-renders every frame
      const target = event.target as HTMLElement;
      if (!target.classList.contains('pager-section')) return;

      pendingScrollTarget = target;
      pendingScrollY = target.scrollTop;
      if (scrollRafId === null) {
        scrollRafId = requestAnimationFrame(flushScrollState);
      }
    };

    // Use event delegation on document for all scroll events
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });

    void tick().then(schedulePagerNavAlignment);

    return () => {
      motionQuery.removeEventListener('change', onMotionChange);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('scroll', onScroll, { capture: true });
      pagerEl?.removeEventListener('touchstart', handleTouchStart);
      pagerEl?.removeEventListener('touchmove', handleTouchMove);
      pagerEl?.removeEventListener('touchend', handleTouchEnd);
      if (pagerNavAlignRaf !== null) cancelAnimationFrame(pagerNavAlignRaf);
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
      if (scrollTimeout !== null) clearTimeout(scrollTimeout);
    };
  });

  function computeBMIFromInputs(h: string, w: string, _a: string) {
    const result = calculateBmi(h, w, unitSystem);

    if (isBmiResult(result)) {
      bmiValue = result.bmi;
      category = result.category;
      // Save to history (uses metric-converted values)
      saveBmiToHistory(result.bmi, result.heightCm, result.weightKg, _a);
    } else {
      bmiValue = null;
      category = null;
    }
  }

  async function handleCalculate() {
    if (calculating) return;
    calculating = true;

    triggerHaptic(HAPTIC.CALCULATE);

    // Calculate BMI synchronously (before any await) so that
    // bmiValue / category are available for the Gauge page.
    computeBMIFromInputs(height, weight, age);
    resultsRunId += 1;
    calculating = false;

    // Navigate to Gauge NOW — still in the synchronous click-handler
    // context so Svelte 5's {#key activeIndex} structural re-render
    // triggers reliably.
    goTo(2);

    // Show staging gear spinner during page transition
    stagingLoading = true;
    await tick();
    await new Promise((r) => setTimeout(r, STAGING_NOTIFY_DELAY));
    stagingLoading = false;

    // Show success notification (overlaid on the Gauge page)
    notifyType = 'success';
    notifyMessage = t('notify.success_msg');
    notifyButtonText = t('notify.continue_btn');
    showNotify = true;
  }

  async function confirmClearData() {
    // Show staging gear spinner before confirmation dialog
    stagingLoading = true;
    await tick();
    await new Promise((r) => setTimeout(r, STAGING_NOTIFY_DELAY));
    stagingLoading = false;

    // Show confirmation dialog
    notifyType = 'delete';
    notifyMessage = t('notify.delete_confirm');
    notifyButtonText = t('notify.delete');
    showNotify = true;
  }

  function clearAllData() {
    calculating = false;
    age = '';
    height = '';
    weight = '';
    gender = '';
    activity = '';
    bmiValue = null; // Gauge will show empty/neutral state
    category = null;
    resultsRunId += 1;

    if (browser) {
      storageRemove(STORAGE_KEYS.HISTORY);
      lastSavedBmi = null;
    }
  }

  // Animate range marker when BMI value changes
  $effect(() => {
    if (bmiValue !== null) {
      animateRangeMarker(rangeMarker);
    } else {
      lastMarker = 0;
      animatedMarker.set(0, { duration: 0 });
    }
  });

  onDestroy(() => {
    pageDestroyed = true;
    if (markerTimer) clearTimeout(markerTimer);
    if (switchingTimer) clearTimeout(switchingTimer);
    if (browser) document.body.classList.remove('is-switching');
  });

</script>

<svelte:head>
  <title>{t('meta.title')}</title>
  <meta name="description" content={t('meta.description')} />
  <meta property="og:title" content={t('meta.title')} />
  <meta property="og:description" content={t('meta.og_description')} />
  <meta name="twitter:title" content={t('meta.title')} />
  <meta name="twitter:description" content={t('meta.og_description')} />
</svelte:head>
<div
  class="pager-shell"
  role="region"
  aria-label={t('nav.aria_label')}
  bind:this={pagerEl}
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  use:passiveWheel
>
  <div class="pager-nav-shell">
    <nav
      bind:this={pagerNavEl}
      class="pager-nav"
      class:centered={pagerNavCentered}
      aria-label={t('nav.sections_aria')}
    >
      {#key $localeVersion}
        {#each sections as section, idx (section.id)}
          <button
            type="button"
            class="btn btn-ghost pager-tab"
            class:active={idx === activeIndex}
            aria-current={idx === activeIndex ? 'page' : undefined}
            onclick={() => { triggerHaptic(5); goTo(idx); }}
          >
            {t(section.labelKey)}
          </button>
        {/each}

        <button
          type="button"
          class="btn btn-ghost pager-tab pager-smooth"
          aria-label={t('nav.render_aria')}
          aria-pressed={smoothModeRequested}
          onclick={toggleSmoothMode}
        >
          <Bot class="render-spark" aria-hidden="true" />
          {t('nav.render')}
          <span class:render-on={smoothModeRequested} class:render-off={!smoothModeRequested}>
            {smoothModeStatus}
          </span>
        </button>

        <button
          type="button"
          class="btn btn-ghost pager-tab pager-theme"
          aria-label={t('nav.theme_aria')}
          aria-pressed={currentTheme !== 'blackhole'}
          onclick={toggleWallpaperTheme}
        >
          <Sparkles class="render-spark" aria-hidden="true" />
          {t('nav.theme')}
          <span class:theme-blackhole={currentTheme === 'blackhole'} class:theme-spaceship={currentTheme === 'spaceship'} class:theme-space={currentTheme === 'space'}>
            {themeLabel}
          </span>
        </button>
      {/key}

      <LanguageSwitcher />
    </nav>
  </div>

  <main class="pager-view">
    {#key activeIndex}
      <section
        class="pager-section"
        id={sections[activeIndex].id}
        data-pager-scroll="true"
        data-section-id={sections[activeIndex].id}
        in:pagerSpring={{
          x: pagerDirection * pagerMotionDistance,
          duration: pagerMotionDuration,
          phase: 'in',
          strength: reducedMotionEffective ? 0 : (smoothModeEnhanced ? SPRING_STRENGTH_ENHANCED : SPRING_STRENGTH_BASIC)
        }}
        out:pagerSpring={{
          x: -pagerDirection * pagerMotionDistance,
          duration: reducedMotionEffective
            ? 0
            : smoothModeRequested
              ? Math.round(pagerMotionDuration * PAGER_OUT_RATIO)
              : PAGER_OUT_BASIC,
          phase: 'out',
          strength: 0
        }}
      >
        {#if activeIndex === 0}
          <div class="main-container">
            <Hero />
          </div>
        {/if}

        {#if activeIndex === 1}
          <div class="main-container">
            <!-- BMI Calculator Section -->
            <section class="bmi-section">
              <div class="bmi-grid">
                <div class="form-card">
                  {#if BmiFormComponent}
                    <BmiFormComponent
                      bind:age
                      bind:height
                      bind:weight
                      bind:gender
                      bind:activity
                      bind:unitSystem
                      {calculating}
                      onClear={confirmClearData}
                      onCalculate={handleCalculate}
                      onNotify={(result) => {
                        if (result.action === 'import-validate' && result.text) {
                          pendingImportText = result.text;
                          notifyType = 'warn';
                          notifyMessage = t('notify.import_confirm', { n: result.recordCount ?? 0 });
                          notifyButtonText = t('notify.import_keep');
                          showNotify = true;
                        } else if (result.action === 'import-error') {
                          notifyType = 'error';
                          notifyMessage = result.error || t('notify.import_error');
                          notifyButtonText = t('notify.ok');
                          showNotify = true;
                        }
                      }}
                    />
                  {:else}
                    <div class="skeleton-form">
                      <div class="skeleton skeleton-input"></div>
                      <div class="skeleton skeleton-input"></div>
                      <div class="skeleton skeleton-input"></div>
                      <div class="skeleton skeleton-input" style="width:50%"></div>
                    </div>
                  {/if}
                </div>
                <div class="bmi-card">
                  {#key resultsRunId}
                    {#if BmiResultsComponent}
                      <BmiResultsComponent
                        {bmiValue}
                        {category}
                        {unitSystem}
                        height={height === '' ? null : parseFloat(height)}
                        weight={weight === '' ? null : parseFloat(weight)}
                        age={age === '' ? null : parseInt(age)}
                        gender={gender || null}
                        activity={activity || null}
                        reducedMotion={reducedMotionEffective}
                      />
                    {:else}
                      <div class="skeleton-card">
                        <div class="skeleton skeleton-circle"></div>
                        <div class="skeleton skeleton-line w-60 h-lg" style="margin:0 auto 1rem"></div>
                        <div class="skeleton skeleton-line w-80 h-md" style="margin:0 auto 0.5rem"></div>
                        <div class="skeleton skeleton-line w-40 h-sm" style="margin:0 auto 1.5rem"></div>
                        <div class="skeleton skeleton-line w-full h-sm"></div>
                        <div class="skeleton skeleton-line w-full h-sm"></div>
                        <div class="skeleton skeleton-line w-60 h-sm"></div>
                      </div>
                    {/if}
                  {/key}
                </div>
              </div>
            </section>
          </div>
        {/if}

        {#if activeIndex === 2}
          <div class="main-container">
            <div class="charts-section">
              {#if BmiRadialGaugeComponent}
                <BmiRadialGaugeComponent
                  bmi={bmiValue || 0}
                  category={category}
                  ultraSmooth={smoothModeRequested}
                />
              {:else}
                <div class="skeleton-card">
                  <div class="skeleton-gauge">
                    <div class="skeleton skeleton-ring"></div>
                    <div class="skeleton skeleton-line w-60 h-md" style="margin:0 auto"></div>
                    <div class="skeleton-bar">
                      <span class="skeleton" style="background:var(--cyan2-40)"></span>
                      <span class="skeleton" style="background:var(--green-50)"></span>
                      <span class="skeleton" style="background:var(--yellow-60)"></span>
                      <span class="skeleton" style="background:var(--red-50)"></span>
                    </div>
                  </div>
                </div>
              {/if}

              {#if BmiHealthRiskComponent}
                <BmiHealthRiskComponent
                  bmi={bmiValue}
                  category={category}
                />
              {:else}
                <div class="skeleton-card">
                  <div class="skeleton skeleton-line w-40 h-md" style="margin-bottom:1rem"></div>
                  <div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.75rem"></div>
                  <div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:1.5rem"></div>
                  <div class="skeleton skeleton-line w-80 h-sm"></div>
                  <div class="skeleton skeleton-line w-60 h-sm" style="margin-top:0.75rem"></div>
                </div>
              {/if}

              {#if BmiSnapshotComponent}
                <BmiSnapshotComponent
                  currentBmi={bmiValue}
                  category={category}
                />
              {:else}
                <div class="skeleton-card">
                  <div class="skeleton skeleton-line w-60 h-md" style="margin-bottom:1rem"></div>
                  <div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.75rem"></div>
                  <div class="skeleton skeleton-line w-80 h-sm"></div>
                </div>
              {/if}

              {#if BodyFatEstimateComponent}
                <BodyFatEstimateComponent
                  bmi={bmiValue}
                  age={age === '' ? null : parseInt(age)}
                />
              {:else}
                <div class="skeleton-card">
                  <div class="skeleton skeleton-circle"></div>
                  <div class="skeleton skeleton-line w-40 h-lg" style="margin:0 auto 1rem"></div>
                  <div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
                  <div class="skeleton skeleton-line w-full h-sm"></div>
                </div>
              {/if}

              {#if BmiGoalTrackerComponent}
                <BmiGoalTrackerComponent currentBmi={bmiValue} />
              {:else}
                <div class="skeleton-card">
                  <div class="skeleton skeleton-line w-60 h-sm" style="margin-bottom:0.75rem"></div>
                  <div class="skeleton skeleton-line w-full h-sm"></div>
                </div>
              {/if}

            </div>
          </div>
        {/if}

        {#if activeIndex === 3}
          <div class="main-container">
            <!-- Reference Table -->
            {#if ReferenceTableComponent}
              <ReferenceTableComponent />
            {:else}
              <div class="skeleton-card">
                <div class="skeleton skeleton-line w-60 h-lg" style="margin-bottom:1.5rem"></div>
                <div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
                <div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
                <div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
                <div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
                <div class="skeleton skeleton-line w-full h-sm"></div>
              </div>
            {/if}
          </div>
        {/if}

        {#if activeIndex === 4}
          {#key $localeVersion}
          <!-- About BMI Section -->
          <section class="about-bmi-section">
            <div class="main-container">
              <div class="section-header-v2">
                <h2 class="title">{t('about.title')}</h2>
                <p class="subtitle">{t('about.subtitle')}</p>
              </div>

              <div class="about-bmi-grid">
                <!-- What is BMI Card -->
                <div class="about-card">
                  <div class="about-card-header">
                    <Lightbulb class="Lightbulb" />
                    <h3>{t('about.what_is_title')}</h3>
                  </div>
                  <div class="about-card-content">
                    <p>
                      {@html t('about.what_is_p1')}
                    </p>
                    <p>
                      {@html t('about.what_is_p2')}
                    </p>
                    <p>
                      {@html t('about.what_is_p3')}
                    </p>
                  </div>
                </div>

                <!-- About Our App Card -->
                <div class="about-card">
                  <div class="about-card-header">
                    <Users class="Users" />
                    <h3>{t('about.app_title')}</h3>
                  </div>
                  <div class="about-card-content">
                    <p>
                      {@html t('about.app_desc')}
                    </p>
                    <div class="app-info">
                      <p class="info-row">
                        <PackageCheck class="PackageCheck" />
                        <strong>{t('about.version')}:</strong>Stellar v13.0 <span class="commit-id">({gitCommitId})</span>
                      </p>
                      <p class="info-row">
                        <GitBranch class="GitBranch" />
                        <strong>{t('about.branch')}:</strong>{gitBranch}
                      </p>
                      <p class="info-row">
                        <GitCompare class="GitCompare" />
                        <strong>{t('about.type_apps')}:</strong><span class="text-gradient-elegant">{t('about.open_source')}</span>
                      </p>
                      <p class="info-row">
                        <ShieldCheck class="ShieldCheck" />
                        <strong>{t('about.status')}:</strong>{t('about.status_stable')}
                      </p>
                      <p class="info-row">
                        <Activity class="Activity" />
                        <strong>{t('about.maintenance')}:</strong>{t('about.maintenance_active')}
                      </p>
                      <p class="info-row">
                        <Scale class="Scale" />
                        <strong>{t('about.license')}:</strong>GPL v3
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>
          {/key}
        {/if}

        {#if activeIndex === 5}
          {#key $localeVersion}
          <div class="main-container">
            <footer class="footer-disclaimer">
              <div class="disclaimer-icon">
                <AlertTriangle class="AlertTriangle" />
              </div>
              <p>
                {t('info.disclaimer')}
              </p>
            </footer>

            <div class="github-footer">
              <a
                href="https://github.com/oxyzenq/bmi"
                target="_blank"
                rel="noopener noreferrer"
                class="github-link"
              >
                <span>
                  {t('info.copyright', { n: currentYear })}
                </span>
              </a>
            </div>
          </div>
          {/key}
        {/if}
      </section>
    {/key}
  </main>

  <div class="pager-controls-shell" class:pager-hidden={!pagerControlsVisible}>
    <div class="pager-controls" aria-label="Section navigation">
      {#if activeIndex > 0}
        <button
          type="button"
          class="pager-btn-futuristic pager-btn-prev"
          aria-label="Previous section"
          onclick={prevSection}
        >
          <ChevronLeft aria-hidden="true" size={44} />
        </button>
      {:else}
        <div class="pager-btn-spacer" aria-hidden="true"></div>
      {/if}

      <button
        type="button"
        class="pager-btn-futuristic pager-btn-scroll-top"
        class:fab-visible={showScrollTopFab}
        aria-label="Scroll to top"
        onclick={scrollToTop}
      >
        <ChevronUp aria-hidden="true" size={36} />
      </button>

      {#if activeIndex < sections.length - 1}
        <button
          type="button"
          class="pager-btn-futuristic pager-btn-next"
          aria-label="Next section"
          onclick={nextSection}
        >
          <ChevronRight aria-hidden="true" size={44} />
        </button>
      {:else}
        <div class="pager-arrow-spacer" aria-hidden="true"></div>
      {/if}
    </div>
  </div>

</div>

{#if showNotify}
  <NotifyFloat
    show={showNotify}
    type={notifyType}
    message={notifyMessage}
    buttonText={notifyButtonText}
    onContinue={async () => {
      if (notifyType === 'warn' && pendingImportText) {
        // User confirmed import — perform it now
        const result = await importBmiHistory(pendingImportText);
        pendingImportText = null;
        if (result.success) {
          const integrityMsg = result.integrityVerified
            ? (result.integrityVersion === 3 ? ' \u2713 Integrity verified (HMAC-SHA256)' : ' \u2713 Integrity verified (legacy)')
            : '';
          notifyType = 'success';
          notifyMessage = `Successfully imported ${result.count} record${result.count === 1 ? '' : 's'}!${integrityMsg}`;
          notifyButtonText = 'OK';
        } else {
          notifyType = 'delete';
          notifyMessage = result.error || 'Import failed.';
          notifyButtonText = 'OK';
        }
      } else if (notifyType === 'success') {
        // Navigation to Gauge already happened in handleCalculate
        // (synchronous click-handler context). Just dismiss the notification.
        showNotify = false;
      } else if (notifyType === 'error') {
        // Error notification dismissed - just close
        showNotify = false;
      } else if (notifyType === 'delete') {
        showNotify = false;
        // Brief staging spinner after delete confirmation
        stagingLoading = true;
        await tick();
        await new Promise((r) => setTimeout(r, 800));
        stagingLoading = false;
        clearAllData();
      }
    }}
    onClose={() => {
      pendingImportText = null;
      showNotify = false;
    }}
    onCancel={() => {
      pendingImportText = null;
      showNotify = false;
    }}
  />
{/if}

{#if stagingLoading}
  <div class="staging-backdrop staging-visible">
    <div class="staging-spinner-wrap">
      <Settings class="staging-gear-icon" size={48} />
      <span class="staging-text">{t('crypto.preparing')}</span>
    </div>
  </div>
{/if}

<style>
  .pager-shell {
    height: 100svh;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding-top: 0;
    overflow: hidden;
    touch-action: pan-y pan-x pinch-zoom;
    position: relative;
    --pager-top-inset: calc(env(safe-area-inset-top, 0px) + 54px);
    --pager-edge-fade: 100px;
    --nav-bar-h: 54px;
  }

  .pager-shell::before,
  .pager-shell::after {
    content: '';
    position: fixed;
    left: 0;
    right: 0;
    pointer-events: none;
    z-index: 19;
  }

  .pager-shell::before {
    top: var(--nav-bar-h);
    height: var(--pager-edge-fade);
    background: linear-gradient(to bottom, var(--k-92), var(--k-0));
  }

  .pager-shell::after {
    bottom: 0;
    height: 0;
    background: none;
    pointer-events: none;
  }

  .pager-nav {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.35rem;
    padding: 0 0.85rem 0.55rem 0.85rem;
    overflow-x: auto;
    scrollbar-width: none;
    min-width: 0;
    width: 100%;
    height: var(--nav-bar-h);
    box-sizing: border-box;
  }

  .pager-nav.centered {
    justify-content: center;
  }

  .pager-nav-shell {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    background: var(--k-50);
    /* backdrop-filter owned by nav.css (with -webkit- prefix + !important) */
    border: none;
    border-bottom: 1px solid var(--w-8);
    box-shadow:
      0 1px 0 0 var(--w-4),
      0 8px 32px var(--k-50),
      0 2px 16px var(--k-32),
      inset 0 1px 0 var(--w-6);
    border-radius: 0 0 22px 22px;
    margin-inline: 0;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    transform: none;
    z-index: 20;
    padding-top: env(safe-area-inset-top, 0px);
    height: calc(var(--nav-bar-h) + env(safe-area-inset-top, 0px));
    box-sizing: border-box;
    display: flex;
    align-items: flex-end;
  }

  /* Aurora glow accent line at bottom of navbar */
  .pager-nav-shell::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 10%;
    right: 10%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--aurora-glow, #b266ff) 30%,
      var(--cosmic-blue) 50%,
      var(--aurora-glow, #b266ff) 70%,
      transparent 100%
    );
    opacity: 0.5;
    pointer-events: none;
  }

  .pager-nav::-webkit-scrollbar {
    display: none;
  }

  /* .pager-tab styles moved to global nav.css for cross-component use (LanguageSwitcher) */

  .pager-smooth {
    opacity: 1;
    font-size: 0.82rem;
  }

  .pager-smooth :global(.render-spark) {
    color: var(--cosmic-purple) !important;
  }

  .pager-smooth .render-on {
    color: var(--cat-green-toast);
  }

  .pager-smooth .render-off {
    color: var(--cat-amber-95);
  }

  .pager-theme :global(.render-spark) {
    color: var(--aurora-glow, #b266ff) !important;
    transition: color 0.3s ease, filter 0.3s ease;
  }

  .pager-theme .theme-blackhole {
    color: #b266ff;
    font-weight: 600;
    text-shadow: 0 0 8px var(--purple2-40, rgba(178, 102, 255, 0.4));
  }

  .pager-theme .theme-spaceship {
    color: #00f0ff;
    font-weight: 600;
    text-shadow: 0 0 8px var(--cyan2-40);
  }

  .pager-theme .theme-space {
    color: var(--cosmic-blue);
    font-weight: 600;
  }

  /* .pager-tab.active moved to global nav.css */

  .pager-view {
    flex: 1;
    overflow: hidden;
    padding-bottom: 0.5rem;
    position: relative;
    min-height: 0;
  }

  .pager-section {
    height: 100%;
    position: absolute;
    inset: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    /* will-change removed: touch devices get will-change: scroll-position
       via T-2 in responsive.css; desktop doesn't need compositor promotion.
       Permanent will-change wastes GPU memory on both platforms. */
    scrollbar-width: none;
    contain: style;
    padding-top: calc(var(--pager-top-inset) + 0.5rem);
    padding-bottom: calc(1.5rem + 58px + 1.5rem + env(safe-area-inset-bottom, 0px));
    scroll-padding-top: calc(var(--pager-top-inset) + 0.5rem);
    scroll-padding-bottom: calc(1.5rem + 58px + 1.5rem + env(safe-area-inset-bottom, 0px));
  }

  .pager-section::-webkit-scrollbar {
    display: none;
  }

  @media (min-width: 900px) {
    .pager-nav {
      justify-content: center;
      padding-inline: 2rem;
    }
  }

  @media (max-width: 600px) {
    .pager-nav {
      gap: 0.25rem;
      padding: 0 0.55rem 0.45rem 0.55rem;
      overflow-x: auto;
    }

    /* .pager-tab responsive moved to global nav.css */

    .pager-smooth {
      font-size: 0.76rem;
    }
  }

  .pager-btn-spacer {
    width: 56px;
    height: 56px;
  }

  @media (max-width: 480px) {
    .pager-btn-spacer {
      width: 50px;
      height: 50px;
    }
  }
</style>

<!-- styles moved to global-styles.css -->
