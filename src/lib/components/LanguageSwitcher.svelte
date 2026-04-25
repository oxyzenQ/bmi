<script lang="ts">
  import { Globe } from 'lucide-svelte';
  import { locales, getLocale, setLocale } from '$lib/i18n';
  import type { Locale } from '$lib/i18n';

  let open = $state(false);

  function handleToggle() {
    open = !open;
  }

  async function handleSelect(code: Locale) {
    await setLocale(code);
    open = false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.lang-switcher')) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="lang-switcher">
  <button
    type="button"
    class="btn btn-ghost pager-tab lang-btn"
    aria-label="Switch language"
    onclick={handleToggle}
  >
    <Globe size={14} aria-hidden="true" />
    {locales.find(l => l.code === getLocale())?.shortLabel ?? 'EN'}
  </button>

  {#if open}
    <div class="lang-dropdown" role="menu">
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
  {/if}
</div>

<style>
  .lang-switcher {
    position: relative;
    display: inline-flex;
  }

  .lang-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
  }

  .lang-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 100;
    min-width: 160px;
    background: var(--sd-80);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--w-10);
    border-radius: 0.75rem;
    padding: 0.35rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    animation: langFadeIn 0.15s ease-out;
  }

  @keyframes langFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .lang-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--w-60);
    font-size: 0.82rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    text-align: left;
  }

  .lang-option:hover {
    background: var(--w-6);
    color: var(--w-90);
  }

  .lang-option.active {
    background: var(--cosmic-purple);
    color: white;
  }

  .lang-flag {
    font-size: 1.05rem;
    line-height: 1;
  }

  .lang-name {
    flex: 1;
    font-weight: 500;
  }

  .lang-code {
    font-size: 0.7rem;
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    opacity: 0.5;
  }

  .lang-option.active .lang-code {
    opacity: 0.8;
  }
</style>
