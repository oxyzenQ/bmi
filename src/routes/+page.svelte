<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { backOut, cubicOut } from 'svelte/easing';
  import { tweened } from 'svelte/motion';
  import { browser } from '$app/environment';
  import { getPerformanceTier } from '$lib/utils/performance';
  import Hero from '$lib/ui/Hero.svelte';

  type BmiFormComponentType = typeof import('$lib/components/BmiForm.svelte').default;
  type BmiResultsComponentType = typeof import('$lib/components/BmiResults.svelte').default;
  type BmiRadialGaugeComponentType = typeof import('$lib/components/BmiRadialGauge.svelte').default;
  type ReferenceTableComponentType = typeof import('$lib/components/ReferenceTable.svelte').default;

  let BmiFormComponent: BmiFormComponentType | null = null;
  let BmiResultsComponent: BmiResultsComponentType | null = null;
  let BmiRadialGaugeComponent: BmiRadialGaugeComponentType | null = null;
  let ReferenceTableComponent: ReferenceTableComponentType | null = null;

  let calculatorLoad: Promise<void> | null = null;
  let gaugeLoad: Promise<void> | null = null;
  let referenceLoad: Promise<void> | null = null;

  function ensureCalculatorComponents() {
    if (!browser) return Promise.resolve();
    if (BmiFormComponent && BmiResultsComponent) return Promise.resolve();
    if (calculatorLoad) return calculatorLoad;
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
    return calculatorLoad;
  }

  function ensureGaugeComponents() {
    if (!browser) return Promise.resolve();
    if (BmiRadialGaugeComponent) return Promise.resolve();
    if (gaugeLoad) return gaugeLoad;
    gaugeLoad = import('$lib/components/BmiRadialGauge.svelte')
      .then((mod) => {
        BmiRadialGaugeComponent = mod.default;
      })
      .finally(() => {
        gaugeLoad = null;
      });
    return gaugeLoad;
  }

  function ensureReferenceTable() {
    if (!browser) return Promise.resolve();
    if (ReferenceTableComponent) return Promise.resolve();
    if (referenceLoad) return referenceLoad;
    referenceLoad = import('$lib/components/ReferenceTable.svelte')
      .then((mod) => {
        ReferenceTableComponent = mod.default;
      })
      .finally(() => {
        referenceLoad = null;
      });
    return referenceLoad;
  }
  // icons for About BMI section
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
    Ruler,
    ChevronLeft,
    ChevronRight
  } from 'lucide-svelte';

  let bmiValue: number | null = null;
  let category: string | null = null;

  // Form inputs default empty strings for validation UX
  let age: string = '';
  let height: string = '';
  let weight: string = '';

  let calculating = false;
  let resultsRunId = 0;

  const currentYear = new Date().getFullYear();

  const sections = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'calculator', label: 'Calculator' },
    { id: 'gauge', label: 'Gauge' },
    { id: 'reference', label: 'Reference' },
    { id: 'about', label: 'About' },
    { id: 'info', label: 'Info' }
  ] as const;

  let activeIndex = 0;
  let lastIndex = 0;
  let prefersReducedMotion = false;
  let perfTier: 'high' | 'medium' | 'low' = 'medium';
  let smoothModeRequested = false;

  let pagerNavEl: HTMLElement | null = null;
  let pagerNavCentered = false;
  let pagerNavAlignRaf: number | null = null;

  let activePointerId: number | null = null;
  let lastWheelNavAt = 0;
  let switchingTimer: ReturnType<typeof setTimeout> | null = null;
  let pageDestroyed = false;

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

  $: reducedMotionEffective = prefersReducedMotion && !smoothModeRequested;
  $: smoothModeEnhanced = smoothModeRequested && perfTier !== 'low';
  $: smoothModeStatus = smoothModeRequested ? 'On' : 'Off';

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

        return `transform: translate3d(${dx.toFixed(3)}px, 0, 0); opacity: ${opacity.toFixed(4)};`;
      }
    };
  }

  const BMI_BAR_MIN = 12;
  const BMI_BAR_MAX = 40;
  const BMI_UNDER_MAX = 18.5;
  const BMI_NORMAL_MAX = 24.9;
  const BMI_OVER_MAX = 29.9;

  $: rangeValue = bmiValue;
  $: rangeMarker =
    rangeValue === null
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            ((rangeValue - BMI_BAR_MIN) / (BMI_BAR_MAX - BMI_BAR_MIN)) * 100
          )
        );
  $: markerBmiText =
    rangeValue === null
      ? ''
      : rangeValue > BMI_BAR_MAX
        ? `${BMI_BAR_MAX}+`
        : rangeValue.toFixed(1);
  $: rangeAriaLabel =
    rangeValue === null
      ? 'BMI range bar. Calculate your BMI to see your position.'
      : `BMI range bar. Your BMI is ${rangeValue.toFixed(1)}. Category ${category ?? 'Unknown'}.`;

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

    const base = perfTier === 'high' ? 860 : perfTier === 'medium' ? 780 : 680;
    const overshootDur = Math.round(base * 0.62);
    const settleDur = Math.round(base * 0.48);
    const delta = target - lastMarker;
    const overshoot = Math.max(0, Math.min(100, target + delta * 0.08));

    lastMarker = target;
    animatedMarker.set(overshoot, { duration: overshootDur, easing: backOut });
    markerTimer = setTimeout(() => {
      animatedMarker.set(target, { duration: settleDur, easing: cubicOut });
      markerTimer = null;
    }, Math.max(0, overshootDur - 80));
  }

  const segUnder = Math.max(0, Math.min(BMI_UNDER_MAX, BMI_BAR_MAX) - BMI_BAR_MIN);
  const segNormal = Math.max(
    0,
    Math.min(BMI_NORMAL_MAX, BMI_BAR_MAX) - Math.max(BMI_UNDER_MAX, BMI_BAR_MIN)
  );
  const segOver = Math.max(
    0,
    Math.min(BMI_OVER_MAX, BMI_BAR_MAX) - Math.max(BMI_NORMAL_MAX, BMI_BAR_MIN)
  );
  const segObese = Math.max(0, BMI_BAR_MAX - Math.max(BMI_OVER_MAX, BMI_BAR_MIN));

  $: pagerDirection = activeIndex >= lastIndex ? 1 : -1;
  $: pagerMotionDuration = reducedMotionEffective
    ? 0
    : smoothModeRequested
      ? (perfTier === 'high' ? 620 : perfTier === 'medium' ? 540 : 460)
      : 260;
  $: pagerMotionDistance = reducedMotionEffective
    ? 0
    : smoothModeRequested
      ? (perfTier === 'high' ? 220 : perfTier === 'medium' ? 190 : 160)
      : 120;

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
      const ms = Math.max(240, pagerMotionDuration) + 140;
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

  $: if (browser) {
    if (activeIndex === 1) void ensureCalculatorComponents();
    if (activeIndex === 2) void ensureGaugeComponents();
    if (activeIndex === 3) void ensureReferenceTable();
  }

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
    broadcastSmoothMode(smoothModeRequested);

    const idx = indexFromHash(window.location.hash);
    if (idx !== null) goTo(idx, { skipHash: true, skipSwitching: true });
    setHash(sections[activeIndex].id);

    const onHashChange = () => {
      const next = indexFromHash(window.location.hash);
      if (next !== null && next !== activeIndex) goTo(next, { skipHash: true });
    };

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('keydown', handleKeydown);

    const onResize = () => schedulePagerNavAlignment();
    window.addEventListener('resize', onResize);
    void tick().then(schedulePagerNavAlignment);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', onResize);
      if (pagerNavAlignRaf !== null) cancelAnimationFrame(pagerNavAlignRaf);
    };
  });

  async function computeBMIFromInputs(h: string, w: string, _a: string) {
    const parsedHeight = parseFloat(h);
    const parsedWeight = parseFloat(w);

    if (
      Number.isFinite(parsedHeight) &&
      Number.isFinite(parsedWeight) &&
      parsedHeight > 0 &&
      parsedHeight <= 300 &&
      parsedWeight > 0 &&
      parsedWeight <= 1000
    ) {
      const heightInM = parsedHeight / 100;
      const bmi = parsedWeight / (heightInM * heightInM);
      bmiValue = parseFloat(bmi.toFixed(2));

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
    const minDelay = reducedMotionEffective ? 0 : (smoothModeRequested ? 260 : 200);
    if (minDelay > 0) {
      await new Promise((r) => setTimeout(r, minDelay));
    }
    await computeBMIFromInputs(height, weight, age);
    resultsRunId += 1;
    calculating = false;
  }

  function clearAllData() {
    calculating = false;
    age = '';
    height = '';
    weight = '';
    bmiValue = null; // Gauge will show empty/neutral state
    category = null;
    resultsRunId += 1;
  }

  $: if (bmiValue !== null) {
    animateRangeMarker(rangeMarker);
  } else {
    lastMarker = 0;
    animatedMarker.set(0, { duration: 0 });
  }

  onDestroy(() => {
    pageDestroyed = true;
    if (markerTimer) clearTimeout(markerTimer);
    if (switchingTimer) clearTimeout(switchingTimer);
    if (pagerNavAlignRaf !== null) cancelAnimationFrame(pagerNavAlignRaf);
    if (browser) document.body.classList.remove('is-switching');
  });

</script>

<svelte:head>
  <title>BMI Calculator - Calculate Your Body Mass Index</title>
  <meta name="description" content="Calculate your BMI with our modern, accessible calculator. Get instant results, health recommendations, and learn about BMI categories." />
  <link rel="preload" as="image" href="/images/oxyzen-zenlysium.jpg" fetchpriority="high" />
</svelte:head>

<div
  class="pager-shell"
  bind:this={pagerEl}
  on:pointerdown={handlePointerDown}
  on:pointerup={handlePointerUp}
  on:pointercancel={handlePointerUp}
  on:wheel|passive={handleWheel}
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
          on:click={() => goTo(idx)}
        >
          {section.label}
        </button>
      {/each}

      <button
        type="button"
        class="btn btn-ghost pager-tab pager-smooth"
        aria-pressed={smoothModeRequested}
        on:click={toggleSmoothMode}
      >
        <Bot class="render-spark" aria-hidden="true" />
        Render :
        <span class:render-on={smoothModeRequested} class:render-off={!smoothModeRequested}>
          {smoothModeStatus}
        </span>
      </button>
    </nav>
  </div>

  <main class="pager-view" aria-live="polite">
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
          strength: reducedMotionEffective ? 0 : (smoothModeEnhanced ? 0.14 : 0.08)
        }}
        out:pagerSpring={{
          x: -pagerDirection * pagerMotionDistance,
          duration: reducedMotionEffective
            ? 0
            : smoothModeRequested
              ? Math.round(pagerMotionDuration * 0.72)
              : 210,
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
                    <svelte:component
                      this={BmiFormComponent}
                      bind:age
                      bind:height
                      bind:weight
                      {calculating}
                      onClear={clearAllData}
                      onCalculate={handleCalculate}
                    />
                  {/if}
                </div>
                <div class="bmi-card">
                  {#key resultsRunId}
                    {#if BmiResultsComponent}
                      <svelte:component
                        this={BmiResultsComponent}
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
                <svelte:component
                  this={BmiRadialGaugeComponent}
                  bmi={bmiValue || 0}
                  category={category}
                  ultraSmooth={smoothModeRequested}
                />
              {/if}

              <div
                class="gauge-container bmi-rangebar"
                class:rangebar-animated={smoothModeRequested && !reducedMotionEffective}
              >
                <div class="gauge-header">
                  <div class="gauge-title">
                    <Ruler class="Gauge" />
                    <h3>BMI Range</h3>
                  </div>
                  <div class="gauge-subtitle">See your position across standard BMI categories</div>
                </div>

                <div class="rangebar">
                  <div class="rangebar-track" style={`--marker: ${$animatedMarker}%`} role="img" aria-label={rangeAriaLabel}>
                    <div class="rangebar-seg range-under" style={`flex: ${segUnder}`} aria-hidden="true"></div>
                    <div class="rangebar-seg range-normal" style={`flex: ${segNormal}`} aria-hidden="true"></div>
                    <div class="rangebar-seg range-over" style={`flex: ${segOver}`} aria-hidden="true"></div>
                    <div class="rangebar-seg range-obese" style={`flex: ${segObese}`} aria-hidden="true"></div>

                    {#if bmiValue !== null}
                      {#key resultsRunId}
                        <div class="rangebar-marker-wrap" aria-hidden="true">
                          <div class="rangebar-marker"></div>
                          <div class="rangebar-marker-badge">{markerBmiText}</div>
                        </div>
                      {/key}
                    {/if}
                  </div>

                  <div class="rangebar-legend" aria-hidden="true">
                    <span class="rangebar-legend-item legend-under">Underweight</span>
                    <span class="rangebar-legend-item legend-normal">Normal</span>
                    <span class="rangebar-legend-item legend-over">Overweight</span>
                    <span class="rangebar-legend-item legend-obese">Obese</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        {#if activeIndex === 3}
          <div class="main-container">
            <!-- Reference Table -->
            {#if ReferenceTableComponent}
              <svelte:component this={ReferenceTableComponent} />
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
                        <strong>Version:</strong>Stellar-4.8
                      </p>
                      <p class="info-row">
                        <GitBranch class="GitBranch" />
                        <strong>Branch:</strong>main
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
                  &copy; {currentYear} Rezky Nightky. All rights reserved.
                </span>
              </a>
            </div>
          </div>
        {/if}
      </section>
    {/key}
  </main>

  <div class="pager-controls-shell">
    <div class="pager-controls" class:arrow-flow-on={!reducedMotionEffective} aria-label="Section navigation">
      {#if activeIndex > 0}
        <button
          type="button"
          class="btn btn-ghost pager-arrow pager-arrow-prev"
          aria-label="Previous section"
          on:click={prevSection}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      {:else}
        <div class="pager-arrow-spacer" aria-hidden="true"></div>
      {/if}

      <div class="pager-indicator" aria-label={`Section ${activeIndex + 1} of ${sections.length}`}>
        {activeIndex + 1} / {sections.length}
      </div>

      {#if !reducedMotionEffective}
        {#if activeIndex > 0}
          <div class="pager-arrow-flow pager-arrow-flow-left" aria-hidden="true">
            <span class="pager-flow-chevron flow-1">‹</span>
            <span class="pager-flow-chevron flow-2">‹</span>
            <span class="pager-flow-chevron flow-3">‹</span>
          </div>
        {/if}

        {#if activeIndex < sections.length - 1}
          <div class="pager-arrow-flow pager-arrow-flow-right" aria-hidden="true">
            <span class="pager-flow-chevron flow-1">›</span>
            <span class="pager-flow-chevron flow-2">›</span>
            <span class="pager-flow-chevron flow-3">›</span>
          </div>
        {/if}
      {/if}

      {#if activeIndex < sections.length - 1}
        <button
          type="button"
          class="btn btn-ghost pager-arrow pager-arrow-next"
          aria-label="Next section"
          on:click={nextSection}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      {:else}
        <div class="pager-arrow-spacer" aria-hidden="true"></div>
      {/if}
    </div>
  </div>
</div>

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
    background: rgba(0, 0, 0, 0.500);
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

  .pager-controls-shell {
    width: calc(100% - 1.5rem);
    max-width: 820px;
    min-width: 0;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.500);
    backdrop-filter: blur(14px) saturate(165%);
    -webkit-backdrop-filter: blur(14px) saturate(165%);
    border: var(--btn-border);
    box-shadow: var(--btn-shadow);
    border-radius: 9999px;
    margin-inline: auto;
    position: absolute;
    bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
  }

  .pager-controls {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    position: relative;
  }

  .pager-arrow-flow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: inline-flex;
    align-items: center;
    gap: var(--flow-gap, 0.42rem);
    pointer-events: none;
    z-index: 30;
    opacity: 0.95;
    --flow-duration: 2800ms;
    --flow-stagger-2: 260ms;
    --flow-stagger-3: 520ms;
  }

  .pager-arrow-flow-left {
    --flow-start: -34px;
    --flow-end: clamp(-260px, -26vw, -140px);
    --flow-kick: -18px;
    --flow-settle: -8px;
    --flow-out: -38px;
  }

  .pager-arrow-flow-right {
    --flow-start: 34px;
    --flow-end: clamp(140px, 26vw, 260px);
    --flow-kick: 18px;
    --flow-settle: 8px;
    --flow-out: 38px;
  }

  .pager-flow-chevron {
    font-family: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      'Liberation Mono', 'Courier New', monospace;
    font-weight: 700;
    font-size: clamp(1.1rem, 1.2vw + 0.9rem, 1.55rem);
    line-height: 1;
    color: rgba(255, 255, 255, 0.9);
    text-shadow:
      0 0 12px color-mix(in oklab, var(--cosmic-purple) 52%, transparent),
      0 0 24px color-mix(in oklab, var(--cosmic-purple) 34%, transparent);
    will-change: transform, opacity;
    opacity: 0;
  }

  .pager-arrow-flow .pager-flow-chevron {
    animation: pagerFlow var(--flow-duration) cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }

  .pager-flow-chevron.flow-1 {
    animation-delay: 0ms;
  }

  .pager-flow-chevron.flow-2 {
    animation-delay: var(--flow-stagger-2);
  }

  .pager-flow-chevron.flow-3 {
    animation-delay: var(--flow-stagger-3);
  }

  @keyframes pagerFlow {
    0% {
      transform: translate3d(var(--flow-start), 0, 0) scale(0.92);
      opacity: 0;
    }

    12% {
      opacity: 0.88;
    }

    60% {
      transform: translate3d(var(--flow-end), 0, 0) scale(1.1);
      opacity: 0.72;
    }

    72% {
      transform: translate3d(calc(var(--flow-end) + var(--flow-kick)), 0, 0) scale(1.02);
      opacity: 0.62;
    }

    82% {
      transform: translate3d(calc(var(--flow-end) + var(--flow-settle)), 0, 0) scale(1);
      opacity: 0.56;
    }

    100% {
      transform: translate3d(calc(var(--flow-end) + var(--flow-out)), 0, 0) scale(0.92);
      opacity: 0;
    }
  }

  .pager-arrow {
    justify-self: start;
    width: 56px;
    height: 56px;
    padding: 0;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: visible;
    isolation: isolate;
    z-index: 0;
  }

  .pager-arrow-prev,
  .pager-arrow-next {
    color: white;
    border: 1px solid color-mix(in oklab, var(--aurora-core) 22%, rgba(255, 255, 255, 0.14));
    backdrop-filter: blur(14px) saturate(175%);
    -webkit-backdrop-filter: blur(14px) saturate(175%);
  }

  .pager-arrow-prev {
    background: var(--bg-last-by-rezky);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 0 28px color-mix(in oklab, var(--aurora-bright) 28%, transparent);
    --end-glow-shift-x: 12px;
  }

  .pager-arrow-next {
    background: var(--bg-by-rezky);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 0 28px color-mix(in oklab, var(--cosmic-purple) 30%, transparent);
    --end-glow-shift-x: -12px;
  }

  .pager-arrow::after {
    content: '';
    position: absolute;
    top: 50%;
    left: calc(50% + var(--end-glow-shift-x, 0px));
    width: 58px;
    height: 58px;
    transform: translate(-50%, -50%) scale(0.92);
    border-radius: 9999px;
    opacity: 0;
    z-index: -1;
    pointer-events: none;
  }

  .arrow-flow-on .pager-arrow-prev::after,
  .arrow-flow-on .pager-arrow-next::after {
    background: radial-gradient(
      circle,
      color-mix(in oklab, var(--cosmic-purple) 78%, transparent) 0%,
      color-mix(in oklab, var(--cosmic-purple) 34%, transparent) 38%,
      transparent 72%
    );
    filter: blur(5px);
    animation: pagerEndGlow var(--flow-duration, 2800ms) ease-in-out infinite;
  }

  .arrow-flow-on .pager-arrow-next::after {
    animation-delay: 140ms;
  }

  @keyframes pagerEndGlow {
    0% {
      opacity: 0.06;
      transform: translate(-50%, -50%) scale(0.86);
    }

    52% {
      opacity: 0.16;
      transform: translate(-50%, -50%) scale(0.98);
    }

    70% {
      opacity: 0.36;
      transform: translate(-50%, -50%) scale(1.12);
    }

    84% {
      opacity: 0.22;
      transform: translate(-50%, -50%) scale(1);
    }

    100% {
      opacity: 0.06;
      transform: translate(-50%, -50%) scale(0.86);
    }
  }

  .pager-controls :global(.pager-arrow:last-child) {
    justify-self: end;
  }

  .pager-arrow :global(svg) {
    width: 26px;
    height: 26px;
  }

  .pager-controls :global(.btn)::before {
    content: none;
    display: none;
  }

  .pager-arrow-spacer {
    width: 56px;
    height: 56px;
  }

  .pager-indicator {
    font: var(--btn-font);
    height: 44px;
    padding-inline: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.04);
    border: var(--btn-border);
    color: var(--stellar-white);
  }

  @media (max-width: 480px) {
    .pager-tab {
      height: 36px;
      padding-inline: 0.75rem;
      font-size: 0.85rem;
    }

    .pager-arrow,
    .pager-arrow-spacer {
      width: 52px;
      height: 52px;
    }
  }
</style>

<!-- styles moved to global-styles.css -->
