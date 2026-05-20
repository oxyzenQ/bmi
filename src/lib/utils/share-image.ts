// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Canvas-based premium black BMI result card generator.
 * Produces a shareable PNG for Instagram Story / X / etc.
 */

import { t, getLocale } from '$lib/i18n';
import { CATEGORY_COLORS, COLORS, isBmiCategory, getCategoryLabel } from './bmi-category';
import { getAppVersionShort } from './app-version';

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
	tdeeContext?: string | null;
}

const CARD_W = 1080;
const CARD_H = 1080;
const RADIUS = 56;

const PREMIUM = {
	bg: '#000000',
	frameBase: '#010102',
	frameFillTop: 'rgba(255,255,255,0.026)',
	frameFillMid: 'rgba(255,255,255,0.008)',
	frameFillBottom: 'rgba(255,255,255,0.014)',
	panelBottom: 'rgba(255,255,255,0.045)',
	border: 'rgba(255,255,255,0.14)',
	borderMuted: 'rgba(255,255,255,0.088)',
	borderLuxury: 'rgba(191,148,255,0.40)',
	text: '#F7F8FA',
	textSoft: 'rgba(255,255,255,0.80)',
	textMuted: 'rgba(255,255,255,0.56)',
	textFaint: 'rgba(255,255,255,0.36)',
	emerald: '#18D26E',
	brandViolet: '#4e3383',
	brandBlue: '#5b4ce0',
	brandPurple: '#8000ff',
	brandHighlight: '#e2c7ff'
} as const;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: number | null | undefined, fallback = 0): number {
	if (typeof value !== 'number') return fallback;
	return Number.isFinite(value) ? value : fallback;
}

function fitFontSize(
	ctx: CanvasRenderingContext2D,
	text: string,
	fontWeight: number,
	maxSize: number,
	minSize: number,
	maxWidth: number
): string {
	for (let size = maxSize; size >= minSize; size--) {
		const font = `${fontWeight} ${size}px system-ui, sans-serif`;
		ctx.font = font;
		if (ctx.measureText(text).width <= maxWidth) return font;
	}
	return `${fontWeight} ${minSize}px system-ui, sans-serif`;
}

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

