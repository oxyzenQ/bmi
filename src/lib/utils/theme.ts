/**
 * Theme management utility.
 * Supports 'dark', 'light', and 'system' (follows OS preference).
 * Persisted in localStorage under 'bmi.theme'.
 */
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'bmi.theme';

function getSystemPreference(): 'dark' | 'light' {
  if (!browser) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function getStoredTheme(): Theme {
  if (!browser) return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

export function setStoredTheme(theme: Theme): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
}

export function getEffectiveTheme(stored: Theme): 'dark' | 'light' {
  if (stored === 'system') return getSystemPreference();
  return stored;
}

export function applyTheme(theme: 'dark' | 'light'): void {
  if (!browser) return;
  const html = document.documentElement;
  if (theme === 'light') {
    html.classList.add('theme-light');
    html.classList.remove('theme-dark');
    html.dataset.theme = 'light';
  } else {
    html.classList.add('theme-dark');
    html.classList.remove('theme-light');
    html.dataset.theme = 'dark';
  }
}
