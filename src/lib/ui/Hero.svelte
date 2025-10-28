<script lang="ts">
  import { onMount } from 'svelte';
  import { BookCheck, SquareSigma, Sparkles, Telescope, CircleChevronDown } from 'lucide-svelte';

  let heroContent: HTMLDivElement;
  let heroSectionEl: HTMLElement;

  function scrollToNextSection() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = heroSectionEl?.nextElementSibling as HTMLElement | null;
    const targetY = next ? Math.max(0, next.offsetTop - 8) : window.innerHeight;
    window.scrollTo({ top: targetY, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  onMount(() => {
    // Hero content animation - ensure immediate visibility with safe fallback
    if (heroContent) {
      // Set visible by default first
      heroContent.style.opacity = '1';
      heroContent.style.transform = 'translateY(0)';

      // Then apply entrance animation
      heroContent.style.opacity = '0';
      heroContent.style.transform = 'translateY(20px)';
      heroContent.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';

      // Immediate fallback to ensure visibility
      requestAnimationFrame(() => {
        heroContent.style.opacity = '1';
        heroContent.style.transform = 'translateY(0)';
      });
    }
  });
</script>

<header class="hero-section" bind:this={heroSectionEl}>
  <div class="hero-background">
    <!-- Bubbles and orbs removed for cleaner performance -->
  </div>

  <div bind:this={heroContent} class="hero-content">
    <div class="hero-avatar" aria-hidden="true">
      <img src="/assets/logobmii.webp" alt="BMI Logo" loading="lazy" decoding="async" />
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
        <BookCheck class="BookCheck" />
        <span>Health Insights</span>
      </div>
      <div class="feature">
        <Sparkles class="Sparkles" />
        <span>Modern Design</span>
      </div>
    </div>

    <div class="hero-bottom">
      <p class="hero-bottom-text">
        Stellar Edition 3.0
      </p>
    </div>
  </div>

  <!-- End of hero content -->
</header>

<!-- Scroll-down button standalone container (transparent) -->
<section class="hero-scroll-container" aria-hidden="true">
  <button
    type="button"
    class="hero-scroll-btn"
    aria-label="Scroll to next section"
    title="Scroll down"
    on:click={scrollToNextSection}
  >
    <CircleChevronDown class="hero-scroll-icon" />
  </button>
</section>
