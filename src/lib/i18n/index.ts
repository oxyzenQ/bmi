/**
 * Lightweight i18n system for BMI Calculator — Svelte 5 compatible
 *
 * Uses writable stores for reactivity (works in plain .ts files).
 * Svelte 5 components can use $store syntax or $derived to react.
 *
 * Usage:
 *   import { t, initLocale, setLocale } from '$lib/i18n';
 *   // In Svelte templates: { t('form.age_label') }
 *   // With interpolation:  { t('results.bmi_of', { n: 25.3, category: 'Normal' }) }
 *   // Change locale: setLocale('ja')
 */

import { browser } from '$app/environment';
import { STORAGE_KEYS, storageGet, storageSet } from '$lib/utils/storage';
import { get, writable } from 'svelte/store';
import type { Locale, LocaleInfo, TParams, TranslationDict } from './types';
export type { Locale, LocaleInfo, TParams, TranslationDict } from './types';
import { warnDev } from '$lib/utils/warn-dev';

// Pre-import English synchronously — always available as fallback
import enDict from './locales/en';

// ── Locale metadata ──
export const locales: LocaleInfo[] = [
  { code: 'en', label: 'English',   flag: '\u{1F1FA}\u{1F1F8}', shortLabel: 'EN' },
  { code: 'id', label: 'Bahasa',    flag: '\u{1F1EE}\u{1F1E9}', shortLabel: 'ID' },
  { code: 'zh', label: '\u4e2d\u6587',   flag: '\u{1F1E8}\u{1F1F3}', shortLabel: 'ZH' },
  { code: 'ja', label: '\u65e5\u672c\u8a9e', flag: '\u{1F1EF}\u{1F1F5}', shortLabel: 'JA' }
];

// ── Module-level dictionaries — en pre-loaded ──
const dicts: Record<string, TranslationDict> = {
  en: enDict
};

/** Current locale — reactive via Svelte writable store */
const localeStore = writable<Locale>('en');

/** Version counter — increment after locale load so components re-render */
const localeVersionStore = writable(0);

/** Exported reactive locale getter */
export function getLocale(): Locale { return get(localeStore); }

/** Get current locale version (for $derived reactivity in components) */
export function getLocaleVersion(): number { return get(localeVersionStore); }

/** Synchronize from stored preference (call in onMount) */
export function initLocale(): void {
  if (!browser) return;
  let detected: Locale;
  const stored = storageGet(STORAGE_KEYS.LOCALE);
  if (stored && locales.some(l => l.code === stored)) {
    detected = stored as Locale;
  } else {
    // Auto-detect from browser
    const nav = navigator.language || '';
    if (nav.startsWith('id')) detected = 'id';
    else if (nav.startsWith('zh')) detected = 'zh';
    else if (nav.startsWith('ja')) detected = 'ja';
    else detected = 'en';
    storageSet(STORAGE_KEYS.LOCALE, detected);
  }
  localeStore.set(detected);
  if (detected !== 'en') void loadLocale(detected);
  document.documentElement.lang = detected === 'zh' ? 'zh-CN' : detected;
}

/** Change locale and persist */
export async function setLocale(code: Locale): Promise<void> {
  localeStore.set(code);
  // Always bump version so components re-render immediately,
  // even when the dictionary is already cached in memory.
  localeVersionStore.update(n => n + 1);
  if (browser) storageSet(STORAGE_KEYS.LOCALE, code);
  await loadLocale(code);
  if (browser) {
    document.documentElement.lang = code === 'zh' ? 'zh-CN' : code;
  }
}

/** Lazy-load locale dictionary */
async function loadLocale(code: Locale): Promise<void> {
  if (dicts[code]) return; // already loaded

  // 'en' is statically imported - no dynamic import needed
  if (code === 'en') {
    dicts['en'] = enDict;
    localeVersionStore.update(n => n + 1);
    return;
  }

  // Other locales loaded dynamically (excluding 'en' from pattern to avoid vite warning)
  await loadNonEnglishLocale(code);
}

/** Dynamic import for non-English locales (explicit imports to avoid vite warning) */
async function loadNonEnglishLocale(code: Locale): Promise<void> {
  let mod: { default: TranslationDict } | undefined;
  try {
    // Explicit switch ensures vite doesn't pattern-match en.ts
    switch (code) {
      case 'id': mod = await import('./locales/id'); break;
      case 'zh': mod = await import('./locales/zh'); break;
      case 'ja': mod = await import('./locales/ja'); break;
      default: throw new Error(`Unknown locale: ${code}`);
    }
    dicts[code] = mod.default;
  } catch (err) {
    warnDev('i18n', 'loadNonEnglishLocale', `Failed to load locale: ${code}, falling back to English`, err);
    // Fallback to English silently
    dicts[code] = enDict;
  }
  // Bump version to trigger Svelte reactivity in components that depend on it
  localeVersionStore.update(n => n + 1);
}

/**
 * Translate a key with optional interpolation
 *
 * @param key     - Dot-notation key (e.g., 'form.age_label')
 * @param params  - Interpolation params: { n: 25.3 } → "Your BMI is {n}" → "Your BMI is 25.3"
 * @returns Translated string, or the key itself if not found
 */
export function t(key: string, params?: TParams): string {
  const currentLocale = get(localeStore);
  const dict = dicts[currentLocale] ?? dicts['en'];
  let value = dict?.[key] ?? dicts['en']?.[key] ?? key;

  // Interpolate {param} placeholders
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
  }

  return value;
}

// ── Svelte 5 reactivity exports ──
// Components use: let _rv = $derived($localeVersion);
export { localeStore as locale, localeVersionStore as localeVersion };