/** Map English category to insight i18n key */
function getCategoryInsightKey(cat: string): string {
	switch (cat.toLowerCase()) {
		case 'underweight':
			return 'share.card_insight_underweight';
		case 'normal weight':
			return 'share.card_insight_normal';
		case 'overweight':
			return 'share.card_insight_overweight';
		case 'obese':
			return 'share.card_insight_obese';
		default:
			return 'share.card_insight_normal';
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
	ctx.font = font || '700 24px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';

	const metrics = ctx.measureText(text);
	const half = Math.max(metrics.width / 2, 1);
	const grad = ctx.createLinearGradient(x - half, y, x + half, y);

	for (const [stop, color] of gradientStops) {
		grad.addColorStop(stop, color);
	}

	ctx.fillStyle = grad;
	ctx.fillText(text, x, y);
	ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const safeMaxWidth = Math.max(maxWidth, 1);
	const useWords = /\s/.test(text);
	const units = useWords ? text.trim().split(/\s+/) : Array.from(text);
	const lines: string[] = [];
	let currentLine = '';

	for (const unit of units) {
		const testLine = currentLine
			? useWords
				? `${currentLine} ${unit}`
				: `${currentLine}${unit}`
			: unit;
		if (ctx.measureText(testLine).width > safeMaxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = unit;
		} else {
			currentLine = testLine;
		}
	}

	if (currentLine) lines.push(currentLine);
	return lines;
}

/** Draw a pill-shaped stat cell with label above, value below, and optional compact caption */
function drawStatCell(
	ctx: CanvasRenderingContext2D,
	cx: number, // center x
	y: number, // top of cell
	label: string,
	value: string,
	caption?: string
) {
	const pillW = 262;
	const pillH = caption ? 118 : 104;
	const pillX = cx - pillW / 2;
	const pillR = 26;

	const pillGrad = ctx.createLinearGradient(pillX, y, pillX + pillW, y + pillH);
	pillGrad.addColorStop(0, 'rgba(255,255,255,0.076)');
	pillGrad.addColorStop(0.54, 'rgba(255,255,255,0.042)');
	pillGrad.addColorStop(1, 'rgba(255,255,255,0.028)');
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.34)';
	ctx.shadowBlur = 18;
	ctx.shadowOffsetY = 8;
	roundRect(ctx, pillX, y, pillW, pillH, pillR);
	ctx.fillStyle = pillGrad;
	ctx.fill();
	ctx.restore();

	roundRect(ctx, pillX, y, pillW, pillH, pillR);
	const strokeGrad = ctx.createLinearGradient(pillX, y, pillX + pillW, y + pillH);
	strokeGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
	strokeGrad.addColorStop(0.55, PREMIUM.borderMuted);
	strokeGrad.addColorStop(1, 'rgba(191,148,255,0.16)');
	ctx.strokeStyle = strokeGrad;
	ctx.lineWidth = 1.15;
	ctx.stroke();

	const topSheen = ctx.createLinearGradient(pillX + 20, y, pillX + pillW - 20, y);
	topSheen.addColorStop(0, 'rgba(255,255,255,0)');
	topSheen.addColorStop(0.5, 'rgba(255,255,255,0.18)');
	topSheen.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.beginPath();
	ctx.moveTo(pillX + 28, y + 1);
	ctx.lineTo(pillX + pillW - 28, y + 1);
	ctx.strokeStyle = topSheen;
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.textAlign = 'center';
	ctx.fillStyle = PREMIUM.textMuted;
	ctx.font = '700 18px system-ui, sans-serif';
	ctx.fillText(label, cx, y + 33);

	ctx.fillStyle = PREMIUM.text;
	ctx.font = fitFontSize(ctx, value, 800, 32, 23, pillW - 28);
	ctx.fillText(value, cx, caption ? y + 70 : y + 78);

	if (caption) {
		ctx.fillStyle = PREMIUM.textFaint;
		ctx.font = '500 13px system-ui, sans-serif';
		ctx.fillText(caption, cx, y + 98);
	}
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

	const pillW = 192;
	const pillH = 52;
	const gap = 18;
	const totalW = items.length * pillW + (items.length - 1) * gap;
	const startX = cx - totalW / 2;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const px = startX + i * (pillW + gap);
		const pillR = 14;

		const pillGrad = ctx.createLinearGradient(px, y, px + pillW, y + pillH);
		pillGrad.addColorStop(0, 'rgba(255,255,255,0.050)');
		pillGrad.addColorStop(0.56, 'rgba(255,255,255,0.026)');
		pillGrad.addColorStop(1, 'rgba(255,255,255,0.016)');
		roundRect(ctx, px, y, pillW, pillH, pillR);
		ctx.fillStyle = pillGrad;
		ctx.fill();

		roundRect(ctx, px, y, pillW, pillH, pillR);
		const pillStroke = ctx.createLinearGradient(px, y, px + pillW, y + pillH);
		pillStroke.addColorStop(0, 'rgba(218,222,235,0.34)');
		pillStroke.addColorStop(0.56, 'rgba(150,158,176,0.24)');
		pillStroke.addColorStop(1, 'rgba(191,148,255,0.14)');
		ctx.strokeStyle = pillStroke;
		ctx.lineWidth = 1.8;
		ctx.stroke();

		const pillSheen = ctx.createLinearGradient(px + 18, y, px + pillW - 18, y);
		pillSheen.addColorStop(0, 'rgba(255,255,255,0)');
		pillSheen.addColorStop(0.5, 'rgba(255,255,255,0.15)');
		pillSheen.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.beginPath();
		ctx.moveTo(px + 22, y + 1);
		ctx.lineTo(px + pillW - 22, y + 1);
		ctx.strokeStyle = pillSheen;
		ctx.lineWidth = 1;
		ctx.stroke();

		ctx.textAlign = 'center';
		ctx.fillStyle = PREMIUM.textFaint;
		ctx.font = '600 15px system-ui, sans-serif';
		ctx.fillText(item.label, px + pillW / 2 - 30, y + 33);

		ctx.fillStyle = PREMIUM.text;
		ctx.font = '700 18px system-ui, sans-serif';
		ctx.fillText(item.value, px + pillW / 2 + 30, y + 33);
	}

	return y + pillH + 20;
}

