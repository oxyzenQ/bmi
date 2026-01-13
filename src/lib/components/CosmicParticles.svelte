<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getPerformanceTier, prefersReducedMotion } from '$lib/utils/performance';

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

  onMount(() => {
    reduced = prefersReducedMotion();
    if (reduced) return;

    const tier = getPerformanceTier();
    baseParticleCount = tier === 'low' ? 6 : tier === 'medium' ? 8 : 12;

    if (typeof window !== 'undefined') {
      const storedSmooth = localStorage.getItem('bmi.smoothMode');
      const storedUltra = storedSmooth ?? localStorage.getItem('bmi.ultraSmooth');
      smoothModeEnabled = storedUltra === '1' || storedUltra === 'true';
    }

    particleCount = computeParticleCount(tier, smoothModeEnabled);
    createParticles();
    scheduleRefresh();

    const handleSmoothMode = (event: Event) => {
      if (destroyed || reduced) return;
      const ce = event as CustomEvent<{ enabled?: boolean; requested?: boolean; status?: string }>;
      smoothModeEnabled = Boolean(ce.detail?.enabled ?? ce.detail?.requested);
      particleCount = computeParticleCount(tier, smoothModeEnabled);
      if (!paused) createParticles();
    };

    window.addEventListener('bmi:smoothMode', handleSmoothMode as EventListener);
    smoothModeHandler = () => window.removeEventListener('bmi:smoothMode', handleSmoothMode as EventListener);

    const handleVisibility = () => {
      if (destroyed || reduced) return;
      const isHidden = document.hidden;
      paused = isHidden;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      for (const p of particles) {
        p.style.animationPlayState = isHidden ? 'paused' : 'running';
      }

      if (!isHidden) {
        createParticles();
        scheduleRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    visibilityHandler = () => document.removeEventListener('visibilitychange', handleVisibility);

    handleVisibility();
  });

  onDestroy(() => {
    destroyed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    if (visibilityHandler) visibilityHandler();
    if (smoothModeHandler) smoothModeHandler();
  });

  function computeParticleCount(tier: 'high' | 'medium' | 'low', smoothEnabled: boolean) {
    if (!smoothEnabled) return baseParticleCount;
    if (tier === 'high') return Math.min(baseParticleCount + 5, 18);
    if (tier === 'medium') return Math.min(baseParticleCount + 3, 14);
    return Math.min(baseParticleCount + 1, 8);
  }

  function prng(i: number, salt: number) {
    const x = Math.sin((i + 1) * 999 + salt) * 10000;
    return x - Math.floor(x);
  }

  function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    return particle;
  }

  function createParticles() {
    if (!particlesContainer) return;

    particlesContainer.innerHTML = '';
    particles = [];

    // Create particles (optimized for performance)
    for (let i = 0; i < particleCount; i++) {
      const particle = createParticle();
      const opacity = 0.25 + prng(i, 1) * 0.6;
      const scale = 0.8 + prng(i, 2) * 0.9;
      const drift = (prng(i, 3) - 0.5) * 40;
      const left = prng(i, 4) * 100;
      const size = 2 + Math.floor(prng(i, 5) * 4);
      const delay = prng(i, 6) * 2;
      const duration = 10 + prng(i, 7) * 10;

      particle.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        opacity: ${opacity};
        --drift: ${drift}px;
        transform: translateZ(0) scale(${scale});
      `;

      particlesContainer.appendChild(particle);
      particles.push(particle);
    }
  }

  function scheduleRefresh() {
    if (destroyed) return;
    if (paused) return;
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
