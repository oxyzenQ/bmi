<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getPerformanceTier } from '$lib/utils/performance';

  let particlesContainer: HTMLDivElement;
  let particles: HTMLDivElement[] = [];
  let destroyed = false;
  let particleCount = 10;
  let baseParticleCount = 10;
  let reduced = false;
  let paused = false;
  let visibilityHandler: (() => void) | null = null;
  let smoothModeEnabled = false;
  let smoothModeHandler: (() => void) | null = null;
  let tier: 'high' | 'medium' | 'low' = 'medium';

  onMount(() => {
    tier = getPerformanceTier();
    // Smooth rain: low = 15, medium = 25, high = 40 (fewer but smoother)
    baseParticleCount = tier === 'low' ? 15 : tier === 'medium' ? 25 : 40;
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
    } else {
      stopParticles();
    }

    handleVisibility();
  });

  onDestroy(() => {
    destroyed = true;
    stopParticles();
    if (visibilityHandler) visibilityHandler();
    if (smoothModeHandler) smoothModeHandler();
  });

  function computeParticleCount(tier: 'high' | 'medium' | 'low', smoothEnabled: boolean) {
    if (!smoothEnabled) return baseParticleCount;
    // Smooth limits: high=60, medium=40, low=25 (not too many)
    if (tier === 'high') return Math.min(baseParticleCount + 20, 60);
    if (tier === 'medium') return Math.min(baseParticleCount + 15, 40);
    return Math.min(baseParticleCount + 10, 25);
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

</script>

<div
  bind:this={particlesContainer}
  class="cosmic-particles"
  class:is-paused={paused}
  aria-hidden="true"
></div>
