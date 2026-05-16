/**
 * Canvas-based premium black BMI result card generator.
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
  height?: number | null;
  weight?: number | null;
  heightUnit?: string;
}

const CARD_W = 1080;
const CARD_H = 1080;
const RADIUS = 56;

const PREMIUM = {
  bg: '#000000',
  panelBottom: 'rgba(255,255,255,0.045)',
  border: 'rgba(255,255,255,0.105)',
  borderMuted: 'rgba(255,255,255,0.065)',
  text: '#F7F8FA',
  textSoft: 'rgba(255,255,255,0.72)',
  textMuted: 'rgba(255,255,255,0.45)',
  emerald: '#18D26E',
  brandViolet: '#4e3383',
  brandBlue: '#5b4ce0',
  brandPurple: '#8000ff',
  brandHighlight: '#e2c7ff'
} as const;

/** Helper: convert hex (#RRGGBB) to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Helper: lighten a hex color by mixing toward white */
function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function getCategoryColor(cat: string): string {
  return isBmiCategory(cat) ? CATEGORY_COLORS[cat] : COLORS.SLATE;
}

/** Map canonical English category to localized display text */
function getCategoryLabel(cat: string): string {
  switch (cat.toLowerCase()) {
    case 'underweight': return t('category.underweight');
    case 'normal weight': return t('category.normal');
    case 'overweight': return t('category.overweight');
    case 'obese': return t('category.obese');
    default: return cat;
  }
}

/** Map English category to insight i18n key */
function getCategoryInsightKey(cat: string): string {
  switch (cat.toLowerCase()) {
    case 'underweight': return 'share.card_insight_underweight';
    case 'normal weight': return 'share.card_insight_normal';
    case 'overweight': return 'share.card_insight_overweight';
    case 'obese': return 'share.card_insight_obese';
    default: return 'share.card_insight_normal';
  }
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

function drawGradientCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  gradientStops: Array<[number, string]>
): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText(text);
  const grad = ctx.createLinearGradient(x - metrics.width / 2, y, x + metrics.width / 2, y);

  for (const [stop, color] of gradientStops) {
    grad.addColorStop(stop, color);
  }

  ctx.fillStyle = grad;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const useWords = /\s/.test(text);
  const units = useWords ? text.trim().split(/\s+/) : Array.from(text);
  const lines: string[] = [];
  let currentLine = '';

  for (const unit of units) {
    const testLine = currentLine ? (useWords ? `${currentLine} ${unit}` : `${currentLine}${unit}`) : unit;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = unit;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

/** Draw a pill-shaped stat cell with label above and value below */
function drawStatCell(
  ctx: CanvasRenderingContext2D,
  cx: number, // center x
  y: number,  // top of cell
  label: string,
  value: string
) {
  const pillW = 260;
  const pillH = 108;
  const pillX = cx - pillW / 2;
  const pillR = 20;

  const pillGrad = ctx.createLinearGradient(pillX, y, pillX + pillW, y + pillH);
  pillGrad.addColorStop(0, 'rgba(255,255,255,0.052)');
  pillGrad.addColorStop(1, 'rgba(255,255,255,0.022)');
  roundRect(ctx, pillX, y, pillW, pillH, pillR);
  ctx.fillStyle = pillGrad;
  ctx.fill();

  roundRect(ctx, pillX, y, pillW, pillH, pillR);
  ctx.strokeStyle = PREMIUM.borderMuted;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = PREMIUM.textMuted;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.letterSpacing = '0.05em';
  ctx.fillText(label, cx, y + 38);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = PREMIUM.text;
  ctx.font = '800 34px system-ui, sans-serif';
  ctx.fillText(value, cx, y + 82);
}

/**
 * Draw a compact personal data row (height/weight) as small pill badges.
 */
function drawPersonalDataRow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  data: BmiCardData
) {
  const items: { label: string; value: string }[] = [];

  if (data.height !== null && data.height !== undefined && data.heightUnit) {
    items.push({
      label: t('share.card_height'),
      value: `${data.height} ${data.heightUnit}`
    });
  }

  if (data.weight !== null && data.weight !== undefined && data.weightUnit) {
    items.push({
      label: t('share.card_weight'),
      value: `${data.weight} ${data.weightUnit}`
    });
  }

  if (items.length === 0) return y;

  const pillW = 182;
  const pillH = 52;
  const gap = 24;
  const totalW = items.length * pillW + (items.length - 1) * gap;
  const startX = cx - totalW / 2;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const px = startX + i * (pillW + gap);
    const pillR = 14;

    const pillGrad = ctx.createLinearGradient(px, y, px + pillW, y + pillH);
    pillGrad.addColorStop(0, 'rgba(255,255,255,0.055)');
    pillGrad.addColorStop(1, 'rgba(255,255,255,0.025)');
    roundRect(ctx, px, y, pillW, pillH, pillR);
    ctx.fillStyle = pillGrad;
    ctx.fill();

    roundRect(ctx, px, y, pillW, pillH, pillR);
    ctx.strokeStyle = PREMIUM.borderMuted;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = PREMIUM.textMuted;
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillText(item.label, px + pillW / 2 - 30, y + 33);

    ctx.fillStyle = PREMIUM.text;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(item.value, px + pillW / 2 + 30, y + 33);
  }

  return y + pillH + 20;
}