function drawTopAura(ctx: CanvasRenderingContext2D, cx: number, frameY: number): void {
	const aura = ctx.createRadialGradient(cx, frameY - 22, 0, cx, frameY - 22, 388);
	aura.addColorStop(0, 'rgba(128,0,255,0.22)');
	aura.addColorStop(0.34, 'rgba(91,76,224,0.12)');
	aura.addColorStop(0.68, 'rgba(128,0,255,0.032)');
	aura.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = aura;
	ctx.fillRect(cx - 430, 0, 860, frameY + 170);

	const crown = ctx.createLinearGradient(cx - 310, frameY - 2, cx + 310, frameY - 2);
	crown.addColorStop(0, 'rgba(128,0,255,0)');
	crown.addColorStop(0.42, 'rgba(128,0,255,0.18)');
	crown.addColorStop(0.5, 'rgba(226,199,255,0.24)');
	crown.addColorStop(0.58, 'rgba(128,0,255,0.18)');
	crown.addColorStop(1, 'rgba(128,0,255,0)');
	ctx.fillStyle = crown;
	ctx.fillRect(cx - 310, frameY - 8, 620, 16);
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
	const safeBmi = toFiniteNumber(bmi, bmiMin);
	const pct = clamp((safeBmi - bmiMin) / bmiRange, 0, 1);

	const panelGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 26);
	panelGrad.addColorStop(0, 'rgba(255,255,255,0.060)');
	panelGrad.addColorStop(0.72, 'rgba(255,255,255,0.026)');
	panelGrad.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.beginPath();
	ctx.arc(cx, cy, radius + 22, 0, Math.PI * 2);
	ctx.fillStyle = panelGrad;
	ctx.fill();

	ctx.beginPath();
	ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
	ctx.strokeStyle = 'rgba(255,255,255,0.075)';
	ctx.lineWidth = 1;
	ctx.stroke();

	// Gauge track arc
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.strokeStyle = 'rgba(255,255,255,0.090)';
	ctx.lineWidth = 7;
	ctx.stroke();

	const segDefs = [
		{ from: 0, to: 0.217, color: '#4A90E2' },
		{ from: 0.217, to: 0.433, color: '#00C853' },
		{ from: 0.433, to: 0.6, color: '#FFD600' },
		{ from: 0.6, to: 1.0, color: '#D50000' }
	];

	const startAngle = -Math.PI / 2;

	for (const seg of segDefs) {
		const a1 = startAngle + seg.from * Math.PI * 2;
		const a2 = startAngle + Math.min(seg.to, pct) * Math.PI * 2;
		if (a2 <= a1) continue;

		ctx.beginPath();
		ctx.arc(cx, cy, radius, a1, a2);
		ctx.strokeStyle = hexToRgba(seg.color, 0.34);
		ctx.lineWidth = 7;
		ctx.lineCap = 'round';
		ctx.stroke();
	}

	const activeAngle = startAngle + pct * Math.PI * 2;
	ctx.beginPath();
	ctx.arc(cx, cy, radius, startAngle, activeAngle);
	ctx.strokeStyle = hexToRgba(accent, 0.62);
	ctx.lineWidth = 7;
	ctx.lineCap = 'round';
	ctx.stroke();

	const dotX = cx + Math.cos(activeAngle) * radius;
	const dotY = cy + Math.sin(activeAngle) * radius;

	ctx.beginPath();
	ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
	ctx.fillStyle = PREMIUM.bg;
	ctx.fill();

	ctx.beginPath();
	ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
	ctx.strokeStyle = hexToRgba(accent, 0.9);
	ctx.lineWidth = 2.2;
	ctx.stroke();

	ctx.textAlign = 'center';
	ctx.fillStyle = hexToRgba(accent, 0.56);
	ctx.font = '800 18px system-ui, sans-serif';
	ctx.fillText('BMI', cx, cy - 4);
	ctx.fillStyle = 'rgba(255,255,255,0.46)';
	ctx.font = '700 14px system-ui, sans-serif';
	ctx.fillText(safeBmi.toFixed(1), cx, cy + 15);
}

