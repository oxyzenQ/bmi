<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getPerformanceTier } from '$lib/utils/performance';

  let particlesContainer: HTMLDivElement;
  let particles: HTMLDivElement[] = [];
  let shootingStars: HTMLDivElement[] = [];
  let destroyed = false;
  let particleCount = 10;
  let baseParticleCount = 10;
  let reduced = false;
  let paused = false;
  let visibilityHandler: (() => void) | null = null;
  let smoothModeEnabled = false;
  let smoothModeHandler: (() => void) | null = null;
  let tier: 'high' | 'medium' | 'low' = 'medium';
  let shootingStarTimer: ReturnType<typeof setInterval> | null = null;
  let initialShootingDelay: ReturnType<typeof setTimeout> | null = null;
  let cleanupTimers: Array<ReturnType<typeof setTimeout>> = [];

  onMount(() => {
    tier = getPerformanceTier();
    // Base rain: low = 10, medium = 10, high = 10
    baseParticleCount = 10;
    smoothModeEnabled = true;
    updateReduced();

    // Set performance tier on document for CSS optimizations
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.performanceTier = tier;
    }

    const handleSmoothMode = (event: Event) => {
      if (destroyed) return;
      const ce = event as CustomEvent<{ enabled?: boolean; requested?: boolean; status?: string }>;
      smoothModeEnabled = Boolean(ce.detail?.enabled ?? ce.detail?.requested);
      updateReduced();

      if (reduced) {
        stopParticles();
        stopShootingStars();
        return;
      }

      const nextCount = computeParticleCount(tier, smoothModeEnabled);
      const shouldRecreate = particles.length !== nextCount;
      particleCount = nextCount;

      if (!paused && (particles.length === 0 || shouldRecreate)) {
        createParticles();
      }
    };

    window.addEventListener('bmi:smoothMode', handleSmoothMode as EventListener);
    smoothModeHandler = () => window.removeEventListener('bmi:smoothMode', handleSmoothMode as EventListener);

    const handleVisibility = () => {
      if (destroyed) return;
      const isHidden = document.hidden;
      paused = isHidden;

      if (isHidden) return;
      if (reduced) return;

      if (particles.length === 0) {
        createParticles();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    visibilityHandler = () => document.removeEventListener('visibilitychange', handleVisibility);

    if (!reduced && !document.hidden) {
      particleCount = computeParticleCount(tier, smoothModeEnabled);
      createParticles();
      startShootingStars();
    } else {
      stopParticles();
      stopShootingStars();
    }

    handleVisibility();
  });

  onDestroy(() => {
    destroyed = true;
    stopParticles();
    stopShootingStars();
    // Clean up initial shooting star delay
    if (initialShootingDelay) {
      clearTimeout(initialShootingDelay);
      initialShootingDelay = null;
    }
    // Clean up any outstanding per-star cleanup timers
    for (const t of cleanupTimers) clearTimeout(t);
    cleanupTimers = [];
    if (visibilityHandler) visibilityHandler();
    if (smoothModeHandler) smoothModeHandler();
  });

  function computeParticleCount(tier: 'high' | 'medium' | 'low', smoothEnabled: boolean) {
    if (!smoothEnabled) return baseParticleCount;
    // Smooth limits: high=20, medium=15, low=10
    if (tier === 'high') return Math.min(baseParticleCount + 10, 20);
    if (tier === 'medium') return Math.min(baseParticleCount + 5, 15);
    return Math.min(baseParticleCount + 0, 10);
  }

  function updateReduced() {
    reduced = !smoothModeEnabled;
  }

  function stopParticles() {
    if (particlesContainer) particlesContainer.textContent = '';
    particles = [];
  }

  function prng(i: number, salt: number) {
    const x = Math.sin((i + 1) * 999 + salt) * 10000;
    return x - Math.floor(x);
  }

  function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'cosmic-particle';
    return particle;
  }

  function createParticles() {
    if (!particlesContainer) return;

    particlesContainer.textContent = '';
    particles = [];

    const frag = document.createDocumentFragment();

    // Create particles (optimized for performance)
    for (let i = 0; i < particleCount; i++) {
      const particle = createParticle();
      const opacity = 0.26 + prng(i, 1) * 0.58;
      const left = prng(i, 4) * 100;
      const sizeRand = prng(i, 5);
      // Rain drops: thin and long (2px x 15-35px)
      const width = 2;
      const height = 15 + Math.floor(sizeRand * 20);
      // Smooth rain: 1.5-3s duration (not too fast)
      const delay = prng(i, 6) * 3;
      const duration = 1.5 + prng(i, 7) * 1.5;

      particle.style.cssText = `
        left: ${left}%;
        width: ${width}px;
        height: ${height}px;
        --delay: ${delay}s;
        --duration: ${duration}s;
        --opacity: ${opacity};
      `;

      frag.appendChild(particle);
      particles.push(particle);
    }

    particlesContainer.appendChild(frag);
  }

  // ── Shooting Stars ──
  function prng2(i: number, salt: number) {
    const x = Math.sin((i + 1) * 777 + salt) * 10000;
    return x - Math.floor(x);
  }

  function createShootingStar() {
    if (destroyed || reduced || paused || !particlesContainer) return;
    if (shootingStars.length >= 3) return; // Max 3 concurrent

    const star = document.createElement('div');
    star.className = 'shooting-star';

    const top = prng2(Date.now(), 3) * 60; // Top 0-60% of screen
    const left = prng2(Date.now(), 7) * 100; // Random horizontal start
    const angle = 25 + prng2(Date.now(), 9) * 25; // 25-50 degree angle
    const distance = 200 + prng2(Date.now(), 11) * 150; // 200-350px travel
    const dx = Math.cos(angle * Math.PI / 180) * distance;
    const dy = Math.sin(angle * Math.PI / 180) * distance;
    const duration = 1.2 + Number(prng2(Date.now(), 13)) * 1.0;
    const delay = 0.05 + Math.random() * 0.15;

    star.style.cssText = `
      top: ${top}%;
      left: ${left}%;
      --shoot-dx: ${dx.toFixed(1)}px;
      --shoot-dy: ${dy.toFixed(1)}px;
      --shoot-duration: ${duration.toFixed(2)}s;
      --shoot-delay: ${delay.toFixed(2)}s;
      --shoot-angle: ${angle.toFixed(1)}deg;
    `;

    particlesContainer.appendChild(star);
    shootingStars.push(star);

    // Auto-cleanup after animation — tracked for proper destroy cleanup
    const cleanupTime = (duration + delay) * 1000 + 500;
    const cleanupId = setTimeout(() => {
      if (star.parentNode) {
        star.parentNode.removeChild(star);
      }
      const idx = shootingStars.indexOf(star);
      if (idx >= 0) shootingStars.splice(idx, 1);
      // Remove this timer from tracking
      const ci = cleanupTimers.indexOf(cleanupId);
      if (ci >= 0) cleanupTimers.splice(ci, 1);
    }, cleanupTime);
    cleanupTimers.push(cleanupId);
  }

  function startShootingStars() {
    stopShootingStars();
    if (destroyed || reduced) return;

    // Spawn shooting stars at random intervals (4-12 seconds)
    function scheduleNext() {
      if (destroyed || reduced || paused) return;
      const interval = 4000 + Math.random() * 8000;
      shootingStarTimer = setInterval(() => {
        // Guard inside interval callback to prevent firing after destroy
        if (destroyed || reduced || paused) {
          stopShootingStars();
          return;
        }
        createShootingStar();
      }, interval) as unknown as ReturnType<typeof setInterval>;
    }

    // First star after 2-5 seconds — tracked for proper cleanup
    initialShootingDelay = setTimeout(() => {
      if (destroyed || reduced || paused) return;
      scheduleNext();
    }, 2000 + Math.random() * 3000);
  }

  function stopShootingStars() {
    if (shootingStarTimer) {
      clearInterval(shootingStarTimer);
      shootingStarTimer = null;
    }
    if (initialShootingDelay) {
      clearTimeout(initialShootingDelay);
      initialShootingDelay = null;
    }
    // Clean up existing stars gracefully
    for (const star of shootingStars) {
      if (star.parentNode) star.parentNode.removeChild(star);
    }
    shootingStars = [];
    // Clean up outstanding per-star cleanup timers
    for (const t of cleanupTimers) clearTimeout(t);
    cleanupTimers = [];
  }
</script>

<div
  bind:this={particlesContainer}
  class="cosmic-particles"
  class:is-paused={paused}
  aria-hidden="true"
></div>
