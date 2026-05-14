<script lang="ts">
  import { Activity, Gem, Target } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { t as _t, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  let animate = $state(false);
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
      <img
        src="/assets/new_bmi_logo_216.webp"
        srcset="/assets/new_bmi_logo_128.webp 128w,
                /assets/new_bmi_logo_216.webp 216w,
                /assets/new_bmi_logo_256.webp 256w"
        sizes="(max-width: 360px) 64px, (max-width: 640px) 92px, 108px"
        alt="BMI Logo"
        width="216"
        height="216"
        fetchpriority="high"
        decoding="async"
      />
    </div>

    <h1 class="hero-title">
      <span class="title-gradient">{t('hero.title')}</span>
    </h1>

    <p class="hero-subtitle">
      {t('hero.subtitle')}
    </p>

    <div class="hero-features">
      <div class="feature">
        <Target class="Target" />
        <span>{t('hero.feature1')}</span>
      </div>
      <div class="feature">
        <Activity class="Activity" />
        <span>{t('hero.feature2')}</span>
      </div>
      <div class="feature">
        <Gem class="Gem" />
        <span>{t('hero.feature3')}</span>
      </div>
    </div>

    <div class="hero-bottom">
      <p class="hero-bottom-text">
        {t('hero.edition')}
      </p>
    </div>
  </div>

  <!-- End of hero content -->
</header>

<style>
  .hero-content {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.8s var(--easing-material),
                transform 0.8s var(--easing-material);
    /* will-change removed — browser auto-promotes during transition */
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