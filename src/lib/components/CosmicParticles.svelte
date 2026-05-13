<script lang="ts">
  /**
   * Atmospheric Dust Field v2 — Gravitational particle system
   *
   * Premium cosmic atmosphere calibrated for human perception:
   * - 3-layer depth: faint far dust, visible mid-layer, hero accent particles
   * - Organic orbital drift with non-linear easing and distorted elliptical paths
   * - Gravitational center pull: ~20% of particles slowly spiral toward viewport center
   * - Hero particles: 2-3 brighter accent dots with persistent glow and prominent glint
   * - Adaptive complexity: 20-40 particles depending on device capability
   *
   * Artistic target: "Space dust illuminated by an invisible black hole accretion field."
   *
   * Pure DOM + CSS transforms + minimal JS for gravity. No canvas, no WebGL.
   */
  import { onMount, onDestroy } from 'svelte';
  import { getPerformanceTier } from '$lib/utils/animation-config';

  let container: HTMLDivElement;
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
  let smoothModeEnabled = true;
  let particles: HTMLDivElement[] = [];

  // ── Gravity simulation state ──
  interface GravityState {
    el: HTMLDivElement;
    baseX: number;
    baseY: number;
    offsetX: number;
    offsetY: number;
    vx: number;
    vy: number;
    baseOpacity: number;
  }
  let gravityParticles: GravityState[] = [];

  onMount(() => {
    tier = getPerformanceTier();
    smoothModeEnabled = true;
    updateReduced();
    document.documentElement.dataset.performanceTier = tier;

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
    gravityParticles = [];
  });

  /**
   * Adaptive particle count.
   * Mobile: 20/26/32 | Desktop: 28/34/40
   */
  function computeParticleCount(t: 'high' | 'medium' | 'low', smooth: boolean): number {
    if (!smooth) return 0;
    const isMobile = typeof window !== 'undefined' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (isMobile) {
      if (t === 'high') return 32;
      if (t === 'medium') return 26;
      return 20;
    }
    if (t === 'high') return 40;
    if (t === 'medium') return 34;
    return 28;
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
    setTimeout(() => {
      if (container) container.textContent = '';
      particles = [];
      gravityParticles = [];
      fading = false;
    }, 800);
  }

  function createParticles(animate: boolean) {
    if (!container) return;
    container.textContent = '';
    particles = [];
    gravityParticles = [];

    const frag = document.createDocumentFragment();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
    const cx = vw / 2;
    const cy = vh / 2;

    // Hero: 2-3 brightest particles (last indices)
    const heroCount = tier === 'high' ? 3 : 2;
    const normalCount = particleCount - heroCount;

    // Layer split: ~60% far (atmospheric), ~40% mid (visible)
    const farCount = Math.round(normalCount * 0.6);
    // midCount = normalCount - farCount

    // Gravity: 20% of normal particles — spiral toward center
    const gravityCount = Math.round(normalCount * 0.2);

    for (let i = 0; i < particleCount; i++) {
      const el = document.createElement('div');

      // Layer assignment by index order
      const isHero = i >= normalCount;
      const isMid = !isHero && i >= farCount;
      // else: far layer
      const isGravity = !isHero && i < gravityCount;

      // Base position: spread across viewport
      const angle = prng(i, 1) * Math.PI * 2;
      const dist = 0.2 + prng(i, 2) * 0.45; // 20-65% from center
      const x = cx + Math.cos(angle) * vw * dist;
      const y = cy + Math.sin(angle) * vh * dist;

      let size: number;
      let opacity: number;
      let speed: number;        // seconds for full orbit
      let orbitRadius: number;
      let glintDelay: number;
      let glintDuration: number;
      let glintPeak: number;
      let glintSpread: number;
      let cssClass = 'dust-particle';

      if (isHero) {
        // ── HERO LAYER: bright accent particles ──
        // Visible immediately, draws the eye, establishes "atmosphere exists"
        cssClass = 'dust-particle hero-particle';
        size = 3.5 + prng(i, 3) * 2.5;          // 3.5-6px
        opacity = 0.30 + prng(i, 4) * 0.10;     // 0.30-0.40
        speed = 30 + prng(i, 6) * 15;            // 30-45s (slow, stately)
        orbitRadius = 40 + prng(i, 7) * 55;      // 40-95px (wide drift)
        glintDelay = 3 + prng(i, 9) * 7;         // 3-10s (frequent)
        glintDuration = 3 + prng(i, 10) * 3;     // 3-6s (long pulse)
        glintPeak = 2.2;
        glintSpread = 8;
      } else if (isMid) {
        // ── MID LAYER: clearly visible, medium presence ──
        cssClass = 'dust-particle mid-particle';
        size = 2.5 + prng(i, 3) * 1.5;          // 2.5-4px
        opacity = 0.20 + prng(i, 4) * 0.08;     // 0.20-0.28
        speed = 22 + prng(i, 6) * 13;            // 22-35s
        orbitRadius = 25 + prng(i, 7) * 40;      // 25-65px
        glintDelay = 8 + prng(i, 9) * 18;        // 8-26s
        glintDuration = 2 + prng(i, 10) * 3;     // 2-5s
        glintPeak = 2.0;
        glintSpread = 4;
      } else {
        // ── FAR LAYER: faint atmospheric dust ──
        // Thin, slow, faint — fills depth without demanding attention
        size = 2 + prng(i, 3) * 1;              // 2-3px
        opacity = 0.16 + prng(i, 4) * 0.06;     // 0.16-0.22
        speed = 30 + prng(i, 6) * 12;            // 30-42s
        orbitRadius = 15 + prng(i, 7) * 25;      // 15-40px
        glintDelay = 12 + prng(i, 9) * 20;       // 12-32s
        glintDuration = 2 + prng(i, 10) * 2;     // 2-4s
        glintPeak = 1.8;
        glintSpread = 3;
      }

      const startAngle = prng(i, 8) * Math.PI * 2;
      const depth = prng(i, 5);

      el.className = cssClass;

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
        --orbit-speed: ${speed.toFixed(1)}s;
        --glint-delay: ${glintDelay.toFixed(1)}s;
        --glint-dur: ${glintDuration.toFixed(1)}s;
        --glint-peak: ${glintPeak};
        --glint-spread: ${glintSpread}px;
        ${animate ? 'transition: opacity 0.6s ease;' : ''}
      `;

      if (animate) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.opacity = String(opacity);
            el.style.transition = '';
          });
        });
      }

      // ── Gravity particle setup ──
      if (isGravity) {
        el.classList.add('gravity-particle');
        // Small initial tangential velocity for spiral (not straight radial)
        const perpAngle = angle + Math.PI / 2;
        const initSpeed = 0.03 + prng(i, 11) * 0.05;
        gravityParticles.push({
          el,
          baseX: x,
          baseY: y,
          offsetX: 0,
          offsetY: 0,
          vx: Math.cos(perpAngle) * initSpeed,
          vy: Math.sin(perpAngle) * initSpeed,
          baseOpacity: opacity,
        });
      }

      frag.appendChild(el);
      particles.push(el);
    }

    container.appendChild(frag);
    if (!paused) startAnimLoop();
  }

  /**
   * JS animation loop for gravity simulation.
   * Runs on ALL tiers — lightweight (8-16 particles max at 15-30fps).
   */
  function startAnimLoop() {
    if (animFrameId !== null) return;
    const interval = tier === 'high' ? 33 : tier === 'medium' ? 50 : 66;
    let lastTime = 0;

    const tick = (time: number) => {
      if (destroyed || paused || reduced) {
        animFrameId = null;
        return;
      }
      if (time - lastTime < interval) {
        animFrameId = requestAnimationFrame(tick);
        return;
      }
      lastTime = time;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = vw / 2;
      const cy = vh / 2;
      const minDim = Math.min(vw, vh);
      const killRadius = minDim * 0.04;
      const fadeStart = minDim * 0.14;
      const gravForce = 0.012;

      for (const gp of gravityParticles) {
        const absX = gp.baseX + gp.offsetX;
        const absY = gp.baseY + gp.offsetY;
        const dx = cx - absX;
        const dy = cy - absY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Respawn when swallowed by the center
        if (dist < killRadius) {
          const a = Math.random() * Math.PI * 2;
          const spawnDist = minDim * (0.35 + Math.random() * 0.2);
          gp.baseX = cx + Math.cos(a) * spawnDist;
          gp.baseY = cy + Math.sin(a) * spawnDist;
          gp.offsetX = 0;
          gp.offsetY = 0;
          // Small random tangential velocity for variety
          const newAngle = a + Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
          const newSpeed = 0.03 + Math.random() * 0.05;
          gp.vx = Math.cos(newAngle) * newSpeed;
          gp.vy = Math.sin(newAngle) * newSpeed;
          gp.el.style.left = `${gp.baseX}px`;
          gp.el.style.top = `${gp.baseY}px`;
          gp.el.style.transform = 'translate(0, 0)';
          // Smooth fade-in at respawn
          gp.el.style.transition = 'opacity 1.2s ease';
          gp.el.style.opacity = String(gp.baseOpacity);
          requestAnimationFrame(() => { gp.el.style.transition = ''; });
          continue;
        }

        // Gravitational pull — stronger when closer, capped for stability
        const accel = gravForce * Math.min(1, 60 / Math.max(20, dist));
        const nx = dx / dist;
        const ny = dy / dist;
        gp.vx += nx * accel;
        gp.vy += ny * accel;

        // Slight tangential component → spiral, not straight radial
        gp.vx += (-ny) * 0.004;
        gp.vy += nx * 0.004;

        // Damping
        gp.vx *= 0.996;
        gp.vy *= 0.996;

        gp.offsetX += gp.vx;
        gp.offsetY += gp.vy;

        // Fade out as approaching center
        const fadeMult = Math.min(1, Math.max(0, (dist - killRadius) / (fadeStart - killRadius)));
        gp.el.style.transform = `translate(${gp.offsetX.toFixed(1)}px, ${gp.offsetY.toFixed(1)}px)`;
        gp.el.style.opacity = String((gp.baseOpacity * fadeMult).toFixed(3));
      }

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
