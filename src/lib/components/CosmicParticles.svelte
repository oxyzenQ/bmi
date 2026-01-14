<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getPerformanceTier } from '$lib/utils/performance';

  let particlesContainer: HTMLDivElement;
  let particles: HTMLDivElement[] = [];
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
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

    if (typeof window !== 'undefined') {
      const storedRenderMode = localStorage.getItem('bmi.renderMode');
      if (storedRenderMode === null) {
        const storedSmooth = localStorage.getItem('bmi.smoothMode');
        const storedUltra = localStorage.getItem('bmi.ultraSmooth');
        const hasLegacy = storedSmooth !== null || storedUltra !== null;
        smoothModeEnabled =
          hasLegacy
            ? (storedSmooth === '1' || storedSmooth === 'true' || storedUltra === '1' || storedUltra === 'true')
            : true;
        localStorage.setItem('bmi.renderMode', smoothModeEnabled ? '1' : '0');
        localStorage.removeItem('bmi.smoothMode');
        localStorage.removeItem('bmi.ultraSmooth');
      } else {
        smoothModeEnabled = storedRenderMode === '1' || storedRenderMode === 'true';
      }
    }

    updateReduced();

    const handleSmoothMode = (event: Event) => {
      if (destroyed) return;
      const ce = event as CustomEvent<{ enabled?: boolean; requested?: boolean; status?: string }>;
      smoothModeEnabled = Boolean(ce.detail?.enabled ?? ce.detail?.requested);
      const wasReduced = reduced;
      updateReduced();

      if (reduced) {
        stopParticles();
        return;
      }

      particleCount = computeParticleCount(tier, smoothModeEnabled);
      if (!paused) {
        createParticles();
        scheduleRefresh();
      }

      if (wasReduced) {
        for (const p of particles) p.style.animationPlayState = paused ? 'paused' : 'running';
      }
    };

    window.addEventListener('bmi:smoothMode', handleSmoothMode as EventListener);
    smoothModeHandler = () => window.removeEventListener('bmi:smoothMode', handleSmoothMode as EventListener);

    const handleVisibility = () => {
      if (destroyed) return;
      const isHidden = document.hidden;
      paused = isHidden;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      for (const p of particles) p.style.animationPlayState = isHidden ? 'paused' : 'running';

      if (isHidden) return;
      if (reduced) return;
      createParticles();
      scheduleRefresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    visibilityHandler = () => document.removeEventListener('visibilitychange', handleVisibility);

    handleVisibility();

    if (!reduced) {
      particleCount = computeParticleCount(tier, smoothModeEnabled);
      createParticles();
      scheduleRefresh();
    } else {
      stopParticles();
    }
  });

  onDestroy(() => {
    destroyed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    if (visibilityHandler) visibilityHandler();
    if (smoothModeHandler) smoothModeHandler();
  });

  function computeParticleCount(tier: 'high' | 'medium' | 'low', smoothEnabled: boolean) {
    if (!smoothEnabled) return baseParticleCount;
    if (tier === 'high') return Math.min(baseParticleCount + 16, 48);
    if (tier === 'medium') return Math.min(baseParticleCount + 12, 38);
    return Math.min(baseParticleCount + 8, 22);
  }

  function updateReduced() {
    reduced = !smoothModeEnabled;
  }

  function stopParticles() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (particlesContainer) particlesContainer.innerHTML = '';
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

    particlesContainer.innerHTML = '';
    particles = [];

    // Create particles (optimized for performance)
    for (let i = 0; i < particleCount; i++) {
      const particle = createParticle();
      const opacity = 0.35 + prng(i, 1) * 0.55;
      const scale = 1.1 + prng(i, 2) * 1.2;
      const driftStart = (prng(i, 3) - 0.5) * 120;
      const driftEnd = driftStart + (prng(i, 8) - 0.5) * 180;
      const left = prng(i, 4) * 100;
      const size = 6 + Math.floor(prng(i, 5) * 10);
      const delay = prng(i, 6) * 2;
      const duration = 14 + prng(i, 7) * 18;

      particle.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        --delay: ${delay}s;
        --duration: ${duration}s;
        --opacity: ${opacity};
        --scale: ${scale};
        --drift-start: ${driftStart}px;
        --drift-end: ${driftEnd}px;
      `;

      particlesContainer.appendChild(particle);
      particles.push(particle);
    }
  }

  function scheduleRefresh() {
    if (destroyed) return;
    if (paused) return;
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    refreshTimer = setTimeout(() => {
      if (destroyed) return;
      createParticles();
      scheduleRefresh();
    }, 120000);
  }
</script>

<div
  bind:this={particlesContainer}
  class="cosmic-particles"
  aria-hidden="true"
></div>
