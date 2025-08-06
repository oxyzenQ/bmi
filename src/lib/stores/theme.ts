import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Get initial theme from localStorage or default to 'dark'
const getInitialTheme = (): 'dark' | 'light' => {
  if (browser) {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  return 'dark';
};

// Create the theme store
export const theme = writable<'dark' | 'light'>(getInitialTheme());

// Subscribe to theme changes and update localStorage and document
if (browser) {
  theme.subscribe((value) => {
    localStorage.setItem('theme', value);
    document.documentElement.setAttribute('data-theme', value);
    
    // Update body background based on theme
    if (value === 'light') {
      document.body.style.background = 'radial-gradient(circle at 40% 80%, #f0f4ff 10%, #e6f3ff 40%, #ffffff 100%)';
      document.body.style.color = '#1a1a1a';
    } else {
      document.body.style.background = 'radial-gradient(circle at 40% 80%, #070a1c 10%, #1b1f3a 40%, #040717 100%)';
      document.body.style.color = '#e0e0e0';
    }
  });
}

// Toggle function
export function toggleTheme() {
  theme.update(current => current === 'dark' ? 'light' : 'dark');
}
