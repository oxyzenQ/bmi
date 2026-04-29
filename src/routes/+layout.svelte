<script lang="ts">
  /* ── Design tokens (must load first — all CSS custom properties) ── */
  import '../styles/tokens.css';
  /* ── Base resets, typography, utility classes ── */
  import '../styles/base.css';
  /* ── Glassmorphism containers, button system, hero section ── */
  import '../styles/components.css';
  /* ── BMI form layout, inputs, validation ── */
  import '../styles/form.css';
  /* ── BMI results card, share/action buttons, empty states ── */
  import '../styles/results.css';
  /* ── Stat grid, TDEE, radial gauge, reference table ── */
  import '../styles/data-cards.css';
  /* ── Cosmic particles, footer ── */
  import '../styles/layout.css';
  /* ── Responsive breakpoints, reduced motion ── */
  import '../styles/responsive.css';
  /* ── Pager / bottom navbar ── */
  import '../styles/nav.css';
  /* ── Language switcher floating panel (portaled to body) ── */
  import '../styles/lang-switcher.css';
  /* ── Skeleton loading, shooting stars, haptic feedback ── */
  import '../styles/animation.css';
  import CosmicParticles from '$lib/components/CosmicParticles.svelte';
  import { onMount, type Snippet } from 'svelte';
  import { browser } from '$app/environment';
  import { fade } from 'svelte/transition';
  import { Download, WifiOff } from 'lucide-svelte';

  let { children }: { children: Snippet } = $props();
  let showMainContent = $state(true); // Show content immediately
  let renderModeEnabled = $state(true);
  let renderModeInitialized = false;

  // ── Button ripple effect (delegated on document) ──
  function initButtonRipple() {
    if (!browser) return () => {};
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const btn = target.closest('button, .btn, a.button, .action-btn, .gauge-cta-btn, .sex-btn') as HTMLElement | null;
      if (!btn) return;
      // Don't ripple on disabled buttons
      if (btn.hasAttribute('disabled') || btn.hasAttribute('aria-disabled')) return;

      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
      btn.appendChild(ripple);

      ripple.addEventListener('animationend', () => {
        ripple.remove();
      });
    }
    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }

  // PWA state
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  let canInstall = $state(false);
  let isInstalled = $state(false);
  let isOffline = $state(false);
  let showInstallBanner = $state(false);
  let installDismissed = false;

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  function readRenderMode(): boolean {
    try {
      const stored = localStorage.getItem('bmi.renderMode');
      return stored === null ? true : stored === '1' || stored === 'true';
    } catch {
      return true;
    }
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      isInstalled = true;
      canInstall = false;
      showInstallBanner = false;
    }
    deferredPrompt = null;
  }

  function dismissInstallBanner() {
    showInstallBanner = false;
    installDismissed = true;
  }

  if (browser) {
    const mode = readRenderMode();
    renderModeEnabled = mode;
    renderModeInitialized = true;
    document.documentElement.dataset.graphics = mode ? 'render' : 'basic';
  }

  onMount(() => {
    let cleanupFns: Array<() => void> = [];

    if (browser) {
      if (!renderModeInitialized) {
        renderModeEnabled = readRenderMode();
        renderModeInitialized = true;
      }

      // Button ripple micro-interaction
      cleanupFns.push(initButtonRipple());

      const handleRenderMode = (event: Event) => {
        const ce = event as CustomEvent<{ enabled?: boolean; requested?: boolean; status?: string }>;
        renderModeEnabled = Boolean(ce.detail?.enabled ?? ce.detail?.requested);
      };

      window.addEventListener('bmi:smoothMode', handleRenderMode as EventListener);
      cleanupFns.push(() => window.removeEventListener('bmi:smoothMode', handleRenderMode as EventListener));
    }

    // Register service worker for caching (only in production)
    if (browser && 'serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/service-worker.js', { type: 'classic' }).catch((err) => {
        if (import.meta.env.DEV) console.warn('SW registration skipped:', err.message);
      });
    }

    // PWA: install prompt handler
    if (browser) {
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        canInstall = true;
        if (!installDismissed) {
          setTimeout(() => { showInstallBanner = true; }, 3000);
        }
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      cleanupFns.push(() => window.removeEventListener('beforeinstallprompt', handleBeforeInstall));

      // Check if already installed (standalone mode)
      if (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator)) {
        isInstalled = true;
      }

      // Online/offline detection
      const handleOnline = () => { isOffline = false; };
      const handleOffline = () => { isOffline = true; };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      cleanupFns.push(() => window.removeEventListener('online', handleOnline));
      cleanupFns.push(() => window.removeEventListener('offline', handleOffline));
      isOffline = !navigator.onLine;
    }

    // B-3: Set canonical URL from current location
    if (browser) {
      canonicalUrl = window.location.origin + window.location.pathname;
      const onHashChange = () => {
        canonicalUrl = window.location.origin + window.location.pathname + window.location.hash;
      };
      window.addEventListener('hashchange', onHashChange);
      cleanupFns.push(() => window.removeEventListener('hashchange', onHashChange));
    }

    // B-1: Web Vitals observer (LCP, CLS, INP)
    if (browser && 'PerformanceObserver' in window) {
      try {
        const observe = (type: string, callback: (entry: PerformanceEntry) => void) => {
          try {
            const po = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) callback(entry);
              po.disconnect();
            });
            po.observe({ type, buffered: true });
          } catch { /* metric type not supported in this browser */ }
        };

        observe('largest-contentful-paint', (e) => {
          const val = Math.round(e.startTime);
          console.log(`[Vitals] LCP: ${val}ms${val > 2500 ? ' (slow)' : val > 1200 ? ' (needs-improvement)' : ' (good)'}`);
        });

        observe('layout-shift', (e) => {
          const entry = e as PerformanceEntry & { value: number };
          const val = entry.value;
          console.log(`[Vitals] CLS: ${val.toFixed(3)}${val > 0.25 ? ' (poor)' : val > 0.1 ? ' (needs-improvement)' : ' (good)'}`);
        });

        // INP: only supported in Chromium 123+ behind flag; skip if unsupported
        if (PerformanceObserver.supportedEntryTypes?.includes('interaction-to-next-paint')) {
          observe('interaction-to-next-paint', (e) => {
            const val = Math.round(e.startTime);
            console.log(`[Vitals] INP: ${val}ms${val > 500 ? ' (poor)' : val > 200 ? ' (needs-improvement)' : ' (good)'}`);
          });
        }
      } catch { /* PerformanceObserver failed */ }
    }

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  });

  // B-3: Dynamic og:url
  let canonicalUrl = $state('');

