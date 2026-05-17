// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Share & Clipboard utilities for BMI results.
 *
 * C-1: Web Share API with clipboard fallback
 * C-2: Copy formatted BMI text to clipboard
 */

import { t, getLocale } from '$lib/i18n';
import { warnDev } from './warn-dev';

export interface BmiShareData {
  bmi: number;
  category: string;
  height?: number | null;
  weight?: number | null;
  unitSystem?: 'metric' | 'imperial';
  bmiPrime?: number | null;
  tdee?: number | null;
}

function getCategoryLabel(cat: string): string {
  switch (cat.toLowerCase()) {
    case 'underweight': return t('category.underweight');
    case 'normal weight': return t('category.normal');
    case 'overweight': return t('category.overweight');
    case 'obese': return t('category.obese');
    default: return cat;
  }
}

/**
 * Build a formatted plain-text summary of BMI results.
 */
export function formatBmiText(data: BmiShareData): string {
  const unit = data.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const wUnit = unit === 'imperial' ? 'lbs' : 'kg';
  const hUnit = unit === 'imperial' ? 'in' : 'cm';
  const categoryLabel = getCategoryLabel(data.category);

  let text = `${t('share.title')}\n`;
  text += `${t('share.bmi_line', { n: data.bmi.toFixed(2), category: categoryLabel })}\n`;

  if (data.bmiPrime !== null && data.bmiPrime !== undefined) {
    text += `${t('share.prime_line', { n: data.bmiPrime.toFixed(2) })}\n`;
  }

  if (data.weight !== null && data.weight !== undefined) {
    text += `${t('share.weight_line', { n: data.weight, unit: wUnit })}\n`;
  }
  if (data.height !== null && data.height !== undefined) {
    text += `${t('share.height_line', { n: data.height, unit: hUnit })}\n`;
  }

  if (data.tdee !== null && data.tdee !== undefined) {
    text += `${t('share.tdee_line', { n: Math.round(data.tdee) })}\n`;
  }

  text += `\n${t('share.footer')}`;
  text += `\nhttps://bmi-stellar.vercel.app`;
  text += `\n${new Date().toLocaleString(getLocale() === 'zh' ? 'zh-CN' : getLocale(), { dateStyle: 'medium', timeStyle: 'short' })}`;

  return text;
}

/**
 * C-1: Share BMI result using the Web Share API.
 * Falls back to copying text to clipboard on desktop browsers.
 * Returns true if shared/copied successfully.
 */
export async function shareBmiResult(data: BmiShareData): Promise<{ ok: boolean; method: 'share' | 'clipboard' | 'none' }> {
  const text = formatBmiText(data);
  const shareData: ShareData = {
    title: t('share.title'),
    text,
    url: 'https://bmi-stellar.vercel.app'
  };

  // Try Web Share API first (mobile)
  if (canWebShare()) {
    try {
      await navigator.share(shareData);
      return { ok: true, method: 'share' };
    } catch (err: unknown) {
      // User cancelled share sheet — not an error
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, method: 'none' };
      }
      // Share failed — fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  const copied = await copyToClipboard(text);
  return { ok: copied, method: copied ? 'clipboard' : 'none' };
}

/**
 * C-2: Copy BMI result text to clipboard.
 * Returns true if copied successfully.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers / non-HTTPS
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    warnDev('share', 'copyToClipboard', 'Clipboard write failed', err);
    return false;
  }
}

function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}
