// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

export interface PagerWheelOptions {
	pagerEl: HTMLElement | null;
	target: HTMLElement | null;
	dx: number;
	dy: number;
	now: number;
	lastNavAt: number;
	lastScrollAt?: number;
	cooldownMs: number;
	recentScrollBlockMs?: number;
	dxThreshold: number;
	dyMax: number;
	ratio: number;
}

export type PagerDirection = 'next' | 'prev';
export type VerticalScrollDirection = 'up' | 'down';

const SCROLL_EDGE_TOLERANCE = 2;

function allowsVerticalScroll(el: HTMLElement): boolean {
	if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return true;
	const overflowY = window.getComputedStyle(el).overflowY;
	if (!overflowY) return true;
	return overflowY !== 'hidden' && overflowY !== 'clip' && overflowY !== 'visible';
}

export function isScrollableY(el: HTMLElement): boolean {
	return el.scrollHeight > el.clientHeight + SCROLL_EDGE_TOLERANCE && allowsVerticalScroll(el);
}

export function getVerticalScrollState(el: HTMLElement) {
	const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
	const scrollTop = Math.max(0, Math.min(maxY, el.scrollTop));
	return {
		maxY,
		scrollTop,
		canScrollUp: scrollTop > SCROLL_EDGE_TOLERANCE,
		canScrollDown: scrollTop < maxY - SCROLL_EDGE_TOLERANCE
	};
}

export function isMidScrollY(el: HTMLElement): boolean {
	if (!isScrollableY(el)) return false;
	const state = getVerticalScrollState(el);
	return state.canScrollUp && state.canScrollDown;
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

export function targetCanScrollVertically(
	target: HTMLElement | null,
	pagerEl: HTMLElement | null,
	direction: VerticalScrollDirection,
	fallbackScroller: HTMLElement | null = null
): boolean {
	for (let el = target; el && el !== pagerEl; el = el.parentElement) {
		if (!isScrollableY(el)) continue;
		const state = getVerticalScrollState(el);
		if (direction === 'up' ? state.canScrollUp : state.canScrollDown) return true;
	}

	if (!fallbackScroller || !isScrollableY(fallbackScroller)) return false;
	const state = getVerticalScrollState(fallbackScroller);
	return direction === 'up' ? state.canScrollUp : state.canScrollDown;
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
	const {
		pagerEl,
		target,
		now,
		lastNavAt,
		lastScrollAt = 0,
		cooldownMs,
		recentScrollBlockMs = 0,
		dxThreshold,
		dyMax,
		ratio
	} = options;
	if (target?.closest('.pager-nav, .pager-nav-shell, .pager-controls, .pager-controls-shell')) {
		return null;
	}
	if (now - lastNavAt < cooldownMs) return null;
	if (lastScrollAt > 0 && now - lastScrollAt < recentScrollBlockMs) return null;

	const { dx, dy } = options;
	if (Math.abs(dx) < dxThreshold) return null;
	if (Math.abs(dy) > dyMax) return null;
	if (Math.abs(dx) < Math.abs(dy) * ratio) return null;

	const section = pagerEl?.querySelector<HTMLElement>('.pager-section') ?? null;
	if (section && isMidScrollY(section)) return null;
	if (targetCanScrollHorizontally(target, pagerEl, dx)) return null;

	return dx > 0 ? 'next' : 'prev';
}
