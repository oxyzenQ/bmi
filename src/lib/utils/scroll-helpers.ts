// Copyright (c) 2025 - 2026 rezky_nightky

export interface PagerWheelOptions {
	pagerEl: HTMLElement | null;
	target: HTMLElement | null;
	dx: number;
	dy: number;
	now: number;
	lastNavAt: number;
	cooldownMs: number;
	dxThreshold: number;
	dyMax: number;
	ratio: number;
}

export type PagerDirection = 'next' | 'prev';

export function isScrollableY(el: HTMLElement): boolean {
	return el.scrollHeight > el.clientHeight + 2;
}

export function isMidScrollY(el: HTMLElement): boolean {
	if (!isScrollableY(el)) return false;
	const maxY = el.scrollHeight - el.clientHeight;
	return el.scrollTop > 2 && el.scrollTop < maxY - 2;
}

export function targetHasVerticalScroller(
	target: HTMLElement | null,
	pagerEl: HTMLElement | null,
	fallbackScroller: HTMLElement | null
): boolean {
	for (let el = target; el && el !== pagerEl; el = el.parentElement) {
		if (isScrollableY(el)) return true;
	}
	return fallbackScroller ? isScrollableY(fallbackScroller) : false;
}

export function targetCanScrollHorizontally(
	target: HTMLElement | null,
	pagerEl: HTMLElement | null,
	dx: number
): boolean {
	for (let el = target; el && el !== pagerEl; el = el.parentElement) {
		if (el.scrollWidth <= el.clientWidth + 2) continue;
		const maxX = el.scrollWidth - el.clientWidth;
		if ((dx > 0 && el.scrollLeft < maxX - 1) || (dx < 0 && el.scrollLeft > 1)) return true;
	}
	return false;
}

export function getPagerWheelDirection(options: PagerWheelOptions): PagerDirection | null {
	const { pagerEl, target, now, lastNavAt, cooldownMs, dxThreshold, dyMax, ratio } = options;
	if (target?.closest('.pager-nav, .pager-nav-shell, .pager-controls, .pager-controls-shell')) {
		return null;
	}
	if (now - lastNavAt < cooldownMs) return null;

	const { dx, dy } = options;
	if (Math.abs(dx) < dxThreshold) return null;
	if (Math.abs(dy) > dyMax) return null;
	if (Math.abs(dx) < Math.abs(dy) * ratio) return null;

	const section = pagerEl?.querySelector<HTMLElement>('.pager-section') ?? null;
	if (section && isMidScrollY(section)) return null;
	if (targetCanScrollHorizontally(target, pagerEl, dx)) return null;

	return dx > 0 ? 'next' : 'prev';
}
