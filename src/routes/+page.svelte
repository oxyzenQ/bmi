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
    ChevronUp,
    Monitor,
    Moon
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
    if (!window.isSecureContext) return;
    if (lastSavedBmi === bmi) return;

    let history: Array<{ timestamp: number; bmi: number; height: number; weight: number; age?: number }> = [];
    try {
      const stored = localStorage.getItem('bmi.history');
      if (stored) history = JSON.parse(stored);
    } catch {
      localStorage.removeItem('bmi.history');
    }

    const ageNum = a !== '' ? parseInt(a) : undefined;
    const newRecord = { timestamp: Date.now(), bmi, height: h, weight: w, age: ageNum };

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
        .then((mod) => { BmiHealthRiskComponent = mod.default; })
        .finally(() => { healthRiskLoad = null; });
    }
    return healthRiskLoad;
  }

  function ensureSnapshot() {
    if (!browser) return Promise.resolve();
    if (BmiSnapshotComponent) return Promise.resolve();
    if (!snapshotLoad) {
      snapshotLoad = import('$lib/components/BmiSnapshot.svelte')
        .then((mod) => { BmiSnapshotComponent = mod.default; })
        .finally(() => { snapshotLoad = null; });
    }
    return snapshotLoad;
  }

  function ensureBodyFat() {
    if (!browser) return Promise.resolve();
    if (BodyFatEstimateComponent) return Promise.resolve();
    if (!bodyFatLoad) {
      bodyFatLoad = import('$lib/components/BodyFatEstimate.svelte')
        .then((mod) => { BodyFatEstimateComponent = mod.default; })
        .finally(() => { bodyFatLoad = null; });
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
        .finally(() => { calculatorLoad = null; });
    }
    return calculatorLoad;
  }

  function ensureGaugeComponents() {
    if (!browser) return Promise.resolve();
    if (BmiRadialGaugeComponent) return Promise.resolve();
    if (!gaugeLoad) {
      gaugeLoad = import('$lib/components/BmiRadialGauge.svelte')
        .then((mod) => { BmiRadialGaugeComponent = mod.default; })
        .finally(() => { gaugeLoad = null; });
    }
    return gaugeLoad;
  }

  function ensureReferenceTable() {
    if (!browser) return Promise.resolve();
    if (ReferenceTableComponent) return Promise.resolve();
    if (!referenceLoad) {
      referenceLoad = import('$lib/components/ReferenceTable.svelte')
        .then((mod) => { ReferenceTableComponent = mod.default; })
        .finally(() => { referenceLoad = null; });
    }
    return referenceLoad;
  }

  let bmiValue: number | null = $state(null);
  let category: string | null = $state(null);

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

  const gitCommitId = typeof __GIT_COMMIT_ID__ !== 'undefined' ? __GIT_COMMIT_ID__ : 'dev';
  const gitBranch = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'main';

  const sections = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'calculator', label: 'Calculator' },
    { id: 'gauge', label: 'Gauge' },
    { id: 'reference', label: 'Reference' },
    { id: 'about', label: 'About' }
  ] as const;

  let prefersReducedMotion = $state(false);
  let perfTier = $state<'high' | 'medium' | 'low'>('medium');
  let smoothModeRequested = $state(false);

  // Background mode state
  let bgWallpaper = $state(false);

  function toggleBackground() {
    bgWallpaper = !bgWallpaper;
    if (browser) {
      localStorage.setItem('bmi.backgroundMode', bgWallpaper ? 'wallpaper' : 'dark');
      if (bgWallpaper) {
        document.body.classList.add('bg-wallpaper');
      } else {
        document.body.classList.remove('bg-wallpaper');
      }
    }
  }

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
    }
  }

  let reducedMotionEffective = $derived(prefersReducedMotion && !smoothModeRequested);
  let smoothModeEnhanced = $derived(smoothModeRequested && perfTier !== 'low');
  let smoothModeStatus = $derived(smoothModeRequested ? 'On' : 'Off');

  $effect(() => {
    if (browser && unitSystemInitialized) {
      try { localStorage.setItem('bmi.unitSystem', unitSystem); } catch { /* ok */ }
    }
  });

  const BMI_BAR_MIN = 12;
  const BMI_BAR_MAX = 40;

  const MARKER_ANIM_HIGH = 860;
  const MARKER_ANIM_MEDIUM = 780;
  const MARKER_ANIM_LOW = 680;
  const OVERSHOOT_RATIO = 0.62;
  const SETTLE_RATIO = 0.48;
  const SETTLE_DELAY_OFFSET = 80;

  let rangeMarker = $derived(
    bmiValue === null
      ? 0
      : Math.max(0, Math.min(100, ((bmiValue - BMI_BAR_MIN) / (BMI_BAR_MAX - BMI_BAR_MIN)) * 100))
  );
  const animatedMarker = tweened(0, { duration: 0, easing: cubicOut });
  let lastMarker = 0;
  let markerTimer: ReturnType<typeof setTimeout> | null = null;

  function animateRangeMarker(target: number) {
    if (markerTimer) { clearTimeout(markerTimer); markerTimer = null; }
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

  // IntersectionObserver-based lazy loading
  let lazyObserver: IntersectionObserver | null = null;

  function setupLazyObserver() {
    if (!browser) return;
    lazyObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const lazyType = (entry.target as HTMLElement).dataset.lazy;
        if (lazyType === 'calculator') void ensureCalculatorComponents();
        else if (lazyType === 'gauge') { void ensureGaugeComponents(); void ensureHealthRisk(); void ensureSnapshot(); void ensureBodyFat(); }
        else if (lazyType === 'reference') void ensureReferenceTable();
        lazyObserver?.unobserve(entry.target);
      }
    }, { rootMargin: '200px' });
    document.querySelectorAll('[data-lazy]').forEach((el) => lazyObserver?.observe(el));
  }

  // Scroll progress tracking
  let scrollProgress = $state(0);
  let showScrollTop = $state(false);
  let scrollListenerSetup = false;

  function setupScrollListener() {
    if (!browser || scrollListenerSetup) return;
    scrollListenerSetup = true;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      const scrollTop = window.scrollY || 0;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
      showScrollTop = scrollTop > 400;
      document.body.classList.add('is-scrolling');
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { document.body.classList.remove('is-scrolling'); }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function scrollToSection(id: string) {
    if (!browser) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  function scrollToTop() {
    if (!browser) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      smoothModeRequested = hasLegacy
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

    const storedBgMode = localStorage.getItem('bmi.backgroundMode');
    if (storedBgMode === 'wallpaper') {
      bgWallpaper = true;
      document.body.classList.add('bg-wallpaper');
    }

    try {
      const storedUnit = localStorage.getItem('bmi.unitSystem');
      if (storedUnit === 'imperial' || storedUnit === 'metric') {
        unitSystem = storedUnit;
      }
    } catch { /* ok */ }
    unitSystemInitialized = true;

    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
      if (sections.some((s) => s.id === hash)) {
        void tick().then(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'instant' });
        });
      }
    }

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

    setupScrollListener();
    void tick().then(setupLazyObserver);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (lazyObserver) lazyObserver.disconnect();
      lazyObserver = null;
      document.body.classList.remove('is-scrolling');
    };
  });

  function computeBMIFromInputs(h: string, w: string, _a: string) {
    let parsedHeight = parseFloat(h);
    let parsedWeight = parseFloat(w);

    if (unitSystem === 'imperial') {
      parsedHeight = parsedHeight * 2.54;
      parsedWeight = parsedWeight * 0.453592;
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

      saveBmiToHistory(bmiValue, parsedHeight, parsedWeight, _a);

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

    computeBMIFromInputs(height, weight, age);
    resultsRunId += 1;
    calculating = false;

    scrollToSection('gauge');

    const overlayDelay = reducedMotionEffective ? 30 : 180;
    await new Promise((r) => setTimeout(r, overlayDelay));

    notifyType = 'success';
    notifyMessage = 'Your BMI has been calculated successfully!';
    notifyButtonText = 'Continue to see';
    showNotify = true;
  }

  function confirmClearData() {
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
    bmiValue = null;
    category = null;
    resultsRunId += 1;

    if (browser) {
      localStorage.removeItem('bmi.history');
      lastSavedBmi = null;
    }
  }

  $effect(() => {
    if (bmiValue !== null) {
      animateRangeMarker(rangeMarker);
    } else {
      lastMarker = 0;
      animatedMarker.set(0, { duration: 0 });
    }
  });

  onDestroy(() => {
    if (markerTimer) clearTimeout(markerTimer);
  });
</script>

<svelte:head>
  <title>BMI Calculator - Calculate Your Body Mass Index</title>
  <meta name="description" content="Calculate your BMI with our modern, accessible calculator. Get instant results, health recommendations, and learn about BMI categories." />
</svelte:head>

<!-- LOGIGO$ Ticker Marquee -->
<div class="ticker-bar" aria-hidden="true">
  <div class="ticker-track">
    <span class="ticker-content">LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull;</span>
    <span class="ticker-content" aria-hidden="true">LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull;</span>
  </div>
</div>

<!-- Scroll progress bar -->
<div class="scroll-progress-bar" style="width: {scrollProgress * 100}%;" role="progressbar" aria-label="Page scroll progress" aria-valuenow={Math.round(scrollProgress * 100)}></div>

<!-- Scroll-to-top -->
{#if showScrollTop}
  <button type="button" class="scroll-to-top-btn" aria-label="Scroll to top" onclick={scrollToTop}>
    <ChevronUp size={24} />
  </button>
{/if}

<!-- Main content -->
<div class="long-scroll-page" role="main">

  <!-- Sticky nav -->
  <div class="sticky-nav-shell">
    <nav class="sticky-nav" aria-label="Sections">
      {#each sections as section (section.id)}
        <button type="button" class="btn btn-ghost nav-tab" onclick={() => scrollToSection(section.id)}>
          {section.label}
        </button>
      {/each}

      <button
        type="button"
        class="btn btn-ghost nav-tab nav-smooth"
        aria-label="Toggle render mode"
        aria-pressed={smoothModeRequested}
        onclick={toggleSmoothMode}
      >
        <Bot class="render-spark" aria-hidden="true" />
        <span class:render-on={smoothModeRequested} class:render-off={!smoothModeRequested}>
          {smoothModeStatus}
        </span>
      </button>

      <button
        type="button"
        class="btn btn-ghost nav-tab bg-toggle-btn"
        aria-label={bgWallpaper ? 'Switch to dark background' : 'Switch to wallpaper background'}
        aria-pressed={bgWallpaper}
        onclick={toggleBackground}
      >
        {#if bgWallpaper}
          <Monitor size={15} aria-hidden="true" />
        {:else}
          <Moon size={15} aria-hidden="true" />
        {/if}
      </button>
    </nav>
  </div>

  <!-- Hero -->
  <section id="welcome" class="scroll-section">
    <div class="main-container">
      <Hero />
    </div>
  </section>

  <!-- Calculator -->
  <section id="calculator" class="scroll-section" data-lazy="calculator">
    <div class="main-container">
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
  </section>

  <!-- Gauge -->
  <section id="gauge" class="scroll-section" data-lazy="gauge">
    <div class="main-container">
      <div class="charts-section">
        {#if BmiRadialGaugeComponent}
          <BmiRadialGaugeComponent bmi={bmiValue || 0} {category} ultraSmooth={smoothModeRequested} />
        {/if}

        {#if BmiHealthRiskComponent}
          <BmiHealthRiskComponent bmi={bmiValue} {category} />
        {/if}

        {#if BmiSnapshotComponent}
          <BmiSnapshotComponent currentBmi={bmiValue} {category} />
        {/if}

        {#if BodyFatEstimateComponent}
          <BodyFatEstimateComponent bmi={bmiValue} age={age === '' ? null : parseInt(age)} />
        {/if}
      </div>
    </div>
  </section>

  <!-- Reference -->
  <section id="reference" class="scroll-section" data-lazy="reference">
    <div class="main-container">
      {#if ReferenceTableComponent}
        <ReferenceTableComponent />
      {/if}
    </div>
  </section>

  <!-- About -->
  <section id="about" class="scroll-section">
    <section class="about-bmi-section">
      <div class="main-container">
        <div class="section-header-v2">
          <h2 class="title">About BMI</h2>
          <p class="subtitle">Understanding Body Mass Index and our application</p>
        </div>

        <div class="about-bmi-grid">
          <div class="about-card">
            <div class="about-card-header">
              <Lightbulb class="Lightbulb" />
              <h3>What is BMI?</h3>
            </div>
            <div class="about-card-content">
              <p>
                Body Mass Index (BMI) is a simple weight-for-height index: weight (kg) divided by height (m) squared.
                It's a quick population-level screening tool to gauge potential health risk.
              </p>
              <p>
                Adult ranges: <em>Underweight</em> (&lt; 18.5), <em>Normal</em> (18.5-24.9), <em>Overweight</em> (25.0-29.9),
                <em>Obese</em> (>= 30).
              </p>
              <p>
                Limitations: BMI doesn't distinguish fat vs muscle or fat distribution. Use it alongside waist circumference,
                body-fat %, lifestyle factors, and clinical assessment.
              </p>
            </div>
          </div>

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
              </p>
              <div class="app-info">
                <p class="info-row">
                  <PackageCheck class="PackageCheck" />
                  <strong>Version:</strong>Web3-Crypto-11.0 <span class="commit-id">({gitCommitId})</span>
                </p>
                <p class="info-row">
                  <GitBranch class="GitBranch" />
                  <strong>Branch:</strong>{gitBranch}
                </p>
                <p class="info-row">
                  <GitCompare class="GitCompare" />
                  <strong>Type:</strong><span class="text-gradient-elegant">Open Source</span>
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
  </section>

  <!-- Footer -->
  <section class="scroll-section">
    <div class="main-container">
      <div class="footer-disclaimer">
        <div class="disclaimer-icon">
          <AlertTriangle class="AlertTriangle" />
        </div>
        <p>
          BMI is a screening tool and should not be used as a sole diagnostic method.
          Please consult healthcare professionals for comprehensive health assessment.
        </p>
      </div>

      <div class="github-footer">
        <a href="https://github.com/oxyzenq/bmi" target="_blank" rel="noopener noreferrer" class="github-link">
          &copy; 2025-{currentYear} Rezky Nightky. All rights reserved.
        </a>
      </div>
    </div>
  </section>

</div>

<!-- Notification -->
{#if showNotify}
  <NotifyFloat
    show={showNotify}
    type={notifyType}
    message={notifyMessage}
    buttonText={notifyButtonText}
    onContinue={async () => {
      if (notifyType === 'warn' && pendingImportText) {
        const result = await importBmiHistory(pendingImportText);
        pendingImportText = null;
        if (result.success) {
          const checksumMsg = result.checksumVerified ? ' Checksum verified' : '';
          notifyType = 'success';
          notifyMessage = `Successfully imported ${result.count} record${result.count === 1 ? '' : 's'}!${checksumMsg}`;
          notifyButtonText = 'OK';
        } else {
          notifyType = 'delete';
          notifyMessage = result.error || 'Import failed.';
          notifyButtonText = 'OK';
        }
      } else if (notifyType === 'success') {
        showNotify = false;
      } else if (notifyType === 'delete') {
        showNotify = false;
        clearAllData();
      }
    }}
    onClose={() => { pendingImportText = null; showNotify = false; }}
    onCancel={() => { pendingImportText = null; showNotify = false; }}
  />
{/if}

<style>
  .long-scroll-page {
    width: 100%;
    padding-top: 48px;
    min-height: 100vh;
  }

  .charts-section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-6);
    padding: var(--sp-6) 0;
  }
</style>