</script>

<svelte:head>
  {#if canonicalUrl}
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:url" content={canonicalUrl} />
    <meta name="twitter:url" content={canonicalUrl} />
  {/if}
</svelte:head>

<div class="main-content" class:visible={showMainContent}>
  {@render children()}
</div>

{#if renderModeEnabled}
  <CosmicParticles />
{/if}

<!-- PWA Install Banner -->
{#if showInstallBanner && canInstall && !isInstalled}
  <div class="pwa-install-bar" transition:fade={{ duration: 250 }}>
    <div class="pwa-install-content">
      <Download size={18} aria-hidden="true" />
      <span class="pwa-install-text">Install this app for quick access</span>
      <button class="pwa-install-btn" onclick={handleInstallClick}>Install</button>
      <button class="pwa-dismiss-btn" onclick={dismissInstallBanner} aria-label="Dismiss">✕</button>
    </div>
  </div>
{/if}

<!-- Offline Badge -->
{#if isOffline}
  <div class="pwa-offline-badge" transition:fade={{ duration: 250 }}>
    <WifiOff size={14} aria-hidden="true" />
    <span>Offline</span>
  </div>
{/if}

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

  /* PWA Install Banner */
  .pwa-install-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    padding: 0.5rem;
    background: var(--cosmic-base-95);
    backdrop-filter: blur(16px) saturate(180%);
    border-top: 1px solid var(--w-10);
  }

  .pwa-install-content {
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    color: var(--w-70);
    font-size: 0.8rem;
  }

  .pwa-install-text {
    flex: 1;
    text-align: center;
  }

  .pwa-install-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.85rem;
    border-radius: 9999px;
    border: none;
    background: var(--cosmic-purple);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .pwa-install-btn:hover {
    filter: brightness(1.15);
  }

  .pwa-dismiss-btn {
    background: none;
    border: none;
    color: var(--w-50);
    cursor: pointer;
    padding: 0.25rem 0.4rem;
    font-size: 0.85rem;
    border-radius: 9999px;
    line-height: 1;
  }

  .pwa-dismiss-btn:hover {
    color: var(--w-80);
    background: var(--w-6);
  }

  /* Offline Badge */
  .pwa-offline-badge {
    position: fixed;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 999;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    background: var(--darkred-85);
    backdrop-filter: blur(8px);
    color: white;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    pointer-events: none;
  }
</style>
