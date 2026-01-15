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
    baseParticleCount = tier === 'low' ? 10 : tier === 'medium' ? 16 : 22;
    smoothModeEnabled = true;
    updateReduced();

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
    if (tier === 'high') return Math.min(baseParticleCount + 8, 34);
    if (tier === 'medium') return Math.min(baseParticleCount + 6, 26);
    return Math.min(baseParticleCount + 4, 18);
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
      const scale = 0.85 + prng(i, 2) * 1.35;
      const driftStart = (prng(i, 3) - 0.5) * 160;
      const driftEnd = driftStart + (prng(i, 8) - 0.5) * 240;
      const driftMid = driftStart + (driftEnd - driftStart) * 0.52 + (prng(i, 11) - 0.5) * 80;
      const left = prng(i, 4) * 100;
      const sizeRand = prng(i, 5);
      const size = sizeRand < 0.75
        ? 3 + Math.floor(sizeRand * 8)
        : 9 + Math.floor(((sizeRand - 0.75) / 0.25) * 10);
      const delay = prng(i, 6) * 3.2;
      const duration = 18 + prng(i, 7) * 22;
      const spinEnd = (prng(i, 9) - 0.5) * 80;
      const spinMid = spinEnd * 0.62 + (prng(i, 10) - 0.5) * 14;
      const timing = prng(i, 12) < 0.5
        ? 'cubic-bezier(0.22, 1, 0.36, 1)'
        : 'cubic-bezier(0.16, 1, 0.3, 1)';

      particle.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        --delay: ${delay}s;
        --duration: ${duration}s;
        --opacity: ${opacity};
        --scale: ${scale};
        --drift-start: ${driftStart}px;
        --drift-mid: ${driftMid}px;
        --drift-end: ${driftEnd}px;
        --spin-mid: ${spinMid}deg;
        --spin-end: ${spinEnd}deg;
        --timing: ${timing};
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
