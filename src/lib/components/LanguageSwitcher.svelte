<script lang="ts">
  import { onMount } from 'svelte';
  import { Globe, X } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import { locales, getLocale, setLocale, localeVersion } from '$lib/i18n';
  import type { Locale } from '$lib/i18n';

  // Reactive dependency on locale version so component re-renders on locale change
  let _rv = $derived($localeVersion);

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

  function closePanel() {
    visible = false;
    setTimeout(() => { open = false; }, 200);
  }

  function handleBackdropClick() {
    closePanel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  }

  onMount(() => { mounted = true; });

  // Sync visibility with open state (with animation delay)
  $effect(() => {
    if (open && mounted) {
      // Small delay for backdrop fade + panel scale animation
      const t = setTimeout(() => { visible = true; }, 30);
      return () => clearTimeout(t);
    } else {
      visible = false;
    }
  });

  // Get the current locale label for the button
  let currentLabel = $derived(
    locales.find(l => l.code === getLocale())?.shortLabel ?? 'EN'
  );
</script>

<svelte:window onkeydown={handleKeydown} />

<button
  type="button"
  class="btn btn-ghost pager-tab lang-btn"
  aria-label="Switch language"
  aria-expanded={open}
  onclick={handleToggle}
>
  <Globe size={14} aria-hidden="true" />
  {currentLabel}
</button>

{#if open}
  <div
    class="lang-backdrop"
    class:visible={visible}
    role="presentation"
    onclick={handleBackdropClick}
  >
    <div
      class="lang-panel"
      role="dialog"
      aria-label="Select language"
      tabindex="-1"
    >
      <button
        type="button"
        class="lang-close"
        onclick={closePanel}
        aria-label="Close language picker"
      >
        <X size={16} />
      </button>

      <div class="lang-panel-icon">
        <Globe size={32} aria-hidden="true" />
      </div>

      <h3 class="lang-panel-title">Language</h3>

      <div class="lang-options">
        {#each locales as loc (loc.code)}
          <button
            type="button"
            class="lang-option"
            class:active={getLocale() === loc.code}
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
  .lang-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
  }

  /* ── Backdrop ── */
  .lang-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--k-65);
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    opacity: 0;
    transition: opacity 0.25s ease;
    pointer-events: none;
  }

  .lang-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  /* ── Panel (NotifyFloat-style glassmorphism) ── */
  .lang-panel {
    position: relative;
    background: var(--k-50);
    border: var(--border-by-rezky);
    border-radius: 24px;
    padding: 2rem 1.75rem;
    min-width: 280px;
    max-width: 90vw;
    text-align: center;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow: 0 25px 50px -12px var(--k-50);
    transform: scale(0.9) translateY(20px);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    outline: none;
  }

  .lang-backdrop.visible .lang-panel {
    transform: scale(1) translateY(0);
  }

  /* ── Close button ── */
  .lang-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: var(--w-10);
    border: 1px solid var(--w-20);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--w-80);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .lang-close:hover {
    background: var(--w-15);
    color: white;
    transform: rotate(90deg) scale(1.1);
    border-color: var(--w-25);
  }

  /* ── Panel icon ── */
  .lang-panel-icon {
    color: var(--cosmic-purple);
    margin-bottom: 0.75rem;
    animation: langIconPop 0.4s ease;
  }

  @keyframes langIconPop {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }

  /* ── Panel title ── */
  .lang-panel-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--w-95);
    margin: 0 0 1.25rem;
    letter-spacing: -0.01em;
  }

  /* ── Options list ── */
  .lang-options {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .lang-option {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    color: var(--w-60);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .lang-option:hover {
    background: var(--w-6);
    color: var(--w-95);
    border-color: var(--w-10);
  }

  .lang-option.active {
    background: linear-gradient(135deg, color-mix(in oklab, var(--cosmic-purple) 20%, transparent), color-mix(in oklab, var(--cosmic-purple) 10%, transparent));
    color: white;
    border-color: var(--cosmic-purple);
    box-shadow: 0 0 12px color-mix(in oklab, var(--cosmic-purple) 25%, transparent);
  }

  .lang-flag {
    font-size: 1.25rem;
    line-height: 1;
  }

  .lang-name {
    flex: 1;
    font-weight: 500;
  }

  .lang-code {
    font-size: 0.7rem;
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: var(--w-6);
    opacity: 0.6;
  }

  .lang-option.active .lang-code {
    background: rgba(255, 255, 255, 0.15);
    opacity: 0.9;
  }

  @media (max-width: 480px) {
    .lang-panel {
      min-width: 260px;
      padding: 1.5rem 1.25rem;
      border-radius: 20px;
    }
  }
</style>
