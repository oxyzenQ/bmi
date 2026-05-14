/**
 * C-3: Canvas-based BMI result card image generator.
 * Produces a shareable PNG for Instagram Story / X / etc.
 */

import { t, getLocale } from '$lib/i18n';
import { CATEGORY_COLORS, COLORS, isBmiCategory } from './bmi-category';

export interface BmiCardData {
  bmi: number;
  category: string;
  bmiPrime?: number | null;
  tdee?: number | null;
  idealMin?: number | null;
  idealMax?: number | null;
  weightUnit?: string;
}

const CARD_W = 1080;
const CARD_H = 1920;
const RADIUS = 64;

function getCategoryColor(cat: string): string {
  return isBmiCategory(cat) ? CATEGORY_COLORS[cat] : COLORS.SLATE;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function generateBmiCard(data: BmiCardData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const accent = getCategoryColor(data.category);

  // Background — deep cosmic gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bgGrad.addColorStop(0, '#0a0818');
  bgGrad.addColorStop(0.5, '#1a0533');
  bgGrad.addColorStop(1, '#0a0818');
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 0);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Subtle radial glow behind center
  const glow = ctx.createRadialGradient(CARD_W / 2, CARD_H * 0.38, 0, CARD_W / 2, CARD_H * 0.38, 500);
  glow.addColorStop(0, accent + '22');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Card container
  const cardX = 60;
  const cardY = 200;
  const cardW = CARD_W - 120;
  const cardH = CARD_H - 400;

  // Card background
  const cardBg = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardBg.addColorStop(0, 'rgba(255,255,255,0.06)');
  cardBg.addColorStop(1, 'rgba(255,255,255,0.02)');
  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.fillStyle = cardBg;
  ctx.fill();

  // Card border
  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top accent line
  const accentGrad = ctx.createLinearGradient(cardX + RADIUS, 0, cardX + cardW - RADIUS, 0);
  accentGrad.addColorStop(0, 'transparent');
  accentGrad.addColorStop(0.3, accent);
  accentGrad.addColorStop(0.7, accent);
  accentGrad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.moveTo(cardX + RADIUS, cardY);
  ctx.lineTo(cardX + cardW - RADIUS, cardY);
  ctx.strokeStyle = accentGrad;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Header text
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText(t('share.card_header'), CARD_W / 2, cardY + 100);

  // BMI Value — big
  ctx.fillStyle = accent;
  ctx.font = '800 160px system-ui, sans-serif';
  ctx.fillText(data.bmi.toFixed(1), CARD_W / 2, cardY + 360);

  // Category
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 52px system-ui, sans-serif';
  ctx.fillText(data.category.toUpperCase(), CARD_W / 2, cardY + 440);

  // Divider
  const divY = cardY + 500;
  const divGrad = ctx.createLinearGradient(cardX + 120, 0, cardX + cardW - 120, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  divGrad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.moveTo(cardX + 120, divY);
  ctx.lineTo(cardX + cardW - 120, divY);
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Stats grid
  const statsY = divY + 80;
  const colW = cardW / 3;

  // BMI Prime
  if (data.bmiPrime !== null && data.bmiPrime !== undefined) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillText(t('share.card_prime'), cardX + colW * 0.5, statsY);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText(data.bmiPrime.toFixed(2), cardX + colW * 0.5, statsY + 50);
  }

  // Ideal Range
  if (data.idealMin !== null && data.idealMax !== null && data.weightUnit) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillText(t('share.card_ideal'), cardX + colW * 1.5, statsY);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 36px system-ui, sans-serif';
    ctx.fillText(`${data.idealMin}–${data.idealMax} ${data.weightUnit}`, cardX + colW * 1.5, statsY + 50);
  }

  // TDEE
  if (data.tdee !== null && data.tdee !== undefined) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillText(t('share.card_tdee'), cardX + colW * 2.5, statsY);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText(`${Math.round(data.tdee)} ${t('share.card_kcal')}`, cardX + colW * 2.5, statsY + 50);
  }

  // BMI Scale bar
  const barY = statsY + 140;
  const barX = cardX + 120;
  const barW = cardW - 240;
  const barH = 16;

  // Bar track
  roundRect(ctx, barX, barY, barW, barH, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();

  // Bar segments
  const segments = [
    { pct: (18.5 - 12) / (42 - 12), color: '#4A90E2' },
    { pct: (25 - 18.5) / (42 - 12), color: '#00C853' },
    { pct: (30 - 25) / (42 - 12), color: '#FFD600' },
    { pct: (42 - 30) / (42 - 12), color: '#D50000' }
  ];
  let segX = barX;
  for (const seg of segments) {
    const segW = (seg.pct / (segments.reduce((s, x) => s + x.pct, 0))) * barW;
    roundRect(ctx, segX, barY, segW, barH, 0);
    ctx.fillStyle = seg.color + '88';
    ctx.fill();
    segX += segW;
  }

  // BMI marker on scale
  const markerPct = Math.max(0, Math.min(1, (data.bmi - 12) / (42 - 12)));
  const markerX = barX + markerPct * barW;
  ctx.beginPath();
  ctx.arc(markerX, barY + barH / 2, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(markerX, barY + barH / 2, 10, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  // Scale labels
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '400 20px system-ui, sans-serif';
  ctx.fillText('12', barX, barY + barH + 36);

  ctx.textAlign = 'center';
  ctx.fillText('18.5', barX + ((18.5 - 12) / (42 - 12)) * barW, barY + barH + 36);
  ctx.fillText('25', barX + ((25 - 12) / (42 - 12)) * barW, barY + barH + 36);
  ctx.fillText('30', barX + ((30 - 12) / (42 - 12)) * barW, barY + barH + 36);

  ctx.textAlign = 'right';
  ctx.fillText('42', barX + barW, barY + barH + 36);

  // Footer branding
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillText(t('share.card_branding'), CARD_W / 2, CARD_H - 160);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '400 20px system-ui, sans-serif';
  ctx.fillText('bmi-logigo.vercel.app', CARD_W / 2, CARD_H - 120);

  // Timestamp
  const now = new Date();
  const timestamp = now.toLocaleString(getLocale() === 'zh' ? 'zh-CN' : getLocale(), { dateStyle: 'medium', timeStyle: 'short' });
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText(timestamp, CARD_W / 2, CARD_H - 80);

  // Convert canvas to blob
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92);
  });
}

/**
 * Trigger a file download for the generated card image.
 */
export async function downloadBmiCard(data: BmiCardData): Promise<boolean> {
  const blob = await generateBmiCard(data);
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bmi-result-${data.bmi.toFixed(1)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Share the card image via Web Share API (if available) or download fallback.
 */
export async function shareBmiCard(data: BmiCardData): Promise<{ ok: boolean; method: 'share' | 'download' | 'none' }> {
  const blob = await generateBmiCard(data);
  if (!blob) return { ok: false, method: 'none' };

  const file = new File([blob], `bmi-result-${data.bmi.toFixed(1)}.png`, { type: 'image/png' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: 'BMI Calculator Result',
        text: t('share.card_text', { n: data.bmi.toFixed(1), category: data.category }),
        files: [file]
      });
      return { ok: true, method: 'share' };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, method: 'none' };
      }
      // Fall through to download
    }
  }

  // Download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bmi-result-${data.bmi.toFixed(1)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true, method: 'download' };
}