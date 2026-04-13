<script lang="ts">
  import { BookOpenCheck, SquareSigma, Sparkles, Telescope } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';

  let animate = false;
  let rafId: number | null = null;

  onMount(() => {
    // Trigger animation on next frame for smooth entry
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
  <div class="hero-background">
    <!-- Bubbles and orbs removed for cleaner performance -->
  </div>

  <div class="hero-content" class:animate>
    <div class="hero-avatar" aria-hidden="true">
      <img src="/assets/new_bmi_logo_2026.webp" alt="BMI Logo" fetchpriority="high" decoding="async" />
    </div>

    <h1 class="hero-title">
      <span class="title-gradient">BMI Calculator</span>
      <Telescope class="Telescope sparkle-icon" />
    </h1>

    <p class="hero-subtitle">
      Explore the cosmos of your body — discover your balance under the stars.
    </p>

    <div class="hero-features">
      <div class="feature">
        <SquareSigma class="SquareSigma" />
        <span>Accurate Calculations</span>
      </div>
      <div class="feature">
        <BookOpenCheck class="BookOpenCheck" />
        <span>Health Insights</span>
      </div>
      <div class="feature">
        <Sparkles class="Sparkles" />
        <span>Modern Design</span>
      </div>
    </div>

    <div class="hero-bottom">
      <p class="hero-bottom-text">
        Stellar Edition 10.0
      </p>
    </div>
  </div>

  <!-- End of hero content -->
</header>

<style>
  .hero-content {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
                transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: opacity, transform;
  }

  .hero-content.animate {
    opacity: 1;
    transform: translateY(0);
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .hero-content {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
