<script lang="ts">
  /**
   * Atmospheric Dust Field — Gravitational particle system
   *
   * Evolution from rain effect to premium cosmic atmosphere:
   * - Tiny floating particles with slow orbital drift
   * - Subtle gravitational curvature toward viewport center
   * - Ultra-low opacity, sparse distribution
   * - Occasional micro-glint on high-end devices
   * - Adaptive complexity: fewer particles on low-end, layered depth on high-end
   *
   * Pure DOM + CSS transforms. No canvas, no WebGL.
   */
  import { onMount, onDestroy } from 'svelte';
  import { getPerformanceTier } from '$lib/utils/animation-config';

  let container: HTMLDivElement;
  let particles: HTMLDivElement[] = [];
  let destroyed = false;
  let reduced = $state(false);
  let paused = $state(false);
  let visibilityHandler: (() => void) | null = null;
  let smoothModeHandler: (() => void) | null = null;
  let tier: 'high' | 'medium' | 'low' = 'medium';
  let animFrameId: number | null = null;
  let particleCount = 16;
  let fading = $state(false);
  let visible = $state(false);

  onMount(() => {
    tier = getPerformanceTier();
    smoothModeEnabled = true;
    updateReduced();

    if (typeof document !== 'undefined') {
      document.documentElement.dataset.performanceTier = tier;
    }

    const handleSmoothMode = (event: Event) => {
      if (destroyed) return;
      const ce = event as CustomEvent<{ enabled?: boolean; requested?: boolean }>;
      const enabled = Boolean(ce.detail?.enabled ?? ce.detail?.requested);
      smoothModeEnabled = enabled;
      updateReduced();

      if (reduced) {
        fadeOut();
        return;
      }

      visible = true;
      const nextCount = computeParticleCount(tier, smoothModeEnabled);
      if (particles.length !== nextCount) {
        particleCount = nextCount;
        if (!paused) createParticles(true);
      } else if (!paused && particles.length === 0) {
        fadeIn();
      }
    };

    window.addEventListener('bmi:smoothMode', handleSmoothMode as EventListener);
    smoothModeHandler = () => window.removeEventListener('bmi:smoothMode', handleSmoothMode as EventListener);

    const handleVisibility = () => {
      if (destroyed) return;
      paused = document.hidden;
      if (!paused && !reduced) {
        if (particles.length === 0) {
          fadeIn();
        } else {
          visible = true;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    visibilityHandler = () => document.removeEventListener('visibilitychange', handleVisibility);

    if (!reduced && !document.hidden) {
      particleCount = computeParticleCount(tier, smoothModeEnabled);
      createParticles(false);
      visible = true;
    }
  });

  onDestroy(() => {
    destroyed = true;
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    if (visibilityHandler) visibilityHandler();
    if (smoothModeHandler) smoothModeHandler();
    particles = [];
  });

  let smoothModeEnabled = true;

  function computeParticleCount(t: 'high' | 'medium' | 'low', smooth: boolean): number {
    if (!smooth) return 0;
    const isMobile = typeof window !== 'undefined' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    // Mobile: 10/12/14 | Desktop: 14/18/24
    if (isMobile) {
      if (t === 'high') return 14;
      if (t === 'medium') return 12;
      return 10;
    }
    if (t === 'high') return 24;
    if (t === 'medium') return 18;
    return 14;
  }

  function updateReduced() {
    reduced = !smoothModeEnabled;
  }

  /** Deterministic pseudo-random for reproducible layouts */
  function prng(i: number, salt: number, seed = 7777) {
    const x = Math.sin((i + 1) * seed + salt) * 10000;
    return x - Math.floor(x);
  }

  function fadeIn() {
    if (destroyed || fading) return;
    fading = true;
    visible = true;
    createParticles(true);
    setTimeout(() => { fading = false; }, 600);
  }

  function fadeOut() {
    if (destroyed || fading) return;
    fading = true;
    visible = false;
    // Let CSS transition handle the fade, then remove DOM
    setTimeout(() => {
      if (container) container.textContent = '';
      particles = [];
      fading = false;
    }, 800);
  }

  function createParticles(animate: boolean) {
    if (!container) return;

    container.textContent = '';
    particles = [];

    const frag = document.createDocumentFragment();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
    const cx = vw / 2;
    const cy = vh / 2;
    const hasParallax = tier === 'high';
    const hasGlint = tier === 'high';

    for (let i = 0; i < particleCount; i++) {
      const el = document.createElement('div');
      el.className = 'dust-particle';

      // Position: spread across viewport, avoid dead center cluster
      const angle = prng(i, 1) * Math.PI * 2;
      const dist = 0.25 + prng(i, 2) * 0.4; // 25-65% from center
      const x = cx + Math.cos(angle) * vw * dist;
      const y = cy + Math.sin(angle) * vh * dist;

      // Size: 1.5-3px tiny dots
      const size = 1.5 + prng(i, 3) * 1.5;

      // Opacity: very low, atmospheric
      const opacity = 0.08 + prng(i, 4) * 0.18;

      // Depth layer (0 = far, 1 = near) for parallax
      const depth = prng(i, 5);

      // Orbital speed: slow, varies per particle
      const speed = 0.15 + prng(i, 6) * 0.35; // 0.15-0.5 multiplier
      const orbitRadius = 20 + prng(i, 7) * 60; // 20-80px drift radius
      const startAngle = prng(i, 8) * Math.PI * 2;

      // Micro-glint: occasional brightness pulse (high-end only)
      const glintDelay = hasGlint ? (8 + prng(i, 9) * 20).toFixed(1) : '0';
      const glintDuration = hasGlint ? (2 + prng(i, 10) * 3).toFixed(1) : '0';

      el.style.cssText = `
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        opacity: ${animate ? 0 : opacity};
        --target-opacity: ${opacity};
        --depth: ${depth};
        --orbit-r: ${orbitRadius}px;
        --orbit-start: ${startAngle.toFixed(3)}rad;
        --orbit-speed: ${(speed * 60).toFixed(1)}s;
        --glint-delay: ${glintDelay}s;
        --glint-dur: ${glintDuration}s;
        ${animate ? 'transition: opacity 0.6s ease;' : ''}
        ${hasParallax ? `--parallax-factor: ${(0.3 + depth * 0.7).toFixed(2)};` : ''}
      `;

      if (animate) {
        // Trigger fade-in after DOM insert
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.opacity = String(opacity);
            el.style.transition = '';
          });
        });
      }

      frag.appendChild(el);
      particles.push(el);
    }

    container.appendChild(frag);

    // Start animation loop (or let CSS handle it for medium/low)
    if (hasParallax && !paused) {
      startAnimLoop();
    }
  }

  let scrollX = 0;
  let scrollY = 0;

  function startAnimLoop() {
    if (animFrameId !== null) return;

    let lastTime = 0;
    const tick = (time: number) => {
      if (destroyed || paused || reduced) {
        animFrameId = null;
        return;
      }
      // Throttle to ~30fps for dust (no need for 60fps on ambient particles)
      if (time - lastTime < 33) {
        animFrameId = requestAnimationFrame(tick);
        return;
      }
      lastTime = time;

      const sx = window.scrollX || 0;
      const sy = window.scrollY || 0;

      for (const el of particles) {
        const factor = parseFloat(el.style.getPropertyValue('--parallax-factor') || '0.5');
        const dx = (sx - scrollX) * factor * 0.02;
        const dy = (sy - scrollY) * factor * 0.02;
        el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      }

      scrollX = sx;
      scrollY = sy;
      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
  }
</script>

<div
  bind:this={container}
  class="cosmic-particles"
  class:is-paused={paused}
  class:dust-active={visible}
  class:dust-fading={fading}
  aria-hidden="true"
></div>
