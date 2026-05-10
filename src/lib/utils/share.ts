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

/**
 * Build a formatted plain-text summary of BMI results.
 */
export function formatBmiText(data: BmiShareData): string {
  const unit = data.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const wUnit = unit === 'imperial' ? 'lbs' : 'kg';
  const hUnit = unit === 'imperial' ? 'in' : 'cm';

  let text = `${t('share.title')}\n`;
  text += `BMI: ${data.bmi.toFixed(2)} (${data.category})\n`;

  if (data.bmiPrime !== null && data.bmiPrime !== undefined) {
    text += `BMI Prime: ${data.bmiPrime.toFixed(2)}\n`;
  }

  if (data.weight !== null && data.weight !== undefined) {
    text += `Weight: ${data.weight} ${wUnit}\n`;
  }
  if (data.height !== null && data.height !== undefined) {
    text += `Height: ${data.height} ${hUnit}\n`;
  }

  if (data.tdee !== null && data.tdee !== undefined) {
    text += `TDEE: ${Math.round(data.tdee)} kcal/day\n`;
  }

  text += `\n${t('share.footer')}`;
  text += `\nhttps://bmi-logigo.vercel.app`;
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
    url: 'https://bmi-logigo.vercel.app'
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
