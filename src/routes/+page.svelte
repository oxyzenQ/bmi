<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { backOut, cubicOut } from 'svelte/easing';
  import { tweened } from 'svelte/motion';
  import { browser } from '$app/environment';
  import { getPerformanceTier } from '$lib/utils/performance';
  import { importBmiHistory } from '$lib/utils/history-io';
  import Hero from '$lib/ui/Hero.svelte';
  import NotifyFloat from '$lib/components/NotifyFloat.svelte';
  import {
    Lightbulb,
    Users,
    GitBranch,
    GitCompare,
    PackageCheck,
    Wrench,
    AlertTriangle,
    Scale,
    Bot,
    ChevronLeft,
    ChevronRight
  } from 'lucide-svelte';
  type BmiFormComponentType = typeof import('$lib/components/BmiForm.svelte').default;
  type BmiResultsComponentType = typeof import('$lib/components/BmiResults.svelte').default;
  type BmiRadialGaugeComponentType = typeof import('$lib/components/BmiRadialGauge.svelte').default;
  type BmiHealthRiskComponentType = typeof import('$lib/components/BmiHealthRisk.svelte').default;
  type BmiSnapshotComponentType = typeof import('$lib/components/BmiSnapshot.svelte').default;
  type BodyFatEstimateComponentType = typeof import('$lib/components/BodyFatEstimate.svelte').default;
  let BmiFormComponent: BmiFormComponentType | null = $state(null);
  let BmiResultsComponent: BmiResultsComponentType | null = $state(null);
  let BmiRadialGaugeComponent: BmiRadialGaugeComponentType | null = $state(null);
  let BmiHealthRiskComponent: BmiHealthRiskComponentType | null = $state(null);
  let BmiSnapshotComponent: BmiSnapshotComponentType | null = $state(null);
  let BodyFatEstimateComponent: BodyFatEstimateComponentType | null = $state(null);
  let calculatorLoad: Promise<void> | null = null;
  let gaugeLoad: Promise<void> | null = null;
  let healthRiskLoad: Promise<void> | null = null;
  let snapshotLoad: Promise<void> | null = null;
  let bodyFatLoad: Promise<void> | null = null;

  // Track if BMI was already saved to prevent duplicates
  let lastSavedBmi: number | null = null;

  function saveBmiToHistory(bmi: number, h: number, w: number, a: string) {
    if (!browser) return;
    if (!window.isSecureContext) return; // Don't store health data in insecure contexts
    if (lastSavedBmi === bmi) return; // Prevent duplicate saves

    let history: Array<{ timestamp: number; bmi: number; height: number; weight: number; age?: number }> = [];
    try {
      const stored = localStorage.getItem('bmi.history');
      if (stored) history = JSON.parse(stored);
    } catch {
      // Corrupted data — reset history silently
      localStorage.removeItem('bmi.history');
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

    localStorage.setItem('bmi.history', JSON.stringify(filtered));
    lastSavedBmi = bmi;
  }

  function ensureHealthRisk() {
    if (!browser) return Promise.resolve();
    if (BmiHealthRiskComponent) return Promise.resolve();
    if (!healthRiskLoad) {
      healthRiskLoad = import('$lib/components/BmiHealthRisk.svelte')
        .then((mod) => {
          BmiHealthRiskComponent = mod.default;
        })
        .finally(() => {
          healthRiskLoad = null;
        });
    }
    return healthRiskLoad;
  }

  function ensureSnapshot() {
    if (!browser) return Promise.resolve();
    if (BmiSnapshotComponent) return Promise.resolve();
    if (!snapshotLoad) {
      snapshotLoad = import('$lib/components/BmiSnapshot.svelte')
        .then((mod) => {
          BmiSnapshotComponent = mod.default;
        })
        .finally(() => {
          snapshotLoad = null;
        });
    }
    return snapshotLoad;
  }

  function ensureBodyFat() {
    if (!browser) return Promise.resolve();
    if (BodyFatEstimateComponent) return Promise.resolve();
    if (!bodyFatLoad) {
      bodyFatLoad = import('$lib/components/BodyFatEstimate.svelte')
        .then((mod) => {
          BodyFatEstimateComponent = mod.default;
        })
        .finally(() => {
          bodyFatLoad = null;
        });
    }
    return bodyFatLoad;
  }

  type ReferenceTableComponentType = typeof import('$lib/components/ReferenceTable.svelte').default;
  let ReferenceTableComponent: ReferenceTableComponentType | null = $state(null);

  let referenceLoad: Promise<void> | null = null;

  function ensureCalculatorComponents() {
    if (!browser) return Promise.resolve();
    if (BmiFormComponent && BmiResultsComponent) return Promise.resolve();
    if (!calculatorLoad) {
      calculatorLoad = Promise.all([
        import('$lib/components/BmiForm.svelte'),
        import('$lib/components/BmiResults.svelte')
      ])
        .then(([form, results]) => {
          BmiFormComponent = form.default;
          BmiResultsComponent = results.default;
        })
        .finally(() => {
          calculatorLoad = null;
        });
    }
    return calculatorLoad;
  }

  function ensureGaugeComponents() {
    if (!browser) return Promise.resolve();
    if (BmiRadialGaugeComponent) return Promise.resolve();
    if (!gaugeLoad) {
      gaugeLoad = import('$lib/components/BmiRadialGauge.svelte')
        .then((mod) => {
          BmiRadialGaugeComponent = mod.default;
        })
        .finally(() => {
          gaugeLoad = null;
        });
    }
    return gaugeLoad;
  }

  function ensureReferenceTable() {
    if (!browser) return Promise.resolve();
    if (ReferenceTableComponent) return Promise.resolve();
    if (!referenceLoad) {
      referenceLoad = import('$lib/components/ReferenceTable.svelte')
        .then((mod) => {
          ReferenceTableComponent = mod.default;
        })
        .finally(() => {
          referenceLoad = null;
        });
    }
    return referenceLoad;
  }
  let bmiValue: number | null = $state(null);
  let category: string | null = $state(null);

  // Form inputs default empty strings for validation UX
  let age: string = $state('');
  let height: string = $state('');
  let weight: string = $state('');
  let unitSystem = $state<'metric' | 'imperial'>('metric');
  let unitSystemInitialized = $state(false);

  let calculating = $state(false);
  let resultsRunId = $state(0);

  // Notification state
  let showNotify = $state(false);
  let notifyType = $state<'success' | 'delete' | 'warn'>('success');
  let notifyMessage = $state('');
  let notifyButtonText = $state('');
  let pendingImportText = $state<string | null>(null);


  const currentYear = new Date().getFullYear();

  // Git info - injected at build time by Vite
  const gitCommitId = typeof __GIT_COMMIT_ID__ !== 'undefined' ? __GIT_COMMIT_ID__ : 'dev';
  const gitBranch = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'main';

  const sections = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'calculator', label: 'Calculator' },
    { id: 'gauge', label: 'Gauge' },
    { id: 'reference', label: 'Reference' },
    { id: 'about', label: 'About' },
    { id: 'info', label: 'Info' }
  ] as const;

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

  let activePointerId: number | null = null;
  let lastWheelNavAt = 0;
  let switchingTimer: ReturnType<typeof setTimeout> | null = null;
  let pageDestroyed = $state(false);

  function broadcastSmoothMode(enabled: boolean) {
    if (!browser) return;
    window.dispatchEvent(new CustomEvent('bmi:smoothMode', { detail: { enabled } }));
  }

  function toggleSmoothMode() {
    smoothModeRequested = !smoothModeRequested;
    if (browser) {
      localStorage.setItem('bmi.renderMode', smoothModeRequested ? '1' : '0');
      localStorage.removeItem('bmi.smoothMode');
      localStorage.removeItem('bmi.ultraSmooth');
      document.documentElement.dataset.graphics = smoothModeRequested ? 'render' : 'basic';
      broadcastSmoothMode(smoothModeRequested);
      void tick().then(schedulePagerNavAlignment);
    }
  }

  let reducedMotionEffective = $derived(prefersReducedMotion && !smoothModeRequested);
  let smoothModeEnhanced = $derived(smoothModeRequested && perfTier !== 'low');
  let smoothModeStatus = $derived(smoothModeRequested ? 'On' : 'Off');

  // Persist unit system in localStorage (only after initialization from onMount)
  $effect(() => {
    if (browser && unitSystemInitialized) {
      try {
        localStorage.setItem('bmi.unitSystem', unitSystem);
      } catch {
        // localStorage unavailable
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

  const BMI_BAR_MIN = 12;
  const BMI_BAR_MAX = 40;
  const BMI_UNDER_MAX = 18.5;
  const BMI_NORMAL_MAX = 24.9;
  const BMI_OVER_MAX = 29.9;

  // Animation duration constants (ms)
  const MARKER_ANIM_HIGH = 860;
  const MARKER_ANIM_MEDIUM = 780;
  const MARKER_ANIM_LOW = 680;
  const OVERSHOOT_RATIO = 0.62;
  const SETTLE_RATIO = 0.48;
  const SETTLE_DELAY_OFFSET = 80;

  // Pager motion duration constants (ms)
  const PAGER_DUR_HIGH = 620;
  const PAGER_DUR_MEDIUM = 540;
  const PAGER_DUR_LOW = 460;
  const PAGER_DUR_BASIC = 260;
  const PAGER_OUT_RATIO = 0.72;
  const PAGER_OUT_BASIC = 210;

  // Pager motion distance constants (px)
  const PAGER_DIST_HIGH = 220;
  const PAGER_DIST_MEDIUM = 190;
  const PAGER_DIST_LOW = 160;
  const PAGER_DIST_BASIC = 120;

  // Other animation constants
  const SWITCHING_DELAY = 140;
  const SPRING_STRENGTH_ENHANCED = 0.14;
  const SPRING_STRENGTH_BASIC = 0.08;

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
    if (!opts?.skipHash) setHash(sections[activeIndex].id);
    void resetSectionScroll();
  }

  function prevSection() {
    if (activeIndex <= 0) return;
    goTo(activeIndex - 1);
  }

  function nextSection() {
    if (activeIndex >= sections.length - 1) return;
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

  function handleKeydown(event: KeyboardEvent) {
    if (isEditableTarget(event.target)) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prevSection();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextSection();
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, label')) return;
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

    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) {
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

  function handleWheel(event: WheelEvent) {
    if (isEditableTarget(event.target)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.pager-nav, .pager-nav-shell, .pager-controls, .pager-controls-shell')) return;

    const now = Date.now();
    if (now - lastWheelNavAt < 520) return;

    const dx = event.deltaX;
    const dy = event.deltaY;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > 12) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.8) return;

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
      void ensureCalculatorComponents();
    }
    if (activeIndex === 2) {
      void ensureGaugeComponents();
      void ensureHealthRisk();
      void ensureSnapshot();
      void ensureBodyFat();
    }
    if (activeIndex === 3) void ensureReferenceTable();
  });

  onMount(() => {
    if (!browser) return;
    perfTier = getPerformanceTier();
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const storedRenderMode = localStorage.getItem('bmi.renderMode');
    if (storedRenderMode === null) {
      const storedSmooth = localStorage.getItem('bmi.smoothMode');
      const storedUltra = localStorage.getItem('bmi.ultraSmooth');
      const hasLegacy = storedSmooth !== null || storedUltra !== null;
      smoothModeRequested =
        hasLegacy
          ? (storedSmooth === '1' || storedSmooth === 'true' || storedUltra === '1' || storedUltra === 'true')
          : true;
      localStorage.setItem('bmi.renderMode', smoothModeRequested ? '1' : '0');
      localStorage.removeItem('bmi.smoothMode');
      localStorage.removeItem('bmi.ultraSmooth');
    } else {
      smoothModeRequested = storedRenderMode === '1' || storedRenderMode === 'true';
      localStorage.removeItem('bmi.smoothMode');
      localStorage.removeItem('bmi.ultraSmooth');
    }

    document.documentElement.dataset.graphics = smoothModeRequested ? 'render' : 'basic';
    document.documentElement.dataset.performanceTier = perfTier;
    broadcastSmoothMode(smoothModeRequested);

    // Read unit system preference from localStorage
    try {
      const storedUnit = localStorage.getItem('bmi.unitSystem');
      if (storedUnit === 'imperial' || storedUnit === 'metric') {
        unitSystem = storedUnit;
      }
    } catch {
      // localStorage unavailable
    }
    unitSystemInitialized = true;

    const idx = indexFromHash(window.location.hash);
    if (idx !== null) goTo(idx, { skipHash: true, skipSwitching: true });
    setHash(sections[activeIndex].id);

    const onHashChange = () => {
      const next = indexFromHash(window.location.hash);
      if (next !== null && next !== activeIndex) goTo(next, { skipHash: true });
    };

    // Cross-tab sync for unit system via storage event
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bmi.unitSystem') {
        if (e.newValue === 'imperial' || e.newValue === 'metric') {
          unitSystem = e.newValue;
        } else if (e.newValue === null) {
          unitSystem = 'metric';
        }
      }
    };
    window.addEventListener('storage', onStorage);

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('keydown', handleKeydown);

    const onResize = () => schedulePagerNavAlignment();
    window.addEventListener('resize', onResize);

    // Unified scroll listener: is-scrolling class + pager-controls auto-hide
    let isScrolling = false;
    let isScrollingTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = (event: Event) => {
      // Scroll optimizer: add is-scrolling class during active scroll
      if (!isScrolling) {
        isScrolling = true;
        document.body.classList.add('is-scrolling');
      }
      if (isScrollingTimer) clearTimeout(isScrollingTimer);
      isScrollingTimer = setTimeout(() => {
        isScrolling = false;
        document.body.classList.remove('is-scrolling');
      }, 150);

      // Pager-controls auto-hide: only for pager-section scroll
      const target = event.target as HTMLElement;
      if (!target.classList.contains('pager-section')) return;

      const currentScrollY = target.scrollTop;
      const scrollingUp = currentScrollY < lastScrollY;

      if (!scrollingUp && currentScrollY > 50) {
        pagerControlsVisible = false;
      } else if (scrollingUp) {
        pagerControlsVisible = true;
      }

      lastScrollY = currentScrollY;

      // Show after idle scroll
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        pagerControlsVisible = true;
      }, 2000);
    };

    // Use event delegation on document for all scroll events
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });

    void tick().then(schedulePagerNavAlignment);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (pagerNavAlignRaf !== null) cancelAnimationFrame(pagerNavAlignRaf);
      if (scrollTimeout !== null) clearTimeout(scrollTimeout);
      if (isScrollingTimer) clearTimeout(isScrollingTimer);
      document.body.classList.remove('is-scrolling');
    };
  });

  function computeBMIFromInputs(h: string, w: string, _a: string) {
    let parsedHeight = parseFloat(h);
    let parsedWeight = parseFloat(w);

    // Convert imperial to metric before calculation
    if (unitSystem === 'imperial') {
      parsedHeight = parsedHeight * 2.54; // inches to cm
      parsedWeight = parsedWeight * 0.453592; // lbs to kg
    }

    if (
      Number.isFinite(parsedHeight) &&
      Number.isFinite(parsedWeight) &&
      parsedHeight > 0 &&
      parsedHeight <= 310 &&
      parsedWeight > 0 &&
      parsedWeight <= 1000
    ) {
      const heightInM = parsedHeight / 100;
      const bmi = parsedWeight / (heightInM * heightInM);
      bmiValue = parseFloat(bmi.toFixed(2));

      // Save to history
      saveBmiToHistory(bmiValue, parsedHeight, parsedWeight, _a);

      // Determine category with improved accuracy
      if (bmi < 18.5) {
        category = 'Underweight';
      } else if (bmi >= 18.5 && bmi < 25.0) {
        category = 'Normal Weight';
      } else if (bmi >= 25.0 && bmi < 30.0) {
        category = 'Overweight';
      } else {
        category = 'Obese';
      }
    } else {
      bmiValue = null;
      category = null;
    }
  }

  async function handleCalculate() {
    if (calculating) return;
    calculating = true;

    // Calculate BMI synchronously (before any await) so that
    // bmiValue / category are available for the Gauge page.
    computeBMIFromInputs(height, weight, age);
    resultsRunId += 1;
    calculating = false;

    // Navigate to Gauge NOW — still in the synchronous click-handler
    // context so Svelte 5's {#key activeIndex} structural re-render
    // triggers reliably.  Previous approaches (setTimeout / tick().then)
    // ran goTo() inside async callbacks where {#key} failed silently,
    // leaving activeIndex desynced from the DOM.
    // The notification will appear as an overlay on top of the Gauge page.
    goTo(2);

    // Brief delay so the page transition begins before the
    // notification overlay fades in on top of Gauge.
    const overlayDelay = reducedMotionEffective ? 30 : 180;
    await new Promise((r) => setTimeout(r, overlayDelay));

    // Show success notification (overlaid on the Gauge page)
    notifyType = 'success';
    notifyMessage = 'Your BMI has been calculated successfully!';
    notifyButtonText = 'Continue to see';
    showNotify = true;
  }

  function confirmClearData() {
    // Show confirmation dialog first - don't clear anything yet
    notifyType = 'delete';
    notifyMessage = 'Are you sure you want to delete all data? This action cannot be undone.';
    notifyButtonText = 'Delete';
    showNotify = true;
  }

  function clearAllData() {
    calculating = false;
    age = '';
    height = '';
    weight = '';
    bmiValue = null; // Gauge will show empty/neutral state
    category = null;
    resultsRunId += 1;

    // Clear localStorage history to reset "Your Best"
    if (browser) {
      localStorage.removeItem('bmi.history');
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
  <title>BMI Calculator - Calculate Your Body Mass Index</title>
  <meta name="description" content="Calculate your BMI with our modern, accessible calculator. Get instant results, health recommendations, and learn about BMI categories." />
</svelte:head>

<div
  class="pager-shell"
  role="region"
  aria-label="BMI Calculator"
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
      aria-label="Sections"
    >
      {#each sections as section, idx (section.id)}
        <button
          type="button"
          class="btn btn-ghost pager-tab"
          class:active={idx === activeIndex}
          aria-current={idx === activeIndex ? 'page' : undefined}
          onclick={() => goTo(idx)}
        >
          {section.label}
        </button>
      {/each}

      <button
        type="button"
        class="btn btn-ghost pager-tab pager-smooth"
        aria-label="Toggle render mode"
        aria-pressed={smoothModeRequested}
        onclick={toggleSmoothMode}
      >
        <Bot class="render-spark" aria-hidden="true" />
        Render :
        <span class:render-on={smoothModeRequested} class:render-off={!smoothModeRequested}>
          {smoothModeStatus}
        </span>
      </button>
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
                      bind:unitSystem
                      {calculating}
                      onClear={confirmClearData}
                      onCalculate={handleCalculate}
                      onNotify={(result) => {
                        if (result.action === 'import-validate' && result.text) {
                          pendingImportText = result.text;
                          notifyType = 'warn';
                          notifyMessage = `Sure to import your data? ${result.recordCount} record${(result.recordCount ?? 0) === 1 ? '' : 's'} found. Be careful with current data because it will be overridden.`;
                          notifyButtonText = 'Keep Import';
                          showNotify = true;
                        } else if (result.action === 'import-error') {
                          notifyType = 'delete';
                          notifyMessage = result.error || 'Import failed. Please check the file format.';
                          notifyButtonText = 'OK';
                          showNotify = true;
                        }
                      }}
                    />
                  {/if}
                </div>
                <div class="bmi-card">
                  {#key resultsRunId}
                    {#if BmiResultsComponent}
                      <BmiResultsComponent
                        {bmiValue}
                        {category}
                        age={age === '' ? null : parseInt(age)}
                        reducedMotion={reducedMotionEffective}
                      />
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
              {/if}

              {#if BmiHealthRiskComponent}
                <BmiHealthRiskComponent
                  bmi={bmiValue}
                  category={category}
                />
              {/if}

              {#if BmiSnapshotComponent}
                <BmiSnapshotComponent
                  currentBmi={bmiValue}
                  category={category}
                />
              {/if}

              {#if BodyFatEstimateComponent}
                <BodyFatEstimateComponent
                  bmi={bmiValue}
                  age={age === '' ? null : parseInt(age)}
                />
              {/if}

            </div>
          </div>
        {/if}

        {#if activeIndex === 3}
          <div class="main-container">
            <!-- Reference Table -->
            {#if ReferenceTableComponent}
              <ReferenceTableComponent />
            {/if}
          </div>
        {/if}

        {#if activeIndex === 4}
          <!-- About BMI Section -->
          <section class="about-bmi-section">
            <div class="main-container">
              <div class="section-header-v2">
                <h2 class="title">About BMI</h2>
                <p class="subtitle">Understanding Body Mass Index and our application</p>
              </div>

              <div class="about-bmi-grid">
                <!-- What is BMI Card -->
                <div class="about-card">
                  <div class="about-card-header">
                    <Lightbulb class="Lightbulb" />
                    <h3>What is BMI?</h3>
                  </div>
                  <div class="about-card-content">
                    <p>
                      Body Mass Index (BMI) is a simple weight‑for‑height index: weight (kg) divided by height (m) squared.
                      It’s a quick population‑level screening tool to gauge potential health risk.
                    </p>
                    <p>
                      Adult ranges: <em>Underweight</em> (&lt; 18.5), <em>Normal</em> (18.5–24.9), <em>Overweight</em> (25.0–29.9),
                      <em>Obese</em> (≥ 30).
                    </p>
                    <p>
                      Limitations: BMI doesn’t distinguish fat vs muscle or fat distribution. Use it alongside waist circumference,
                      body‑fat %, lifestyle factors, and clinical assessment.
                    </p>
                  </div>
                </div>

                <!-- About Our App Card -->
                <div class="about-card">
                  <div class="about-card-header">
                    <Users class="Users" />
                    <h3>About Our BMI App</h3>
                  </div>
                  <div class="about-card-content">
                    <p>
                      Our BMI app features a modern and clean design, developed by <strong>Team LOGIGO</strong>.
                      The team includes Rezky (Project Lead), Fiqih (Menu Design), Agus (Competitor Research),
                      Virlan (Login Functionality), Andre (Graph and BMI Calculation Functions), and Ferdian (Website Testing).
                      Thank you for your support!
                    </p>
                    <div class="app-info">
                      <p class="info-row">
                        <PackageCheck class="PackageCheck" />
                        <strong>Version:</strong>Stellar-10.0 <span class="commit-id">({gitCommitId})</span>
                      </p>
                      <p class="info-row">
                        <GitBranch class="GitBranch" />
                        <strong>Branch:</strong>{gitBranch}
                      </p>
                      <p class="info-row">
                        <GitCompare class="GitCompare" />
                        <strong>Type Apps:</strong><span class="text-gradient-elegant">Open Source Project</span>
                      </p>
                      <p class="info-row">
                        <Wrench class="Wrench" />
                        <strong>Status:</strong>Maintenance
                      </p>
                      <p class="info-row">
                        <Scale class="Scale" />
                        <strong>License:</strong>GPL v3
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        {/if}

        {#if activeIndex === 5}
          <div class="main-container">
            <footer class="footer-disclaimer">
              <div class="disclaimer-icon">
                <AlertTriangle class="AlertTriangle" />
              </div>
              <p>
                BMI is a screening tool and should not be used as a sole diagnostic method.
                Please consult healthcare professionals for comprehensive health assessment.
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
                  &copy; 2025-{currentYear} Rezky Nightky. All rights reserved.
                </span>
              </a>
            </div>
          </div>
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
          <ChevronLeft aria-hidden="true" size={24} />
        </button>
      {:else}
        <div class="pager-btn-spacer" aria-hidden="true"></div>
      {/if}

      {#if activeIndex < sections.length - 1}
        <button
          type="button"
          class="pager-btn-futuristic pager-btn-next"
          aria-label="Next section"
          onclick={nextSection}
        >
          <ChevronRight aria-hidden="true" size={24} />
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
          const checksumMsg = result.checksumVerified ? ' ✓ Checksum verified' : '';
          notifyType = 'success';
          notifyMessage = `Successfully imported ${result.count} record${result.count === 1 ? '' : 's'}!${checksumMsg}`;
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
      } else if (notifyType === 'delete') {
        showNotify = false;
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

<style>
  .pager-shell {
    height: 100svh;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding-top: 0;
    overflow: hidden;
    touch-action: pan-y pinch-zoom;
    position: relative;
    --pager-top-inset: calc(0.75rem + env(safe-area-inset-top, 0px) + 56px);
    --pager-edge-fade: 120px;
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
    top: 0;
    height: calc(0.75rem + env(safe-area-inset-top, 0px) + var(--pager-edge-fade));
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.98), rgba(0, 0, 0, 0));
  }

  .pager-shell::after {
    bottom: 0;
    height: calc(0.75rem + env(safe-area-inset-bottom, 0px) + var(--pager-edge-fade));
    background: linear-gradient(to top, rgba(0, 0, 0, 0.98), rgba(0, 0, 0, 0));
  }

  .pager-nav {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    min-width: 0;
  }

  .pager-nav.centered {
    justify-content: center;
  }

  .pager-nav-shell {
    width: calc(100% - 1.5rem);
    max-width: 820px;
    min-width: 0;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(14px) saturate(165%);
    -webkit-backdrop-filter: blur(14px) saturate(165%);
    border: var(--btn-border);
    box-shadow: var(--btn-shadow);
    border-radius: 9999px;
    margin-inline: auto;
    position: absolute;
    top: calc(0.75rem + env(safe-area-inset-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    isolation: isolate;
  }

  .pager-nav-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    pointer-events: none;
    z-index: 0;
  }

  .pager-nav {
    position: relative;
    z-index: 1;
  }

  .pager-nav::-webkit-scrollbar {
    display: none;
  }

  .pager-tab {
    height: 38px;
    padding-inline: 0.9rem;
    font-size: 0.9rem;
    border-radius: 9999px;
    white-space: nowrap;
    opacity: 0.86;
    flex: 0 0 auto;
    min-width: max-content;
  }

  .pager-smooth {
    opacity: 1;
  }

  .pager-smooth :global(.render-spark) {
    color: var(--cosmic-purple) !important;
  }

  .pager-smooth .render-on {
    color: #00c853;
  }

  .pager-smooth .render-off {
    color: #ffd600;
  }

  .pager-tab.active {
    opacity: 1;
    background: rgba(255, 255, 255, 0.07);
    border-color: color-mix(in oklab, var(--aurora-core) 55%, rgba(255, 255, 255, 0.12));
    box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.38),
      0 0 18px color-mix(in oklab, var(--cosmic-purple) 28%, transparent);
    transform: translateY(-1px);
  }

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
    will-change: transform, opacity;
    scrollbar-width: none;
    contain: layout paint style;
    padding-top: calc(1rem + var(--pager-top-inset));
    padding-bottom: calc(0.75rem + 56px + 0.75rem + env(safe-area-inset-bottom, 0px));
    scroll-padding-top: calc(1rem + var(--pager-top-inset));
    scroll-padding-bottom: calc(0.75rem + 56px + 0.75rem + env(safe-area-inset-bottom, 0px));
  }

  .pager-section::-webkit-scrollbar {
    display: none;
  }

  @media (min-width: 900px) {
    .pager-nav {
      justify-content: center;
    }
  }

  @media (max-width: 600px) {
    .pager-nav {
      gap: 0.35rem;
      padding: 0.45rem 0.6rem;
    }

    .pager-tab {
      height: 36px;
      padding-inline: 0.75rem;
      font-size: 0.85rem;
    }
  }

  .pager-controls-shell {
    width: calc(100% - 1.5rem);
    max-width: 820px;
    min-width: 0;
    overflow: visible;
    background: transparent;
    margin-inline: auto;
    position: absolute;
    bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  }

  .pager-controls-shell.pager-hidden {
    transform: translateX(-50%) translateY(calc(100% + 1rem));
    opacity: 0;
    pointer-events: none;
  }

  .pager-btn-spacer {
    width: 56px;
    height: 56px;
  }

  @media (max-width: 480px) {
    .pager-btn-spacer {
      width: 52px;
      height: 52px;
    }
  }
</style>

<!-- styles moved to global-styles.css -->
