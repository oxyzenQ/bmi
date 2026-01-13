<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { getPerformanceTier } from '$lib/utils/performance';
  import Hero from '$lib/ui/Hero.svelte';
  import BmiForm from '$lib/components/BmiForm.svelte';
  import BmiResults from '$lib/components/BmiResults.svelte';
  import BmiRadialGauge from '$lib/components/BmiRadialGauge.svelte';
  import ReferenceTable from '$lib/components/ReferenceTable.svelte';
  // icons for About BMI section
  import {
    Lightbulb,
    Users,
    GitCompare,
    PackageCheck,
    Brush,
    AlertTriangle,
    Scale,
    ChevronLeft,
    ChevronRight
  } from 'lucide-svelte';

  let bmiValue: number | null = null;
  let category: string | null = null;

  const MAX_HISTORY = 100;

  // Form inputs default empty strings for validation UX
  let age: string = '';
  let height: string = '';
  let weight: string = '';
  // BMI history for tracking calculations
  let bmiHistory: Array<{bmi: number, timestamp: Date}> = [];

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
  let ultraSmoothRequested = false;

  function toggleUltraSmooth() {
    ultraSmoothRequested = !ultraSmoothRequested;
    if (browser) {
      localStorage.setItem('bmi.ultraSmooth', ultraSmoothRequested ? '1' : '0');
    }
  }

  $: ultraSmoothEnabled = ultraSmoothRequested && !prefersReducedMotion && perfTier !== 'low';
  $: ultraSmoothStatus = ultraSmoothEnabled ? 'On' : ultraSmoothRequested ? 'Limited' : 'Off';

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
    const scroller = pagerEl?.querySelector<HTMLElement>('[data-pager-scroll="true"]');
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function setHash(id: string) {
    if (!browser) return;
    history.replaceState(null, '', `#${id}`);
  }

  function goTo(index: number, opts?: { skipHash?: boolean }) {
    const next = clampIndex(index);
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
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, label')) return;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
  }

  function handlePointerUp(event: PointerEvent) {
    if (pointerStartX === null || pointerStartY === null) return;

    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;
    pointerStartX = null;
    pointerStartY = null;

    if (Math.abs(dx) < 60) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

    if (dx < 0) nextSection();
    else prevSection();
  }

  onMount(() => {
    if (browser) {
      perfTier = getPerformanceTier();
      prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const storedUltra = localStorage.getItem('bmi.ultraSmooth');
      ultraSmoothRequested = storedUltra === '1' || storedUltra === 'true';

      const idx = indexFromHash(window.location.hash);
      if (idx !== null) goTo(idx, { skipHash: true });
      setHash(sections[activeIndex].id);

      const onHashChange = () => {
        const next = indexFromHash(window.location.hash);
        if (next !== null && next !== activeIndex) goTo(next, { skipHash: true });
      };

      window.addEventListener('hashchange', onHashChange);
      window.addEventListener('keydown', handleKeydown);

      return () => {
        window.removeEventListener('hashchange', onHashChange);
        window.removeEventListener('keydown', handleKeydown);
      };
    }
  });

  function computeBMIFromInputs(h: string, w: string, _a: string) {
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

      // Add to history
      const nextEntry = { bmi: bmiValue, timestamp: new Date() };
      bmiHistory = [...bmiHistory.slice(-(MAX_HISTORY - 1)), nextEntry];
    } else {
      bmiValue = null;
      category = null;
    }
  }

  // Manual calculation only - remove auto calculation
  function handleCalculate() {
    computeBMIFromInputs(height, weight, age);
  }

  function clearAllData() {
    age = '';
    height = '';
    weight = '';
    bmiValue = null; // Gauge will show empty/neutral state
    category = null;
    bmiHistory = []; // Clear history
  }

</script>

<svelte:head>
  <title>BMI Calculator - Calculate Your Body Mass Index</title>
  <meta name="description" content="Calculate your BMI with our modern, accessible calculator. Get instant results, health recommendations, and learn about BMI categories." />
  <link rel="preload" as="image" href="/images/HDRstellar-v1.webp" fetchpriority="high" />
</svelte:head>