/**
 * Draw a mini radial gauge showing BMI position visually.
 */
function drawMiniGauge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  bmi: number,
  accent: string
) {
  const bmiMin = 12;
  const bmiMax = 42;
  const bmiRange = bmiMax - bmiMin;
  const pct = Math.max(0, Math.min(1, (bmi - bmiMin) / bmiRange));

  // Gauge track arc
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 7;
  ctx.stroke();

  const segDefs = [
    { from: 0, to: 0.217, color: '#4A90E2' },
    { from: 0.217, to: 0.433, color: '#00C853' },
    { from: 0.433, to: 0.600, color: '#FFD600' },
    { from: 0.600, to: 1.0, color: '#D50000' },
  ];

  const startAngle = -Math.PI / 2;

  for (const seg of segDefs) {
    const a1 = startAngle + seg.from * Math.PI * 2;
    const a2 = startAngle + Math.min(seg.to, pct) * Math.PI * 2;
    if (a2 <= a1) continue;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, a1, a2);
    ctx.strokeStyle = hexToRgba(seg.color, 0.36);
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const activeAngle = startAngle + pct * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, activeAngle);
  ctx.strokeStyle = hexToRgba(accent, 0.48);
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();

  const dotX = cx + Math.cos(activeAngle) * radius;
  const dotY = cy + Math.sin(activeAngle) * radius;

  ctx.beginPath();
  ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
  ctx.fillStyle = PREMIUM.bg;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(accent, 0.85);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = hexToRgba(accent, 0.46);
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.fillText('BMI', cx, cy - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(bmi.toFixed(1), cx, cy + 14);
}

