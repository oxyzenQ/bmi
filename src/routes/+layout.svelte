<script lang="ts">
  import '../global-styles.css';
  import CosmicParticles from '$lib/components/CosmicParticles.svelte';
  import SplashScreen from '$lib/components/SplashScreen.svelte';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let showSplash = false; // Disabled by default
  let showMainContent = true; // Show content immediately
  const splashDuration = 10000; // 10s relaxed experience (if enabled)

  onMount(() => {
    // Register service worker for caching (only in production)
    if (browser && 'serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    }

    // Reveal main content slightly before auto-hide, aligned with exit phase (~91.7% of duration)
    const exitPhaseRatio = 5.5 / 6; // from original 6s design
    const revealDelay = Math.round(splashDuration * exitPhaseRatio);
    const timer = setTimeout(() => {
      showMainContent = true;
    }, revealDelay);

    return () => {
      clearTimeout(timer);
    };
  });

  function handleSplashComplete() {
    showSplash = false;
    showMainContent = true;
  }
</script>


<SplashScreen
  bind:show={showSplash}
  duration={splashDuration}
  on:complete={handleSplashComplete}
/>

<CosmicParticles />

<div class="main-content" class:visible={showMainContent}>
  <slot />
</div>

<style>
  .main-content {
    opacity: 0;
    transition: opacity 0.5s var(--easing-smooth);
  }

  .main-content.visible {
    opacity: 1;
  }
</style>