<div
  class="pager-shell"
  bind:this={pagerEl}
  on:pointerdown={handlePointerDown}
  on:pointerup={handlePointerUp}
  on:pointercancel={handlePointerUp}
>
  <nav class="pager-nav" aria-label="Sections">
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
      class="btn btn-ghost pager-tab pager-ultra"
      aria-pressed={ultraSmoothRequested}
      on:click={toggleUltraSmooth}
    >
      Ultra Smooth: {ultraSmoothStatus}
    </button>
  </nav>

  <main class="pager-view" aria-live="polite">
    {#key activeIndex}
      <section
        class="pager-section"
        id={sections[activeIndex].id}
        data-pager-scroll="true"
        style={`--pager-motion-duration: ${prefersReducedMotion ? '0ms' : ultraSmoothEnabled ? '360ms' : '220ms'}; --pager-motion-x: ${activeIndex >= lastIndex ? (ultraSmoothEnabled ? '44px' : '28px') : (ultraSmoothEnabled ? '-44px' : '-28px')};`}
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
                  <BmiForm
                    bind:age
                    bind:height
                    bind:weight
                    onClear={clearAllData}
                    onCalculate={handleCalculate}
                  />
                </div>
                <div class="bmi-card">
                  <BmiResults
                    {bmiValue}
                    {category}
                    age={age === '' ? null : parseInt(age)}
                  />
                </div>
              </div>
            </section>
          </div>
        {/if}

        {#if activeIndex === 2}
          <div class="main-container">
            <div class="charts-section">
              <BmiRadialGauge
                bmi={bmiValue || 0}
                category={category}
                ultraSmooth={ultraSmoothRequested}
              />
            </div>
          </div>
        {/if}

        {#if activeIndex === 3}
          <div class="main-container">
            <!-- Reference Table -->
            <ReferenceTable />
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
                        <strong>Version:</strong>Stellar-4.0
                      </p>
                      <p class="info-row">
                        <GitCompare class="GitCompare" />
                        <strong>Type Apps:</strong><span class="text-gradient-elegant">Open Source Project</span>
                      </p>
                      <p class="info-row">
                        <Brush class="Brush" />
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
                href="https://github.com/oxyzenq/web-oxy"
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

  <div class="pager-controls" aria-label="Section navigation">
    {#if activeIndex > 0}
      <button
        type="button"
        class="btn btn-ghost pager-arrow"
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

    {#if activeIndex < sections.length - 1}
      <button
        type="button"
        class="btn btn-ghost pager-arrow"
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

<style>
  .pager-shell {
    height: 100svh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    overflow: hidden;
  }

  .pager-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding-inline: 0.75rem;
    scrollbar-width: none;
    background: none;
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
    opacity: 0.78;
  }

  .pager-ultra {
    opacity: 1;
  }

  .pager-tab.active {
    opacity: 1;
    border-color: color-mix(in oklab, var(--aurora-core) 40%, rgba(255, 255, 255, 0.12));
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35), 0 0 14px rgba(96, 165, 250, 0.18);
  }

  .pager-view {
    flex: 1;
    overflow: hidden;
    padding-bottom: 0.5rem;
  }

  .pager-section {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    will-change: transform, opacity;
    transform: translateZ(0) translateX(var(--pager-motion-x, 0));
    opacity: 0;
    animation: pagerEnter var(--pager-motion-duration, 220ms) var(--easing-smooth) forwards;
    scrollbar-width: none;
    contain: layout paint style;
  }

  .pager-section::-webkit-scrollbar {
    display: none;
  }

  @keyframes pagerEnter {
    to {
      transform: translateZ(0) translateX(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pager-section {
      animation: none;
      opacity: 1;
      transform: translateZ(0) translateX(0);
    }
  }

  .pager-controls {
    position: sticky;
    bottom: 0.75rem;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.75rem;
    padding: 0 0.75rem 0.75rem;
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
  }

  .pager-controls :global(.pager-arrow:last-child) {
    justify-self: end;
  }

  .pager-arrow :global(svg) {
    width: 26px;
    height: 26px;
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
    background: color-mix(in oklab, var(--cosmic-void) 35%, transparent);
    border: 1px solid rgba(255, 255, 255, 0.12);
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

<!-- styles moved to app.css -->
