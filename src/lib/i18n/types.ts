// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * i18n type definitions for BMI Stellar
 * Supports 4 locales: en (English), id (Indonesian), zh (Chinese), ja (Japanese)
 */

export type Locale = 'en' | 'id' | 'zh' | 'ja';

export interface LocaleInfo {
  code: Locale;
  label: string;        // Native name displayed in switcher (e.g., "English", "Bahasa")
  flag: string;         // Emoji flag
  shortLabel: string;   // Short code for compact display (e.g., "EN", "ID")
}

/** Flat dictionary: dot-notation keys → string values */
export type TranslationDict = Record<string, string>;

/** Interpolation params for $t() */
export type TParams = Record<string, string | number | undefined | null>;