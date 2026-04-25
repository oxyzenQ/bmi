/**
 * Lightweight i18n system for BMI Calculator — Svelte 5 reactive
 *
 * Usage:
 *   import { locale, t, locales, initLocale, setLocale } from '$lib/i18n';
 *   // In Svelte templates: { t('form.age_label') }
 *   // With interpolation:  { t('results.bmi_of', { n: 25.3, category: 'Normal' }) }
 *   // Change locale: setLocale('ja')
 */

import { browser } from '$app/environment';
import { STORAGE_KEYS, storageGet, storageSet } from '$lib/utils/storage';
import type { Locale, LocaleInfo, TranslationDict, TParams } from './types';
export type { Locale, LocaleInfo, TranslationDict, TParams } from './types';

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

/** Current locale — reactive via Svelte 5 $state */
let _locale: Locale = $state('en');

/** Trigger a Svelte reactivity tick after locale dict loads */
let _version = $state(0);

/** Exported reactive locale getter */
export function getLocale(): Locale { return _locale; }

/** Version counter — increment after locale load so components re-render */
export function getLocaleVersion(): number { return _version; }

/** Synchronize from stored preference (call in onMount) */
export function initLocale(): void {
  if (!browser) return;
  const stored = storageGet(STORAGE_KEYS.LOCALE);
  if (stored && locales.some(l => l.code === stored)) {
    _locale = stored as Locale;
  } else {
    // Auto-detect from browser
    const nav = navigator.language || '';
    if (nav.startsWith('id')) _locale = 'id';
    else if (nav.startsWith('zh')) _locale = 'zh';
    else if (nav.startsWith('ja')) _locale = 'ja';
    else _locale = 'en';
    storageSet(STORAGE_KEYS.LOCALE, _locale);
  }
  if (_locale !== 'en') void loadLocale(_locale);
  if (browser) {
    document.documentElement.lang = _locale === 'zh' ? 'zh-CN' : _locale;
  }
}

/** Change locale and persist */
export async function setLocale(code: Locale): Promise<void> {
  _locale = code;
  if (browser) storageSet(STORAGE_KEYS.LOCALE, code);
  await loadLocale(code);
  if (browser) {
    document.documentElement.lang = code === 'zh' ? 'zh-CN' : code === 'id' ? 'id' : code === 'ja' ? 'ja' : 'en';
  }
}

/** Lazy-load locale dictionary */
async function loadLocale(code: Locale): Promise<void> {
  if (dicts[code]) return; // already loaded

  try {
    const mod = await import(`./locales/${code}.ts`);
    dicts[code] = mod.default as TranslationDict;
  } catch {
    console.warn(`[i18n] Failed to load locale "${code}", falling back to en`);
    if (code !== 'en') {
      dicts[code] = enDict;
    }
  }
  // Bump version to trigger Svelte reactivity in components that depend on it
  _version++;
}

/**
 * Translate a key with optional interpolation
 *
 * @param key     - Dot-notation key (e.g., 'form.age_label')
 * @param params  - Interpolation params: { n: 25.3 } → "Your BMI is {n}" → "Your BMI is 25.3"
 * @returns Translated string, or the key itself if not found
 */
export function t(key: string, params?: TParams): string {
  const dict = dicts[_locale] ?? dicts['en'];
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

// ── Svelte 5 rune exports ──
export { _locale as locale, _version as localeVersion };
