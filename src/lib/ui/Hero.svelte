<script lang="ts">
  import { BookOpenCheck, SquareSigma, Sparkles, Hexagon } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';

  let animate = false;
  let rafId: number | null = null;

  onMount(() => {
    rafId = requestAnimationFrame(() => {
      animate = true;
    });
  });

  onDestroy(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  });
</script>

<header class="hero-section">
  <div class="hero-content" class:animate>
    <div class="hero-avatar" aria-hidden="true">
      <img src="/assets/new_bmi_logo_2026.webp" alt="BMI Logo" fetchpriority="high" decoding="async" />
    </div>

    <h1 class="hero-title">
      <span class="title-gradient">BMI Calculator</span>
      <Hexagon class="Hexagon sparkle-icon" />
    </h1>

    <p class="hero-subtitle">
      Precision body metrics — designed with modern health-first principles.
    </p>

    <div class="hero-features">
      <div class="feature">
        <SquareSigma class="SquareSigma" />
        <span>Accurate</span>
      </div>
      <div class="feature">
        <BookOpenCheck class="BookOpenCheck" />
        <span>Insights</span>
      </div>
      <div class="feature">
        <Sparkles class="Sparkles" />
        <span>Premium</span>
      </div>
    </div>

    <div class="hero-bottom">
      <p class="hero-bottom-text">
        Web3 Crypto Edition
      </p>
    </div>
  </div>
</header>

<style>
  .hero-content {
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.6s ease, transform 0.6s ease;
    will-change: opacity, transform;
  }

  .hero-content.animate {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-content {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