function drawPremiumFrame(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
): void {
	ctx.save();
	ctx.shadowColor = 'rgba(128,0,255,0.34)';
	ctx.shadowBlur = 54;
	ctx.shadowOffsetY = 0;
	roundRect(ctx, x, y, w, h, r);
	ctx.fillStyle = 'rgba(128,0,255,0.038)';
	ctx.fill();
	ctx.restore();

	roundRect(ctx, x, y, w, h, r);
	ctx.fillStyle = PREMIUM.frameBase;
	ctx.fill();

	const cardBg = ctx.createLinearGradient(x, y, x, y + h);
	cardBg.addColorStop(0, PREMIUM.frameFillTop);
	cardBg.addColorStop(0.36, PREMIUM.frameFillMid);
	cardBg.addColorStop(1, PREMIUM.frameFillBottom);
	roundRect(ctx, x, y, w, h, r);
	ctx.fillStyle = cardBg;
	ctx.fill();

	const strokeGrad = ctx.createLinearGradient(x, y, x + w, y + h);
	strokeGrad.addColorStop(0, 'rgba(255,255,255,0.24)');
	strokeGrad.addColorStop(0.32, 'rgba(128,0,255,0.58)');
	strokeGrad.addColorStop(0.68, 'rgba(226,199,255,0.44)');
	strokeGrad.addColorStop(1, 'rgba(255,255,255,0.16)');
	roundRect(ctx, x, y, w, h, r);
	ctx.strokeStyle = strokeGrad;
	ctx.lineWidth = 2.8;
	ctx.stroke();

	const innerEdge = ctx.createLinearGradient(x + 10, y + 10, x + w - 10, y + h - 10);
	innerEdge.addColorStop(0, 'rgba(255,255,255,0.10)');
	innerEdge.addColorStop(0.5, 'rgba(191,148,255,0.11)');
	innerEdge.addColorStop(1, 'rgba(255,255,255,0.055)');
	roundRect(ctx, x + 10, y + 10, w - 20, h - 20, r - 12);
	ctx.strokeStyle = innerEdge;
	ctx.lineWidth = 1.25;
	ctx.stroke();

	const topLine = ctx.createLinearGradient(x + 92, 0, x + w - 92, 0);
	topLine.addColorStop(0, 'rgba(128,0,255,0)');
	topLine.addColorStop(0.36, 'rgba(91,76,224,0.50)');
	topLine.addColorStop(0.5, 'rgba(226,199,255,0.70)');
	topLine.addColorStop(0.66, 'rgba(128,0,255,0.52)');
	topLine.addColorStop(1, 'rgba(128,0,255,0)');
	ctx.beginPath();
	ctx.moveTo(x + 110, y + 1);
	ctx.lineTo(x + w - 110, y + 1);
	ctx.strokeStyle = topLine;
	ctx.lineWidth = 1.6;
	ctx.stroke();
}

