/**
 * C-3: Canvas-based BMI result card image generator.
 * Produces a shareable PNG for Instagram Story / X / etc.
 *
 * P0: Glassmorphism card, BMI value glow, upgraded scale bar, accent consistency.
 * P1: Star field decoration, health insight text, grain overlay, personal data row.
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
const CARD_H = 1920;
const RADIUS = 64;

/** Helper: convert hex (#RRGGBB) to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getCategoryColor(cat: string): string {
  return isBmiCategory(cat) ? CATEGORY_COLORS[cat] : COLORS.SLATE;
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

/** Draw a pill-shaped stat cell with label above and value below */
function drawStatCell(
  ctx: CanvasRenderingContext2D,
  cx: number, // center x
  y: number,  // top of cell
  label: string,
  value: string,
  accent: string
) {
  const pillW = 260;
  const pillH = 120;
  const pillX = cx - pillW / 2;
  const pillR = 20;

  // Pill background — subtle glass
  const pillGrad = ctx.createLinearGradient(pillX, y, pillX + pillW, y + pillH);
  pillGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
  pillGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
  roundRect(ctx, pillX, y, pillW, pillH, pillR);
  ctx.fillStyle = pillGrad;
  ctx.fill();

  // Pill border — accent tinted
  roundRect(ctx, pillX, y, pillW, pillH, pillR);
  ctx.strokeStyle = hexToRgba(accent, 0.18);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label (above value)
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.letterSpacing = '0.05em';
  ctx.fillText(label, cx, y + 42);

  // Value (large, white with accent tint)
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText(value, cx, y + 90);
}

/**
 * P1: Draw star field on the background.
 * Renders tiny dots of varying brightness to simulate a cosmic star field.
 * Uses a seeded pseudo-random generator for reproducibility across renders.
 */
function drawStarField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  accent: string,
  seed: number = 42
) {
  // Simple seeded PRNG for deterministic star positions
  let s = seed;
  function rand(): number {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  }

  // Layer 1: Dim distant stars (small, low alpha)
  for (let i = 0; i < 120; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rand() * 1.2 + 0.3;
    const alpha = rand() * 0.25 + 0.05;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }

  // Layer 2: Medium stars (slightly brighter)
  for (let i = 0; i < 40; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rand() * 1.5 + 0.8;
    const alpha = rand() * 0.35 + 0.15;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }

  // Layer 3: Accent-tinted bright stars (rare, colored)
  for (let i = 0; i < 12; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rand() * 1.8 + 1.0;
    const alpha = rand() * 0.3 + 0.1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(accent, alpha);
    ctx.fill();

    // Subtle glow around accent stars
    if (alpha > 0.2) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, hexToRgba(accent, 0.06));
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    }
  }
}

/**
 * P1: Draw subtle grain/noise texture overlay on a region.
 * Uses a deterministic pattern of semi-transparent pixels for texture.
 */
function drawGrainOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  seed: number = 137
) {
  // Simple seeded PRNG
  let s = seed;
  function rand(): number {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  }

  // Clip to rounded rect
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();

  // Sparse grain dots — very subtle
  for (let i = 0; i < 800; i++) {
    const dx = rand() * w;
    const dy = rand() * h;
    const alpha = rand() * 0.04 + 0.01;
    const size = rand() < 0.3 ? 1.5 : 1;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x + dx, y + dy, size, size);
  }

  // Dark grain dots — even more subtle
  for (let i = 0; i < 400; i++) {
    const dx = rand() * w;
    const dy = rand() * h;
    const alpha = rand() * 0.03 + 0.005;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(x + dx, y + dy, 1, 1);
  }

  ctx.restore();
}

/**
 * P1: Draw a compact personal data row (height/weight) as small pill badges.
 */
function drawPersonalDataRow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  data: BmiCardData,
  accent: string
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

  if (items.length === 0) return y; // no data to show, return unchanged Y

  const pillW = 180;
  const pillH = 52;
  const gap = 24;
  const totalW = items.length * pillW + (items.length - 1) * gap;
  const startX = cx - totalW / 2;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const px = startX + i * (pillW + gap);
    const pillR = 14;

    // Pill background
    const pillGrad = ctx.createLinearGradient(px, y, px + pillW, y + pillH);
    pillGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
    pillGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
    roundRect(ctx, px, y, pillW, pillH, pillR);
    ctx.fillStyle = pillGrad;
    ctx.fill();

    // Pill border
    roundRect(ctx, px, y, pillW, pillH, pillR);
    ctx.strokeStyle = hexToRgba(accent, 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label + Value inline
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillText(item.label, px + pillW / 2 - 30, y + 33);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(item.value, px + pillW / 2 + 30, y + 33);
  }

  return y + pillH + 20; // return Y after this row
}

