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
      // Update scroll progress bar
      const scrollTop = window.scrollY || 0;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
      showScrollTop = scrollTop > 400;

      // is-scrolling class
      document.body.classList.add('is-scrolling');
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling');
      }, 150);
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

    // Read background mode preference
    const storedBgMode = localStorage.getItem('bmi.backgroundMode');
    if (storedBgMode === 'wallpaper') {
      bgWallpaper = true;
      document.body.classList.add('bg-wallpaper');
    } else {
      bgWallpaper = false;
      document.body.classList.remove('bg-wallpaper');
    }

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

    // Scroll to hash if present
    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
      if (sections.some((s) => s.id === hash)) {
        void tick().then(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'instant' });
        });
      }
    }

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

    // Setup scroll listener and lazy observer
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

    // Navigate to Gauge section
    scrollToSection('gauge');

    // Brief delay so scroll begins before the notification
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
    if (markerTimer) clearTimeout(markerTimer);
  });

</script>

<svelte:head>
  <title>BMI Calculator - Calculate Your Body Mass Index</title>
  <meta name="description" content="Calculate your BMI with our modern, accessible calculator. Get instant results, health recommendations, and learn about BMI categories." />
</svelte:head>

<!-- LOGIGO$ Ticker Marquee Branding Bar -->
<div class="ticker-bar" aria-hidden="true">
  <div class="ticker-track">
    <span class="ticker-content">LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull;</span>
    <span class="ticker-content" aria-hidden="true">LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull; LOGIGO$ &bull;</span>
  </div>
</div>

<!-- Scroll progress bar -->
<div class="scroll-progress-bar" style="width: {scrollProgress * 100}%;" role="progressbar" aria-label="Page scroll progress" aria-valuenow={Math.round(scrollProgress * 100)} />

<!-- Scroll-to-top button -->
{#if showScrollTop}
  <button
    type="button"
    class="scroll-to-top-btn"
    aria-label="Scroll to top"
    onclick={scrollToTop}
  >
    <ChevronUp size={28} />
  </button>
{/if}

<!-- Main content: long scroll page -->
<div class="long-scroll-page" role="main">

  <!-- Sticky navigation bar -->
  <div class="sticky-nav-shell">
    <nav class="sticky-nav" aria-label="Sections">
      {#each sections as section, idx (section.id)}
        <button
          type="button"
          class="btn btn-ghost nav-tab"
          onclick={() => scrollToSection(section.id)}
        >
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
        Render :
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
          <Monitor size={16} aria-hidden="true" />
          Wallpaper
        {:else}
          <Moon size={16} aria-hidden="true" />
          Dark
        {/if}
      </button>
    </nav>
  </div>

  <!-- Welcome / Hero Section -->
  <section id="welcome" class="scroll-section" data-lazy="welcome">
    <div class="main-container">
      <Hero />
    </div>
  </section>

  <!-- Calculator Section -->
  <section id="calculator" class="scroll-section" data-lazy="calculator">
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
  </section>

  <!-- Gauge Section -->
  <section id="gauge" class="scroll-section" data-lazy="gauge">
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
  </section>

  <!-- Reference Section -->
  <section id="reference" class="scroll-section" data-lazy="reference">
    <div class="main-container">
      <!-- Reference Table -->
      {#if ReferenceTableComponent}
        <ReferenceTableComponent />
      {/if}
    </div>
  </section>

  <!-- About BMI Section -->
  <section id="about" class="scroll-section">
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
                It's a quick population‑level screening tool to gauge potential health risk.
              </p>
              <p>
                Adult ranges: <em>Underweight</em> (&lt; 18.5), <em>Normal</em> (18.5–24.9), <em>Overweight</em> (25.0–29.9),
                <em>Obese</em> (≥ 30).
              </p>
              <p>
                Limitations: BMI doesn't distinguish fat vs muscle or fat distribution. Use it alongside waist circumference,
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
                  <strong>Version:</strong>Web3-Crypto-11.0 <span class="commit-id">({gitCommitId})</span>
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
  </section>

  <!-- Info / Footer Section -->
  <section id="info" class="scroll-section">
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
  </section>

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
  /* === Long-scroll page layout === */
  .long-scroll-page {
    width: 100%;
    padding-top: 56px;
    min-height: 100vh;
  }

  /* === Sticky navigation bar === */
  .sticky-nav-shell {
    width: calc(100% - 1.5rem);
    max-width: 820px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(14px) saturate(165%);
    -webkit-backdrop-filter: blur(14px) saturate(165%);
    border: var(--btn-border);
    box-shadow: var(--btn-shadow);
    border-radius: 9999px;
    margin-inline: auto;
    position: sticky;
    top: calc(0.75rem + env(safe-area-inset-top, 0px));
    z-index: 20;
    isolation: isolate;
  }

  .sticky-nav-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    pointer-events: none;
    z-index: 0;
  }

  .sticky-nav {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  .sticky-nav::-webkit-scrollbar {
    display: none;
  }

  @media (min-width: 900px) {
    .sticky-nav {
      justify-content: center;
    }
  }

  @media (max-width: 600px) {
    .sticky-nav {
      gap: 0.35rem;
      padding: 0.45rem 0.6rem;
    }

    .nav-tab {
      height: 36px;
      padding-inline: 0.75rem;
      font-size: 0.85rem;
    }
  }

  .nav-tab {
    height: 38px;
    padding-inline: 0.9rem;
    font-size: 0.9rem;
    border-radius: 9999px;
    white-space: nowrap;
    opacity: 0.86;
    flex: 0 0 auto;
    min-width: max-content;
  }

  .nav-smooth {
    opacity: 1;
  }

  .nav-smooth :global(.render-spark) {
    color: var(--web3-glow-purple) !important;
  }

  .nav-smooth .render-on {
    color: #00c853;
  }

  .nav-smooth .render-off {
    color: #ffd600;
  }

  .nav-tab.active {
    opacity: 1;
    background: rgba(255, 255, 255, 0.07);
    border-color: color-mix(in oklab, var(--web3-glow-purple) 55%, rgba(255, 255, 255, 0.12));
    box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.38),
      0 0 18px color-mix(in oklab, var(--web3-glow-purple) 28%, transparent);
    transform: translateY(-1px);
  }

  /* === Scroll progress bar === */
  .scroll-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--web3-glow-purple), var(--web3-glow-blue));
    z-index: 9999;
    pointer-events: none;
    transition: width 80ms linear;
    will-change: width;
  }

  /* === Scroll-to-top button === */
  .scroll-to-top-btn {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px) saturate(140%);
    -webkit-backdrop-filter: blur(8px) saturate(140%);
    color: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 100;
    transition: transform 0.25s ease, opacity 0.25s ease;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .scroll-to-top-btn:hover {
    transform: translateY(-2px) scale(1.05);
    background: rgba(147, 112, 219, 0.15);
    border-color: rgba(147, 112, 219, 0.3);
    box-shadow: 0 8px 24px rgba(147, 112, 219, 0.15);
  }

  .scroll-to-top-btn:active {
    transform: scale(0.95);
  }

  /* === Scroll sections === */
  .scroll-section {
    min-height: 50vh;
  }

  .scroll-section .main-container {
    min-height: 50vh;
  }
</style>
