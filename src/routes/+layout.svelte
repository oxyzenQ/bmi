<script lang="ts">
  import '../global-styles.css';
  import CosmicParticles from '$lib/components/CosmicParticles.svelte';
  import SplashScreen from '$lib/components/SplashScreen.svelte';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let showSplash = false; // Disabled by default
  let showMainContent = true; // Show content immediately
  const splashDuration = 10000; // 10s relaxed experience (if enabled)
  let renderModeEnabled = true;
  let renderModeInitialized = false;

  // Extracted function to avoid duplicate localStorage logic
  function initRenderMode(): boolean {
    try {
      const storedRenderMode = localStorage.getItem('bmi.renderMode');
      return storedRenderMode === null ? true : storedRenderMode === '1' || storedRenderMode === 'true';
    } catch {
      return true;
    }
  }

  if (browser) {
    renderModeEnabled = initRenderMode();
    renderModeInitialized = true;
    document.documentElement.dataset.graphics = renderModeEnabled ? 'render' : 'basic';
  }

  onMount(() => {
    // NOTE: scroll-optimizer merged into +page.svelte unified scroll handler

    let cleanupRenderListener: (() => void) | null = null;

    if (browser) {
      if (!renderModeInitialized) {
        renderModeEnabled = initRenderMode();
        renderModeInitialized = true;
      }

      const handleRenderMode = (event: Event) => {
        const ce = event as CustomEvent<{ enabled?: boolean; requested?: boolean; status?: string }>;
        renderModeEnabled = Boolean(ce.detail?.enabled ?? ce.detail?.requested);
      };

      window.addEventListener('bmi:smoothMode', handleRenderMode as EventListener);
      cleanupRenderListener = () =>
        window.removeEventListener('bmi:smoothMode', handleRenderMode as EventListener);
    }

    // Register service worker for caching (only in production)
    if (browser && 'serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        if (import.meta.env.DEV) {
          console.error('Service worker registration failed:', err);
        }
      });
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    if (showSplash) {
      // Reveal main content slightly before auto-hide, aligned with exit phase (~91.7% of duration)
      const exitPhaseRatio = 5.5 / 6; // from original 6s design
      const revealDelay = Math.round(splashDuration * exitPhaseRatio);
      timer = setTimeout(() => {
        showMainContent = true;
      }, revealDelay);
    }

    return () => {
      if (timer) clearTimeout(timer);
      cleanupRenderListener?.();
    };
  });

  function handleSplashComplete() {
    showSplash = false;
    showMainContent = true;
  }
</script>


{#if showSplash}
  <SplashScreen
    bind:show={showSplash}
    duration={splashDuration}
    onComplete={handleSplashComplete}
  />
{/if}

{#if renderModeEnabled}
  <CosmicParticles />
{/if}

<div class="main-content" class:visible={showMainContent}>
  <slot />
</div>

<style>
  .main-content {
    position: relative;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.5s var(--easing-smooth);
  }

  .main-content.visible {
    opacity: 1;
  }
</style>
