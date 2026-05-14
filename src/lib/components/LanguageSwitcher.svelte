<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Globe, X } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import { t as _t, locales, setLocale, localeVersion, locale } from '$lib/i18n';
  import type { Locale, TParams } from '$lib/i18n';
  import { portal } from '$lib/actions/portal';

  // Reactive dependency on locale version so t() re-evaluates on locale change
  let _rv = $derived($localeVersion);

  // Shadow t() — reading _rv creates a reactive dependency
  // so every template {t('key')} call re-runs when locale changes
  function t(key: string, params?: TParams): string {
    void _rv;
    return _t(key, params);
  }

  let open = $state(false);
  let visible = $state(false);
  let mounted = $state(false);

  function handleToggle() {
    open = !open;
  }

  async function handleSelect(code: Locale) {
    await setLocale(code);
    closePanel();
  }

  let closePanelTimer: ReturnType<typeof setTimeout> | null = null;

  function closePanel() {
    visible = false;
    if (closePanelTimer) clearTimeout(closePanelTimer);
    closePanelTimer = setTimeout(() => { open = false; }, 200);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  }

  onMount(() => { mounted = true; });

  onDestroy(() => {
    // Clean up the closePanel timeout to prevent state updates after unmount
    if (closePanelTimer) clearTimeout(closePanelTimer);
  });

  // Sync visibility with open state (with animation delay)
  $effect(() => {
    if (open && mounted) {
      const tm = setTimeout(() => { visible = true; }, 30);
      return () => clearTimeout(tm);
    } else {
      visible = false;
    }
  });

  // Reactive current locale label
  let currentLabel = $derived(
    locales.find(l => l.code === $locale)?.shortLabel ?? 'EN'
  );
</script>

<svelte:window onkeydown={handleKeydown} />

<button
  type="button"
  class="btn btn-ghost pager-tab"
  aria-label={t('lang.aria')}
  aria-expanded={open}
  onclick={handleToggle}
>
  <Globe size={14} aria-hidden="true" />
  {currentLabel}
</button>

{#if open}
  <div
    use:portal
    class="lang-backdrop"
    class:visible={visible}
    role="presentation"
  >
    <div
      class="lang-panel"
      role="dialog"
      aria-label={t('lang.select')}
      tabindex="-1"
    >
      <button
        type="button"
        class="lang-close"
        onclick={closePanel}
        aria-label={t('lang.close')}
      >
        <X size={16} />
      </button>

      <div class="lang-panel-icon">
        <Globe size={32} aria-hidden="true" />
      </div>

      <h3 class="lang-panel-title">{t('lang.title')}</h3>

      <div class="lang-options">
        {#each locales as loc (loc.code)}
          <button
            type="button"
            class="lang-option"
            class:active={$locale === loc.code}
            role="menuitem"
            onclick={() => handleSelect(loc.code)}
          >
            <span class="lang-flag">{loc.flag}</span>
            <span class="lang-name">{loc.label}</span>
            <span class="lang-code">{loc.shortLabel}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  /* All portaled panel styles moved to src/styles/lang-switcher.css (global)
     to guarantee they apply to elements portaled to document.body. */
</style>