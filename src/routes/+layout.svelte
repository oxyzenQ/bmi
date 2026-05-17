<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
  /* ── Design tokens (must load first — all CSS custom properties) ── */
  import '../styles/tokens.css';
  /* ── Base resets, typography, utility classes ── */
  import '../styles/base.css';
  /* ── Lucide icon sizing (fluid clamp for large, fixed 24px for small) ── */
  import '../styles/icons.css';
  /* ── Glassmorphism containers, button system, hero section ── */
  import '../styles/components.css';
  /* ── BMI form layout, inputs, validation ── */
  import '../styles/form.css';
  /* ── BMI results card, share/action buttons, empty states ── */
  import '../styles/results.css';
  /* ── Stat grid, TDEE, radial gauge, reference table ── */
  import '../styles/data-cards.css';
  /* ── Layout, footer ── */
  import '../styles/layout.css';
  /* ── Responsive: base rules, form width reduction ── */
  import '../styles/responsive-base.css';
  /* ── Responsive: width-based breakpoints (768px → 250px, ultrawide) ── */
  import '../styles/responsive-width.css';
  /* ── Responsive: height-based breakpoints (640px, 520px) ── */
  import '../styles/responsive-height.css';
  /* ── Responsive: backdrop-filter fallback (must load after components) ── */
  import '../styles/responsive-backdrop.css';
  /* ── Pager / bottom navbar ── */
  import '../styles/nav.css';
  /* ── Language switcher floating panel (portaled to body) ── */
  import '../styles/lang-switcher.css';
  /* ── Skeleton loading, shooting stars, haptic feedback ── */
  import '../styles/animation.css';
  /* ── Touch device scroll performance (MUST load last — uses !important overrides) ── */
  import '../styles/responsive-mobile-perf.css';
  /* ── Final responsive content correction layer (loads after mobile-perf) ── */
  import '../styles/responsive-content.css';
  import { onMount, type Snippet } from 'svelte';
  import { browser } from '$app/environment';
  import { fade } from 'svelte/transition';
  import { WifiOff } from 'lucide-svelte';
  import { initStorage } from '$lib/utils/storage';
  import { hydratePwaInstallState, registerPwaInstallPrompt } from '$lib/stores/pwa-install';
  import { t as _t, localeVersion } from '$lib/i18n';
  import { warnDevOnce } from '$lib/utils/warn-dev';
  let _rv = $derived($localeVersion);
  function t(key: string): string { void _rv; return _t(key); }

  let { children }: { children: Snippet } = $props();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let DebugPanelComponent: any = $state(null);

  // ── Button ripple effect (delegated on document) ──
  function initButtonRipple() {
    if (!browser) return () => {};
    const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (isCoarsePointer) return () => {};

    function handlePointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
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
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }

  // PWA state
  let isOffline = $state(false);

  onMount(() => {
    let cleanupFns: Array<() => void> = [];

    // Initialize IndexedDB storage layer + run localStorage migration if needed
    if (browser) {
      // v16.0 Observability: initialize logger session (dev-only)
      if (!import.meta.env.PROD) {
        import('$lib/utils/logger').then(({ logger }) => {
          import('$lib/utils/trace').then(({ getSessionTraceId }) => {
            logger.info('app', 'bootstrap', `Session started — trace ${getSessionTraceId()}`);
          });
        });
        import('$lib/utils/dev-diagnostics').then(({ initDevDiagnostics }) => initDevDiagnostics());
        import('$lib/components/DebugPanel.svelte').then((mod) => {
          DebugPanelComponent = mod.default;
        });
      }
      void initStorage();

      // Button ripple micro-interaction
      cleanupFns.push(initButtonRipple());
    }

    // Register service worker for caching (only in production)
    if (browser && 'serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch((err) => {
        warnDevOnce('layout', 'serviceWorker', 'Service worker registration failed', err);
      });
    }

    // PWA: install prompt handler
    if (browser) {
      hydratePwaInstallState();
      const handleBeforeInstall = (e: Event) => registerPwaInstallPrompt(e);
      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      cleanupFns.push(() => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      });

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
          } catch (err) { warnDevOnce('layout', 'WebVitals', `Metric '${type}' not supported`, err); }
        };

        // Web Vitals observation (silent in production)
        observe('largest-contentful-paint', () => { /* LCP tracked silently */ });
        observe('layout-shift', () => { /* CLS tracked silently */ });

        // INP: only supported in Chromium 123+ behind flag; skip if unsupported
        if (PerformanceObserver.supportedEntryTypes?.includes('interaction-to-next-paint')) {
          observe('interaction-to-next-paint', () => { /* INP tracked silently */ });
        }
      } catch (err) { warnDevOnce('layout', 'WebVitals', 'PerformanceObserver failed', err); }
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

<div class="main-content">
  {@render children()}
</div>

<!-- Offline Badge -->
{#if isOffline}
  <div class="pwa-offline-badge" transition:fade={{ duration: 250 }}>
    <WifiOff size={14} aria-hidden="true" />
    <span>{t('pwa.offline')}</span>
  </div>
{/if}

<!-- v16.0 Observability: Debug Panel (dev-only, lazy-loaded) -->
{#if DebugPanelComponent}
  {@const Panel = DebugPanelComponent}
  <Panel />
{/if}

<style>
  .main-content {
    position: relative;
    z-index: var(--z-content);
  }

  /* Offline Badge */
  .pwa-offline-badge {
    position: fixed;
    top: 0.5rem;
    right: 0.5rem;
    z-index: var(--z-fab);
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    border-radius: var(--radius-pill);
    background: var(--darkred-85);
    backdrop-filter: blur(8px);
    color: var(--stellar-white);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    pointer-events: none;
  }
</style>