export async function generateBmiCard(data: BmiCardData): Promise<Blob | null> {
	if (typeof document === 'undefined') return null;

	const canvas = document.createElement('canvas');
	canvas.width = CARD_W;
	canvas.height = CARD_H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	const safeBmi = clamp(toFiniteNumber(data.bmi, 0), 0, 99.9);
	const accent = getCategoryColor(data.category);
	const centerX = CARD_W / 2;

	ctx.fillStyle = PREMIUM.bg;
	ctx.fillRect(0, 0, CARD_W, CARD_H);

	const bgDepth = ctx.createRadialGradient(
		CARD_W / 2,
		CARD_H * 0.4,
		0,
		CARD_W / 2,
		CARD_H * 0.4,
		560
	);
	bgDepth.addColorStop(0, 'rgba(128,0,255,0.030)');
	bgDepth.addColorStop(0.48, 'rgba(255,255,255,0.008)');
	bgDepth.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = bgDepth;
	ctx.fillRect(0, 0, CARD_W, CARD_H);

	const cardX = 54;
	const cardY = 54;
	const cardW = CARD_W - 108;
	const cardH = CARD_H - 108;
	const contentX = cardX + 62;
	const contentW = cardW - 124;
	const headerY = cardY + 78;
	const bmiY = cardY + 252;
	const categoryY = cardY + 324;
	const pillsY = cardY + 374;
	const statsY = cardY + 486;
	const scaleY = cardY + 632;
	const insightY = cardY + 738;
	const footerLineY = cardY + cardH - 94;
	const footerBrandY = footerLineY + 36;
	const footerMetaY = footerBrandY + 34;

	drawTopAura(ctx, centerX, cardY);
	drawPremiumFrame(ctx, cardX, cardY, cardW, cardH, RADIUS);

	const rim = ctx.createLinearGradient(cardX, cardY, cardX, cardY + 150);
	rim.addColorStop(0, 'rgba(255,255,255,0.038)');
	rim.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.save();
	roundRect(ctx, cardX, cardY, cardW, cardH, RADIUS);
	ctx.clip();
	ctx.fillStyle = rim;
	ctx.fillRect(cardX, cardY, cardW, 150);
	ctx.restore();

	const headerText = t('share.card_header');
	const headerFont = fitFontSize(ctx, headerText, 800, 30, 23, contentW);
	drawGradientCenteredText(ctx, headerText, centerX, headerY, headerFont, [
		[0, PREMIUM.brandViolet],
		[0.28, PREMIUM.brandBlue],
		[0.56, PREMIUM.brandPurple],
		[0.78, '#9b5cff'],
		[1, PREMIUM.brandHighlight]
	]);

	const headerDivider = ctx.createLinearGradient(contentX, 0, contentX + contentW, 0);
	headerDivider.addColorStop(0, 'rgba(255,255,255,0)');
	headerDivider.addColorStop(0.5, 'rgba(226,199,255,0.12)');
	headerDivider.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.beginPath();
	ctx.moveTo(contentX + 130, headerY + 32);
	ctx.lineTo(contentX + contentW - 130, headerY + 32);
	ctx.strokeStyle = headerDivider;
	ctx.lineWidth = 1;
	ctx.stroke();

	const valueAura = ctx.createRadialGradient(centerX, bmiY - 38, 0, centerX, bmiY - 38, 250);
	valueAura.addColorStop(0, hexToRgba(accent, 0.12));
	valueAura.addColorStop(0.48, hexToRgba(accent, 0.036));
	valueAura.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = valueAura;
	ctx.fillRect(contentX, bmiY - 210, contentW, 300);

	const bmiText = safeBmi.toFixed(1);
	ctx.font = '800 150px system-ui, sans-serif';
	ctx.textAlign = 'center';

	const textGrad = ctx.createLinearGradient(centerX, bmiY - 130, centerX, bmiY + 20);
	textGrad.addColorStop(0, lightenHex(accent, 0.18));
	textGrad.addColorStop(0.55, accent);
	textGrad.addColorStop(1, hexToRgba(accent, 0.82));

	ctx.save();
	ctx.shadowColor = hexToRgba(accent, 0.36);
	ctx.shadowBlur = 30;
	ctx.shadowOffsetY = 0;
	ctx.fillStyle = textGrad;
	ctx.fillText(bmiText, centerX, bmiY);
	ctx.restore();

	const gaugeCx = centerX + 292;
	const gaugeCy = bmiY - 58;
	drawMiniGauge(ctx, gaugeCx, gaugeCy, 52, safeBmi, accent);

	ctx.fillStyle = PREMIUM.text;
	ctx.font = fitFontSize(
		ctx,
		getCategoryLabel(data.category).toUpperCase(),
		800,
		45,
		32,
		contentW - 140
	);
	ctx.textAlign = 'center';
	const categoryLabel = getCategoryLabel(data.category);
	const categoryText = categoryLabel.toUpperCase();
	const catMetrics = ctx.measureText(categoryText);
	const catTextX = centerX;
	const catTextY = categoryY;
	const catPillW = Math.min(contentW - 180, catMetrics.width + 96);
	const catPillH = 66;
	const catPillX = centerX - catPillW / 2;
	const catPillY = catTextY - 47;
	const catPillGrad = ctx.createLinearGradient(catPillX, catPillY, catPillX, catPillY + catPillH);
	catPillGrad.addColorStop(0, 'rgba(255,255,255,0.050)');
	catPillGrad.addColorStop(1, 'rgba(255,255,255,0.020)');
	roundRect(ctx, catPillX, catPillY, catPillW, catPillH, 28);
	ctx.fillStyle = catPillGrad;
	ctx.fill();
	roundRect(ctx, catPillX, catPillY, catPillW, catPillH, 28);
	ctx.strokeStyle = hexToRgba(accent, 0.22);
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.55)';
	ctx.shadowBlur = 16;
	ctx.fillStyle = PREMIUM.text;
	ctx.fillText(categoryText, catTextX, catTextY);
	ctx.restore();

	const dotX = catTextX - catMetrics.width / 2 - 24;
	const dotY = catTextY - 16;
	ctx.beginPath();
	ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
	ctx.fillStyle = hexToRgba(accent, 0.95);
	ctx.fill();

	const afterPersonalY = drawPersonalDataRow(ctx, centerX, pillsY, data);

	const divY = Math.min(statsY - 26, Math.max(pillsY + 74, afterPersonalY + 20));
	const divGrad = ctx.createLinearGradient(contentX, 0, contentX + contentW, 0);
	divGrad.addColorStop(0, 'rgba(255,255,255,0)');
	divGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
	divGrad.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.beginPath();
	ctx.moveTo(contentX + 24, divY);
	ctx.lineTo(contentX + contentW - 24, divY);
	ctx.strokeStyle = divGrad;
	ctx.lineWidth = 1;
	ctx.stroke();

	const colW = contentW / 3;

	if (data.bmiPrime !== null && data.bmiPrime !== undefined) {
		drawStatCell(
			ctx,
			contentX + colW * 0.5,
			statsY,
			t('share.card_prime'),
			data.bmiPrime.toFixed(2),
			t('share.card_prime_caption')
		);
	}

	if (data.idealMin !== null && data.idealMax !== null && data.weightUnit) {
		drawStatCell(
			ctx,
			contentX + colW * 1.5,
			statsY,
			t('share.card_ideal'),
			`${data.idealMin}\u2013${data.idealMax} ${data.weightUnit}`
		);
	}

	if (data.tdee !== null && data.tdee !== undefined) {
		const tdeeCaption = data.tdeeContext ?? t('share.card_tdee_estimate');
		drawStatCell(
			ctx,
			contentX + colW * 2.5,
			statsY,
			t('share.card_tdee'),
			`${Math.round(data.tdee)} ${t('share.card_kcal')}`,
			tdeeCaption
		);
	}

	const barY = scaleY;
	const barX = contentX + 44;
	const barW = contentW - 88;
	const barH = 22;
	const barR = 11;
	const bmiMin = 12;
	const bmiMax = 42;
	const bmiRange = bmiMax - bmiMin;

	roundRect(ctx, barX, barY, barW, barH, barR);
	ctx.fillStyle = 'rgba(255,255,255,0.060)';
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
		segGrad.addColorStop(0, hexToRgba(seg.color, 0.42));
		segGrad.addColorStop(0.5, hexToRgba(seg.color, 0.62));
		segGrad.addColorStop(1, hexToRgba(seg.color, 0.42));
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
		ctx.strokeStyle = 'rgba(255,255,255,0.18)';
		ctx.lineWidth = 1;
		ctx.stroke();
	}

	const markerPct = clamp((safeBmi - bmiMin) / bmiRange, 0, 1);
	const markerX = barX + markerPct * barW;
	const activeGlow = ctx.createRadialGradient(
		markerX,
		barY + barH / 2,
		0,
		markerX,
		barY + barH / 2,
		100
	);
	activeGlow.addColorStop(0, hexToRgba(accent, 0.11));
	activeGlow.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = activeGlow;
	ctx.fillRect(markerX - 100, barY - 10, 200, barH + 20);

	ctx.beginPath();
	ctx.arc(markerX, barY + barH / 2, 15, 0, Math.PI * 2);
	ctx.fillStyle = PREMIUM.bg;
	ctx.fill();

	ctx.beginPath();
	ctx.arc(markerX, barY + barH / 2, 12, 0, Math.PI * 2);
	ctx.strokeStyle = hexToRgba(accent, 0.96);
	ctx.lineWidth = 3;
	ctx.stroke();

	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.58)';
	ctx.font = '600 16px system-ui, sans-serif';
	const labelY = barY + barH + 28;

	ctx.fillText('12', barX, labelY);
	ctx.fillText('18.5', barX + ((18.5 - bmiMin) / bmiRange) * barW, labelY);
	ctx.fillText('25', barX + ((25 - bmiMin) / bmiRange) * barW, labelY);
	ctx.fillText('30', barX + ((30 - bmiMin) / bmiRange) * barW, labelY);
	ctx.fillText('42', barX + barW, labelY);

	ctx.font = '700 14px system-ui, sans-serif';
	const catLabelY = labelY + 22;
	const segColors = ['#4A90E2', '#00C853', '#FFD600', '#D50000'];
	const catCenters = [
		barX + ((15.25 - bmiMin) / bmiRange) * barW,
		barX + ((21.75 - bmiMin) / bmiRange) * barW,
		barX + ((27.5 - bmiMin) / bmiRange) * barW,
		barX + ((36 - bmiMin) / bmiRange) * barW
	];
	for (let i = 0; i < segments.length; i++) {
		ctx.fillStyle = hexToRgba(segColors[i], 0.74);
		ctx.fillText(segments[i].label, catCenters[i], catLabelY);
	}

	const insightKey = getCategoryInsightKey(data.category);
	const insightText = t(insightKey);

	const insightPadX = 70;
	const insightPadY = 20;
	const insightMaxW = cardW - insightPadX * 2;

	ctx.font = '400 22px system-ui, sans-serif';
	ctx.textAlign = 'center';

	let insightFontSize = 22;
	let lineHeight = 31;
	let lines = wrapText(ctx, insightText, insightMaxW - 96);
	if (lines.length > 2) {
		insightFontSize = 20;
		lineHeight = 28;
		ctx.font = `${insightFontSize}px system-ui, sans-serif`;
		lines = wrapText(ctx, insightText, insightMaxW - 96);
	}

	const insightBoxH = Math.max(86, lines.length * lineHeight + insightPadY * 2);
	const insightBoxX = cardX + insightPadX;
	const insightBoxY = insightY;
	const insightBoxW = insightMaxW;

	const insightGrad = ctx.createLinearGradient(
		insightBoxX,
		insightBoxY,
		insightBoxX,
		insightBoxY + insightBoxH
	);
	insightGrad.addColorStop(0, 'rgba(255,255,255,0.074)');
	insightGrad.addColorStop(0.58, 'rgba(255,255,255,0.040)');
	insightGrad.addColorStop(1, 'rgba(255,255,255,0.026)');
	roundRect(ctx, insightBoxX, insightBoxY, insightBoxW, insightBoxH, 24);
	ctx.fillStyle = insightGrad;
	ctx.fill();

	const insightStroke = ctx.createLinearGradient(
		insightBoxX,
		insightBoxY,
		insightBoxX + insightBoxW,
		insightBoxY + insightBoxH
	);
	insightStroke.addColorStop(0, 'rgba(255,255,255,0.17)');
	insightStroke.addColorStop(0.65, PREMIUM.borderMuted);
	insightStroke.addColorStop(1, hexToRgba(accent, 0.24));
	roundRect(ctx, insightBoxX, insightBoxY, insightBoxW, insightBoxH, 24);
	ctx.strokeStyle = insightStroke;
	ctx.lineWidth = 1;
	ctx.stroke();

	const textBlockH = (lines.length - 1) * lineHeight;
	const textStartY = insightBoxY + insightBoxH / 2 - textBlockH / 2 + 8;

	const glyphX = insightBoxX + 34;
	const glyphY = insightBoxY + insightBoxH / 2;
	ctx.beginPath();
	ctx.arc(glyphX, glyphY, 14, 0, Math.PI * 2);
	ctx.fillStyle = hexToRgba(accent, 0.18);
	ctx.fill();

	ctx.beginPath();
	ctx.arc(glyphX, glyphY, 5, 0, Math.PI * 2);
	ctx.fillStyle = hexToRgba(accent, 0.88);
	ctx.fill();

	roundRect(ctx, glyphX + 28, insightBoxY + 24, 3, insightBoxH - 48, 1.5);
	ctx.fillStyle = hexToRgba(accent, 0.52);
	ctx.fill();

	ctx.textAlign = 'left';
	ctx.fillStyle = PREMIUM.textSoft;
	ctx.font = `400 ${insightFontSize}px system-ui, sans-serif`;
	const textX = insightBoxX + 82;
	for (let i = 0; i < lines.length; i++) {
		ctx.fillText(lines[i], textX, textStartY + i * lineHeight);
	}

	ctx.textAlign = 'center';
	const footerDivider = ctx.createLinearGradient(contentX, 0, contentX + contentW, 0);
	footerDivider.addColorStop(0, 'rgba(255,255,255,0)');
	footerDivider.addColorStop(0.5, 'rgba(255,255,255,0.10)');
	footerDivider.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.beginPath();
	ctx.moveTo(contentX + 32, footerLineY);
	ctx.lineTo(contentX + contentW - 32, footerLineY);
	ctx.strokeStyle = footerDivider;
	ctx.lineWidth = 1;
	ctx.stroke();

	const shareVersion = `v${getAppVersionShort()}`;
	const brandLine = `${t('share.card_branding')} \u00b7 ${shareVersion}`;
	const brandFont = fitFontSize(ctx, brandLine, 700, 21, 17, contentW);
	drawGradientCenteredText(ctx, brandLine, centerX, footerBrandY, brandFont, [
		[0, PREMIUM.brandViolet],
		[0.28, PREMIUM.brandBlue],
		[0.56, PREMIUM.brandPurple],
		[0.78, '#9b5cff'],
		[1, PREMIUM.brandHighlight]
	]);

	const now = new Date();
	let timestamp = '';
	try {
		timestamp = now.toLocaleString(getLocale() === 'zh' ? 'zh-CN' : getLocale(), {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	} catch {
		timestamp = now.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
	}

	ctx.fillStyle = 'rgba(255,255,255,0.34)';
	ctx.font = '500 17px system-ui, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText('bmi-stellar.vercel.app', contentX + 8, footerMetaY);

	ctx.fillStyle = 'rgba(255,255,255,0.26)';
	ctx.font = fitFontSize(ctx, timestamp, 400, 16, 13, contentW * 0.46);
	ctx.textAlign = 'right';
	ctx.fillText(timestamp, contentX + contentW - 8, footerMetaY);

	return new Promise<Blob | null>((resolve) => {
		canvas.toBlob((blob) => resolve(blob), 'image/png');
	});
}

export async function shareBmiCard(
	data: BmiCardData
): Promise<{ ok: boolean; method: 'share' | 'download' | 'none' }> {
	const blob = await generateBmiCard(data);
	if (!blob) return { ok: false, method: 'none' };

	const safeBmi = clamp(toFiniteNumber(data.bmi, 0), 0, 99.9);
	const filename = `bmi-stellar-${safeBmi.toFixed(1)}.png`;
	const file = new File([blob], filename, { type: 'image/png' });

	if (navigator.share && navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({
				title: t('share.title'),
				text: t('share.card_text', {
					n: safeBmi.toFixed(1),
					category: getCategoryLabel(data.category)
				}),
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