export async function generateBmiCard(data: BmiCardData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const accent = getCategoryColor(data.category);

  // ── Background — deep cosmic gradient ──
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bgGrad.addColorStop(0, '#0a0818');
  bgGrad.addColorStop(0.35, '#140428');
  bgGrad.addColorStop(0.65, '#1a0533');
  bgGrad.addColorStop(1, '#0a0818');
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 0);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // ── P1: Star field decoration ──
  drawStarField(ctx, CARD_W, CARD_H, accent);

  // ── Accent radial glow — large, behind BMI value area ──
  const glow1 = ctx.createRadialGradient(
    CARD_W / 2, CARD_H * 0.30, 0,
    CARD_W / 2, CARD_H * 0.30, 600
  );
  glow1.addColorStop(0, hexToRgba(accent, 0.12));
  glow1.addColorStop(0.5, hexToRgba(accent, 0.04));
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Secondary glow — subtle, lower ──
  const glow2 = ctx.createRadialGradient(
    CARD_W / 2, CARD_H * 0.55, 0,
    CARD_W / 2, CARD_H * 0.55, 400
  );
  glow2.addColorStop(0, hexToRgba(accent, 0.06));
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Card container ──
  const cardX = 60;
  const cardY = 200;
  const cardW = CARD_W - 120;
  const cardH = CARD_H - 400;

  // Card background — layered glass gradient
  const cardBg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardBg.addColorStop(0, 'rgba(255,255,255,0.08)');
  cardBg.addColorStop(0.15, 'rgba(255,255,255,0.05)');
  cardBg.addColorStop(0.85, 'rgba(255,255,255,0.03)');
  cardBg.addColorStop(1, 'rgba(255,255,255,0.06)');
  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.fillStyle = cardBg;
  ctx.fill();

  // Card inner glow — top edge highlight
  const innerGlow = ctx.createLinearGradient(cardX, cardY, cardX, cardY + 200);
  innerGlow.addColorStop(0, hexToRgba(accent, 0.06));
  innerGlow.addColorStop(1, 'transparent');
  roundRect(ctx, cardX, cardY, cardW, 200, RADIUS);
  ctx.fillStyle = innerGlow;
  ctx.fill();

  // Card border — accent tinted, thicker
  roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
  ctx.strokeStyle = hexToRgba(accent, 0.20);
  ctx.lineWidth = 3;
  ctx.stroke();

  // ── P1: Grain/noise texture overlay on card ──
  drawGrainOverlay(ctx, cardX, cardY, cardW, cardH, RADIUS);

  // ── Top accent line — gradient with glow ──
  // Wide glow line
  const accentGlowGrad = ctx.createLinearGradient(cardX + RADIUS, 0, cardX + cardW - RADIUS, 0);
  accentGlowGrad.addColorStop(0, 'transparent');
  accentGlowGrad.addColorStop(0.2, hexToRgba(accent, 0.15));
  accentGlowGrad.addColorStop(0.5, hexToRgba(accent, 0.30));
  accentGlowGrad.addColorStop(0.8, hexToRgba(accent, 0.15));
  accentGlowGrad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.moveTo(cardX + RADIUS, cardY);
  ctx.lineTo(cardX + cardW - RADIUS, cardY);
  ctx.strokeStyle = accentGlowGrad;
  ctx.lineWidth = 8;
  ctx.stroke();

  // Sharp accent line on top
  const accentSharpGrad = ctx.createLinearGradient(cardX + RADIUS, 0, cardX + cardW - RADIUS, 0);
  accentSharpGrad.addColorStop(0, 'transparent');
  accentSharpGrad.addColorStop(0.25, accent);
  accentSharpGrad.addColorStop(0.75, accent);
  accentSharpGrad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.moveTo(cardX + RADIUS, cardY);
  ctx.lineTo(cardX + cardW - RADIUS, cardY);
  ctx.strokeStyle = accentSharpGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // ── Header text — accent tinted ──
  ctx.textAlign = 'center';
  ctx.fillStyle = hexToRgba(accent, 0.55);
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText(t('share.card_header'), CARD_W / 2, cardY + 100);

  // ── BMI Value — large with glow ──
  // Large radial glow behind the number
  const valueGlow = ctx.createRadialGradient(
    CARD_W / 2, cardY + 330, 0,
    CARD_W / 2, cardY + 330, 280
  );
  valueGlow.addColorStop(0, hexToRgba(accent, 0.18));
  valueGlow.addColorStop(0.4, hexToRgba(accent, 0.06));
  valueGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = valueGlow;
  ctx.fillRect(cardX, cardY + 100, cardW, 500);

  // Canvas shadow for the BMI value
  ctx.save();
  ctx.shadowColor = hexToRgba(accent, 0.50);
  ctx.shadowBlur = 60;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = accent;
  ctx.font = '800 160px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.bmi.toFixed(1), CARD_W / 2, cardY + 360);
  ctx.restore();

  // Second pass without shadow for crisp text on top
  ctx.fillStyle = accent;
  ctx.font = '800 160px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.bmi.toFixed(1), CARD_W / 2, cardY + 360);

  // ── Category — white with subtle accent glow ──
  ctx.save();
  ctx.shadowColor = hexToRgba(accent, 0.25);
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.category.toUpperCase(), CARD_W / 2, cardY + 440);
  ctx.restore();

  // ── P1: Personal data row (height/weight) ──
  const afterPersonalY = drawPersonalDataRow(ctx, CARD_W / 2, cardY + 470, data, accent);

  // ── Divider — accent tinted ──
  const divY = Math.max(cardY + 500, afterPersonalY);
  const divGrad = ctx.createLinearGradient(cardX + 80, 0, cardX + cardW - 80, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.3, hexToRgba(accent, 0.15));
  divGrad.addColorStop(0.5, hexToRgba(accent, 0.25));
  divGrad.addColorStop(0.7, hexToRgba(accent, 0.15));
  divGrad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.moveTo(cardX + 80, divY);
  ctx.lineTo(cardX + cardW - 80, divY);
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Stats grid — pill cells ──
  const statsY = divY + 60;
  const colW = cardW / 3;

  if (data.bmiPrime !== null && data.bmiPrime !== undefined) {
    drawStatCell(ctx, cardX + colW * 0.5, statsY, t('share.card_prime'), data.bmiPrime.toFixed(2), accent);
  }

  if (data.idealMin !== null && data.idealMax !== null && data.weightUnit) {
    drawStatCell(ctx, cardX + colW * 1.5, statsY, t('share.card_ideal'), `${data.idealMin}\u2013${data.idealMax} ${data.weightUnit}`, accent);
  }

  if (data.tdee !== null && data.tdee !== undefined) {
    drawStatCell(ctx, cardX + colW * 2.5, statsY, t('share.card_tdee'), `${Math.round(data.tdee)} ${t('share.card_kcal')}`, accent);
  }

  // ── BMI Scale bar — upgraded with gradient segments, glow, labels ──
  const barY = statsY + 170;
  const barX = cardX + 80;
  const barW = cardW - 160;
  const barH = 24;
  const barR = 12;
  const bmiMin = 12;
  const bmiMax = 42;
  const bmiRange = bmiMax - bmiMin;

  // Bar track background
  roundRect(ctx, barX, barY, barW, barH, barR);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();

  // Bar segments — gradient fills with rounded clipping
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

    // Gradient fill per segment (darker at edges, brighter in center)
    const segGrad = ctx.createLinearGradient(segX, barY, segX + segW, barY);
    segGrad.addColorStop(0, hexToRgba(seg.color, 0.40));
    segGrad.addColorStop(0.5, hexToRgba(seg.color, 0.65));
    segGrad.addColorStop(1, hexToRgba(seg.color, 0.40));
    ctx.fillStyle = segGrad;
    ctx.fillRect(segX, barY, segW, barH);

    segX += segW;
  }
  ctx.restore();

  // Active segment glow — overlay glow at the marker position
  const markerPct = Math.max(0, Math.min(1, (data.bmi - bmiMin) / bmiRange));
  const markerX = barX + markerPct * barW;
  const activeGlow = ctx.createRadialGradient(markerX, barY + barH / 2, 0, markerX, barY + barH / 2, 100);
  activeGlow.addColorStop(0, hexToRgba(accent, 0.35));
  activeGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = activeGlow;
  ctx.fillRect(markerX - 100, barY - 10, 200, barH + 20);

  // BMI marker — outer glow ring + filled circle
  ctx.save();
  ctx.shadowColor = hexToRgba(accent, 0.60);
  ctx.shadowBlur = 20;

  // Outer ring
  ctx.beginPath();
  ctx.arc(markerX, barY + barH / 2, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Inner accent circle
  ctx.beginPath();
  ctx.arc(markerX, barY + barH / 2, 13, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();

  // Scale numeric labels
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.font = '500 18px system-ui, sans-serif';
  const labelY = barY + barH + 32;

  ctx.fillText('12', barX, labelY);
  ctx.fillText('18.5', barX + ((18.5 - bmiMin) / bmiRange) * barW, labelY);
  ctx.fillText('25', barX + ((25 - bmiMin) / bmiRange) * barW, labelY);
  ctx.fillText('30', barX + ((30 - bmiMin) / bmiRange) * barW, labelY);
  ctx.fillText('42', barX + barW, labelY);

  // Category labels below the scale
  ctx.font = '600 14px system-ui, sans-serif';
  const catLabelY = labelY + 24;
  const segColors = ['#4A90E2', '#00C853', '#FFD600', '#D50000'];
  const catCenters = [
    barX + ((15.25 - bmiMin) / bmiRange) * barW,
    barX + ((21.75 - bmiMin) / bmiRange) * barW,
    barX + ((27.5 - bmiMin) / bmiRange) * barW,
    barX + ((36 - bmiMin) / bmiRange) * barW
  ];
  for (let i = 0; i < segments.length; i++) {
    ctx.fillStyle = hexToRgba(segColors[i], 0.55);
    ctx.fillText(segments[i].label, catCenters[i], catLabelY);
  }

  // ── P1: Health insight text ──
  const insightY = catLabelY + 50;
  const insightKey = getCategoryInsightKey(data.category);
  const insightText = t(insightKey);

  // Insight container — subtle glass pill
  const insightPadX = 60;
  const insightPadY = 24;
  const insightMaxW = cardW - insightPadX * 2;

  // Measure text to determine container height
  ctx.font = '400 22px system-ui, sans-serif';
  ctx.textAlign = 'center';

  // Word-wrap insight text manually
  const words = insightText.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > insightMaxW - 40 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = 30;
  const insightBoxH = lines.length * lineHeight + insightPadY * 2;
  const insightBoxX = cardX + insightPadX;
  const insightBoxY = insightY;
  const insightBoxW = insightMaxW;

  // Insight box background
  const insightGrad = ctx.createLinearGradient(insightBoxX, insightBoxY, insightBoxX, insightBoxY + insightBoxH);
  insightGrad.addColorStop(0, hexToRgba(accent, 0.05));
  insightGrad.addColorStop(1, hexToRgba(accent, 0.02));
  roundRect(ctx, insightBoxX, insightBoxY, insightBoxW, insightBoxH, 16);
  ctx.fillStyle = insightGrad;
  ctx.fill();

  // Insight box border
  roundRect(ctx, insightBoxX, insightBoxY, insightBoxW, insightBoxH, 16);
  ctx.strokeStyle = hexToRgba(accent, 0.10);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Insight text start position
  const textStartY = insightBoxY + insightPadY + 22;

  // Left accent dot/bar
  const barDotX = insightBoxX + 24;
  roundRect(ctx, barDotX, insightBoxY + insightPadY, 3, lines.length * lineHeight, 1.5);
  ctx.fillStyle = hexToRgba(accent, 0.40);
  ctx.fill();

  // Draw insight text lines
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.font = '400 22px system-ui, sans-serif';
  const textX = insightBoxX + 40;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, textStartY + i * lineHeight);
  }

  // ── Footer branding — accent tinted ──
  ctx.textAlign = 'center';
  ctx.fillStyle = hexToRgba(accent, 0.30);
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText(t('share.card_branding'), CARD_W / 2, CARD_H - 160);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '400 20px system-ui, sans-serif';
  ctx.fillText('bmi-stellar.vercel.app', CARD_W / 2, CARD_H - 120);

  // Timestamp
  const now = new Date();
  const timestamp = now.toLocaleString(getLocale() === 'zh' ? 'zh-CN' : getLocale(), { dateStyle: 'medium', timeStyle: 'short' });
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText(timestamp, CARD_W / 2, CARD_H - 80);

  // Convert canvas to blob
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
        title: 'BMI Stellar Result',
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
