<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getPerformanceTier } from '$lib/utils/performance';

  let particlesContainer: HTMLDivElement;
  let particles: HTMLDivElement[] = [];
  let destroyed = false;
  let particleCount = 6;
  let baseParticleCount = 6;
  let reduced = false;
  let paused = false;
  let visibilityHandler: (() => void) | null = null;
  let smoothModeEnabled = false;
  let smoothModeHandler: (() => void) | null = null;
  let tier: 'high' | 'medium' | 'low' = 'medium';

  onMount(() => {
    tier = getPerformanceTier();
    // Base nodes: low = 10, medium = 10, high = 10
    baseParticleCount = 6;
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
    // Smooth limits: high=20, medium=15, low=10
    if (tier === 'high') return Math.min(baseParticleCount + 8, 14);
    if (tier === 'medium') return Math.min(baseParticleCount + 3, 9);
    return Math.min(baseParticleCount + 0, 6);
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
    particle.className = 'web3-particle';
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
      const opacity = 0.08 + prng(i, 1) * 0.1;
      const left = prng(i, 4) * 100;
      const top = prng(i, 8) * 100;
      const sizeRand = prng(i, 5);
      // Floating grid nodes: circular dots (6-10px)
      const size = 3 + Math.floor(sizeRand * 2);
      // Random drift direction (-30 to 30px)
      const dx = (prng(i, 9) - 0.5) * 30;
      const dy = (prng(i, 10) - 0.5) * 30;
      // Slow float: 15-25s duration
      const delay = prng(i, 6) * 8;
      const duration = 25 + prng(i, 7) * 15;
      // Alternate purple accent tones
      const isBlue = prng(i, 11) > 0.5;

      particle.style.cssText = `
        left: ${left}%;
        top: ${top}%;
        --size: ${size}px;
        --dx: ${dx.toFixed(1)}px;
        --dy: ${dy.toFixed(1)}px;
        --delay: ${delay.toFixed(1)}s;
        --duration: ${duration.toFixed(1)}s;
        --opacity: ${opacity.toFixed(2)};
        --is-blue: ${isBlue ? 1 : 0};
      `;

      frag.appendChild(particle);
      particles.push(particle);
    }

    particlesContainer.appendChild(frag);
  }

</script>

<div
  bind:this={particlesContainer}
  class="web3-particles"
  class:is-paused={paused}
  aria-hidden="true"
></div>
