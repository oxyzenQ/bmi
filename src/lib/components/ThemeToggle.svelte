<script lang="ts">
  import { Sun, Moon, Monitor } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import { getStoredTheme, setStoredTheme, getEffectiveTheme, applyTheme, type Theme } from '$lib/utils/theme';

  let currentTheme = $state<Theme>(browser ? getStoredTheme() : 'dark');
  let effectiveTheme = $state<'dark' | 'light'>(browser ? getEffectiveTheme(currentTheme) : 'dark');

  function cycleTheme() {
    const next: Theme = currentTheme === 'dark' ? 'light' : currentTheme === 'light' ? 'system' : 'dark';
    currentTheme = next;
    setStoredTheme(next);
    effectiveTheme = getEffectiveTheme(next);
    applyTheme(effectiveTheme);
  }

  import { onMount } from 'svelte';
  onMount(() => {
    const stored = getStoredTheme();
    currentTheme = stored;
    effectiveTheme = getEffectiveTheme(stored);
    applyTheme(effectiveTheme);

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      if (currentTheme === 'system') {
        effectiveTheme = getEffectiveTheme('system');
        applyTheme(effectiveTheme);
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  });

  let currentIcon = $derived(
    currentTheme === 'system' ? Monitor : currentTheme === 'light' ? Sun : Moon
  );

  let themeLabel = $derived(
    currentTheme === 'system' ? 'System' : currentTheme === 'light' ? 'Light' : 'Dark'
  );
</script>

<button
  type="button"
  class="theme-toggle"
  onclick={cycleTheme}
  aria-label="Toggle theme. Current: {themeLabel}"
  title="Theme: {themeLabel}"
>
  <currentIcon size={16} />
  <span class="theme-label">{themeLabel}</span>
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.7rem;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    white-space: nowrap;
  }

  .theme-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(255, 255, 255, 0.18);
    transform: translateY(-1px);
  }

  .theme-toggle:active {
    transform: scale(0.97);
  }

  .theme-label {
    line-height: 1;
  }
</style>