export async function generateBmiCard(data: BmiCardData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const accent = getCategoryColor(data.category);
  const centerX = CARD_W / 2;

  ctx.fillStyle = PREMIUM.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const bgDepth = ctx.createRadialGradient(
    CARD_W / 2, CARD_H * 0.42, 0,
    CARD_W / 2, CARD_H * 0.42, 520
  );
  bgDepth.addColorStop(0, 'rgba(255,255,255,0.030)');
  bgDepth.addColorStop(0.55, 'rgba(255,255,255,0.010)');
  bgDepth.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgDepth;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const cardX = 58;
  const cardY = 88;
  const cardW = CARD_W - 116;
  const cardH = 828;
  const headerY = cardY + 86;
  const bmiY = cardY + 262;
  const categoryY = cardY + 352;
  const pillsY = cardY + 400;
  const statsY = cardY + 506;
  const scaleY = cardY + 632;
  const insightY = cardY + 720;
  const footerBrandY = cardY + cardH + 40;
  const footerDomainY = footerBrandY + 34;
  const footerTimeY = footerDomainY + 30;

  const cardBg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardBg.addColorStop(0, 'rgba(255,255,255,0.065)');
  cardBg.addColorStop(0.42, 'rgba(255,255,255,0.026)');
  cardBg.addColorStop(1, PREMIUM.panelBottom);
  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.fillStyle = cardBg;
  ctx.fill();

  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.strokeStyle = PREMIUM.border;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const rim = ctx.createLinearGradient(cardX, cardY, cardX, cardY + 150);
  rim.addColorStop(0, 'rgba(255,255,255,0.090)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.clip();
  ctx.fillStyle = rim;
  ctx.fillRect(cardX, cardY, cardW, 150);
  ctx.restore();

  const topLine = ctx.createLinearGradient(cardX + 80, 0, cardX + cardW - 80, 0);
  topLine.addColorStop(0, 'rgba(128,0,255,0)');
  topLine.addColorStop(0.32, 'rgba(91,76,224,0.32)');
  topLine.addColorStop(0.5, 'rgba(226,199,255,0.46)');
  topLine.addColorStop(0.68, 'rgba(128,0,255,0.34)');
  topLine.addColorStop(1, 'rgba(128,0,255,0)');
  ctx.beginPath();
  ctx.moveTo(cardX + 96, cardY + 1);
  ctx.lineTo(cardX + cardW - 96, cardY + 1);
  ctx.strokeStyle = topLine;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const headerText = t('share.card_header');
  drawGradientCenteredText(
    ctx,
    headerText,
    centerX,
    headerY,
    '800 28px system-ui, sans-serif',
    [
      [0, PREMIUM.brandViolet],
      [0.28, PREMIUM.brandBlue],
      [0.56, PREMIUM.brandPurple],
      [0.78, '#9b5cff'],
      [1, PREMIUM.brandHighlight]
    ]
  );

  const valueAura = ctx.createRadialGradient(
    centerX, bmiY - 30, 0,
    centerX, bmiY - 30, 220
  );
  valueAura.addColorStop(0, hexToRgba(accent, 0.055));
  valueAura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = valueAura;
  ctx.fillRect(cardX, bmiY - 210, cardW, 300);

  const bmiText = data.bmi.toFixed(1);
  ctx.font = '800 148px system-ui, sans-serif';
  ctx.textAlign = 'center';

  const textGrad = ctx.createLinearGradient(
    centerX, bmiY - 130,
    centerX, bmiY + 20
  );
  textGrad.addColorStop(0, lightenHex(accent, 0.18));
  textGrad.addColorStop(0.55, accent);
  textGrad.addColorStop(1, hexToRgba(accent, 0.82));

  ctx.fillStyle = textGrad;
  ctx.fillText(bmiText, centerX, bmiY);

  const gaugeCx = cardX + cardW - 118;
  const gaugeCy = bmiY - 44;
  drawMiniGauge(ctx, gaugeCx, gaugeCy, 48, data.bmi, accent);

  ctx.fillStyle = PREMIUM.text;
  ctx.font = '800 48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const categoryLabel = getCategoryLabel(data.category);
  const categoryText = categoryLabel.toUpperCase();
  const catMetrics = ctx.measureText(categoryText);
  const catTextX = centerX;
  const catTextY = categoryY;
  ctx.fillText(categoryText, catTextX, catTextY);

  const dotX = catTextX - catMetrics.width / 2 - 24;
  const dotY = catTextY - 16;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(accent, 0.90);
  ctx.fill();

  const afterPersonalY = drawPersonalDataRow(ctx, centerX, pillsY, data);

  const divY = Math.min(statsY - 24, Math.max(pillsY + 72, afterPersonalY + 18));
  const divGrad = ctx.createLinearGradient(cardX + 80, 0, cardX + cardW - 80, 0);
  divGrad.addColorStop(0, 'rgba(255,255,255,0)');
  divGrad.addColorStop(0.5, 'rgba(255,255,255,0.10)');
  divGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.moveTo(cardX + 80, divY);
  ctx.lineTo(cardX + cardW - 80, divY);
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.stroke();

  const colW = cardW / 3;

  if (data.bmiPrime !== null && data.bmiPrime !== undefined) {
    drawStatCell(ctx, cardX + colW * 0.5, statsY, t('share.card_prime'), data.bmiPrime.toFixed(2));
  }

  if (data.idealMin !== null && data.idealMax !== null && data.weightUnit) {
    drawStatCell(ctx, cardX + colW * 1.5, statsY, t('share.card_ideal'), `${data.idealMin}\u2013${data.idealMax} ${data.weightUnit}`);
  }

  if (data.tdee !== null && data.tdee !== undefined) {
    drawStatCell(ctx, cardX + colW * 2.5, statsY, t('share.card_tdee'), `${Math.round(data.tdee)} ${t('share.card_kcal')}`);
  }

  const barY = scaleY;
  const barX = cardX + 78;
  const barW = cardW - 156;
  const barH = 24;
  const barR = 12;
  const bmiMin = 12;
  const bmiMax = 42;
  const bmiRange = bmiMax - bmiMin;

  roundRect(ctx, barX, barY, barW, barH, barR);
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  ctx.fill();

  const segments = [
    { start: 12, end: 18.5, color: '#4A90E2', label: 'UW' },
    { start: 18.5, end: 25, color: '#00C853', label: 'NW' },
    { start: 25, end: 30, color: '#FFD600', label: 'OW' },
    { start: 30, end: 42, color: '#D50000', label: 'OB' }
  ];

  // Clip to bar shape for clean segment edges
  ctx.save();
  roundRect(ctx, barX, barY, barW, barH, barR);
  ctx.clip();

  let segX = barX;
  for (const seg of segments) {
    const segW = ((seg.end - seg.start) / bmiRange) * barW;
    const segGrad = ctx.createLinearGradient(segX, barY, segX + segW, barY);
    segGrad.addColorStop(0, hexToRgba(seg.color, 0.45));
    segGrad.addColorStop(0.5, hexToRgba(seg.color, 0.58));
    segGrad.addColorStop(1, hexToRgba(seg.color, 0.45));
    ctx.fillStyle = segGrad;
    ctx.fillRect(segX, barY, segW, barH);
    segX += segW;
  }
  ctx.restore();

  const boundaries = [18.5, 25, 30];
  for (const b of boundaries) {
    const bx = barX + ((b - bmiMin) / bmiRange) * barW;
    ctx.beginPath();
    ctx.moveTo(bx, barY - 6);
    ctx.lineTo(bx, barY + barH + 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const markerPct = Math.max(0, Math.min(1, (data.bmi - bmiMin) / bmiRange));
  const markerX = barX + markerPct * barW;
  const activeGlow = ctx.createRadialGradient(markerX, barY + barH / 2, 0, markerX, barY + barH / 2, 100);
  activeGlow.addColorStop(0, hexToRgba(accent, 0.08));
  activeGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = activeGlow;
  ctx.fillRect(markerX - 100, barY - 10, 200, barH + 20);

  ctx.beginPath();
  ctx.arc(markerX, barY + barH / 2, 17, 0, Math.PI * 2);
  ctx.fillStyle = PREMIUM.bg;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(markerX, barY + barH / 2, 14, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(accent, 0.95);
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.54)';
  ctx.font = '600 18px system-ui, sans-serif';
  const labelY = barY + barH + 30;

  ctx.fillText('12', barX, labelY);
  ctx.fillText('18.5', barX + ((18.5 - bmiMin) / bmiRange) * barW, labelY);
  ctx.fillText('25', barX + ((25 - bmiMin) / bmiRange) * barW, labelY);
  ctx.fillText('30', barX + ((30 - bmiMin) / bmiRange) * barW, labelY);
  ctx.fillText('42', barX + barW, labelY);

  ctx.font = '700 15px system-ui, sans-serif';
  const catLabelY = labelY + 24;
  const segColors = ['#4A90E2', '#00C853', '#FFD600', '#D50000'];
  const catCenters = [
    barX + ((15.25 - bmiMin) / bmiRange) * barW,
    barX + ((21.75 - bmiMin) / bmiRange) * barW,
    barX + ((27.5 - bmiMin) / bmiRange) * barW,
    barX + ((36 - bmiMin) / bmiRange) * barW
  ];
  for (let i = 0; i < segments.length; i++) {
    ctx.fillStyle = hexToRgba(segColors[i], 0.62);
    ctx.fillText(segments[i].label, catCenters[i], catLabelY);
  }

  const insightKey = getCategoryInsightKey(data.category);
  const insightText = t(insightKey);

  const insightPadX = 58;
  const insightPadY = 18;
  const insightMaxW = cardW - insightPadX * 2;

  ctx.font = '400 23px system-ui, sans-serif';
  ctx.textAlign = 'center';

  let insightFontSize = 23;
  let lineHeight = 32;
  let lines = wrapText(ctx, insightText, insightMaxW - 56);
  if (lines.length > 2) {
    insightFontSize = 21;
    lineHeight = 29;
    ctx.font = `${insightFontSize}px system-ui, sans-serif`;
    lines = wrapText(ctx, insightText, insightMaxW - 56);
  }

  const insightBoxH = lines.length * lineHeight + insightPadY * 2;
  const insightBoxX = cardX + insightPadX;
  const insightBoxY = insightY;
  const insightBoxW = insightMaxW;

  const insightGrad = ctx.createLinearGradient(insightBoxX, insightBoxY, insightBoxX, insightBoxY + insightBoxH);
  insightGrad.addColorStop(0, 'rgba(255,255,255,0.050)');
  insightGrad.addColorStop(1, 'rgba(255,255,255,0.022)');
  roundRect(ctx, insightBoxX, insightBoxY, insightBoxW, insightBoxH, 16);
  ctx.fillStyle = insightGrad;
  ctx.fill();

  roundRect(ctx, insightBoxX, insightBoxY, insightBoxW, insightBoxH, 16);
  ctx.strokeStyle = PREMIUM.borderMuted;
  ctx.lineWidth = 1;
  ctx.stroke();

  const textStartY = insightBoxY + insightPadY + 22;

  const barDotX = insightBoxX + 24;
  roundRect(ctx, barDotX, insightBoxY + insightPadY, 3, lines.length * lineHeight, 1.5);
  ctx.fillStyle = hexToRgba(accent, 0.55);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = PREMIUM.textSoft;
  ctx.font = `400 ${insightFontSize}px system-ui, sans-serif`;
  const textX = insightBoxX + 40;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, textStartY + i * lineHeight);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = hexToRgba(PREMIUM.emerald, 0.52);
  ctx.font = '700 21px system-ui, sans-serif';
  ctx.fillText(t('share.card_branding'), centerX, footerBrandY);

  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText('bmi-stellar.vercel.app', centerX, footerDomainY);

  const now = new Date();
  const timestamp = now.toLocaleString(getLocale() === 'zh' ? 'zh-CN' : getLocale(), { dateStyle: 'medium', timeStyle: 'short' });
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText(timestamp, centerX, footerTimeY);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
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
  a.download = `bmi-stellar-${data.bmi.toFixed(1)}.png`;
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

  const filename = `bmi-stellar-${data.bmi.toFixed(1)}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: t('share.title'),
        text: t('share.card_text', { n: data.bmi.toFixed(1), category: getCategoryLabel(data.category) }),
        files: [file]
      });
      return { ok: true, method: 'share' };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, method: 'none' };
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true, method: 'download' };
}
