<script lang="ts">
  import { tick } from 'svelte';
  import { Globe } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import { locales, getLocale, setLocale } from '$lib/i18n';
  import type { Locale } from '$lib/i18n';

  let open = $state(false);
  let dropdownEl: HTMLDivElement | null = $state(null);
  let btnEl: HTMLButtonElement | null = $state(null);
  let dropdownStyle = $state('');

  async function handleToggle() {
    open = !open;
    if (open) {
      await tick();
      positionDropdown();
      dropdownEl?.focus();
    }
  }

  async function handleSelect(code: Locale) {
    await setLocale(code);
    open = false;
  }

  function positionDropdown() {
    if (!browser || !btnEl || !dropdownEl) return;
    const rect = btnEl.getBoundingClientRect();
    const ddWidth = 170;
    let top = rect.bottom + 8;
    let left = rect.right - ddWidth;

    // Keep within viewport
    if (left < 8) left = 8;
    if (left + ddWidth > window.innerWidth - 8) {
      left = window.innerWidth - ddWidth - 8;
    }
    // If dropdown would go below viewport, show above the button
    if (top + 200 > window.innerHeight) {
      top = rect.top - 200 - 8;
      if (top < 8) top = 8;
    }
    dropdownStyle = `top:${top}px;left:${left}px;`;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (!open) return;
    if (!dropdownEl?.contains(e.target as Node) && !btnEl?.contains(e.target as Node)) {
      open = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
      btnEl?.focus();
    }
  }
</script>

<button
  type="button"
  bind:this={btnEl}
  class="btn btn-ghost pager-tab lang-btn"
  aria-label="Switch language"
  aria-expanded={open}
  onclick={handleToggle}
>
  <Globe size={14} aria-hidden="true" />
  {locales.find(l => l.code === getLocale())?.shortLabel ?? 'EN'}
</button>

{#if open}
  <div
    bind:this={dropdownEl}
    class="lang-dropdown"
    role="menu"
    tabindex="-1"
    style={dropdownStyle}
    onkeydown={handleKeydown}
  >
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
<svelte:window onclick={handleBackdropClick} />

<style>
  .lang-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
  }

  .lang-dropdown {
    position: fixed;
    z-index: 10000;
    min-width: 160px;
    background: var(--sd-80);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--w-10);
    border-radius: 0.75rem;
    padding: 0.35rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    animation: langFadeIn 0.15s ease-out;
    outline: none;
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
