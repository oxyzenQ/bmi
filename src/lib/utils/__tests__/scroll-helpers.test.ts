// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
	getPagerWheelDirection,
	isMidScrollY,
	isScrollableY,
	targetCanScrollVertically
} from '../scroll-helpers';

function makeScroller({
	clientHeight = 100,
	scrollHeight = 300,
	scrollTop = 0,
	overflowY = 'auto'
}: {
	clientHeight?: number;
	scrollHeight?: number;
	scrollTop?: number;
	overflowY?: string;
} = {}): HTMLElement {
	const el = document.createElement('div');
	el.style.overflowY = overflowY;
	Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
	Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
	Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: scrollTop });
	return el;
}

describe('scroll helpers', () => {
	it('only treats actual vertical overflow containers as scrollable', () => {
		expect(isScrollableY(makeScroller({ scrollHeight: 300, clientHeight: 100 }))).toBe(true);
		expect(
			isScrollableY(makeScroller({ scrollHeight: 300, clientHeight: 100, overflowY: 'visible' }))
		).toBe(false);
		expect(isScrollableY(makeScroller({ scrollHeight: 100, clientHeight: 100 }))).toBe(false);
	});

	it('detects mid-scroll state with edge tolerance', () => {
		expect(isMidScrollY(makeScroller({ scrollTop: 1 }))).toBe(false);
		expect(isMidScrollY(makeScroller({ scrollTop: 80 }))).toBe(true);
		expect(isMidScrollY(makeScroller({ scrollTop: 199 }))).toBe(false);
	});

	it('detects whether nested scrollers can consume vertical motion', () => {
		const pager = document.createElement('div');
		const scroller = makeScroller({ scrollTop: 80 });
		const child = document.createElement('button');
		scroller.append(child);
		pager.append(scroller);

		expect(targetCanScrollVertically(child, pager, 'up')).toBe(true);
		expect(targetCanScrollVertically(child, pager, 'down')).toBe(true);

		scroller.scrollTop = 0;
		expect(targetCanScrollVertically(child, pager, 'up')).toBe(false);
		expect(targetCanScrollVertically(child, pager, 'down')).toBe(true);
	});

	it('blocks wheel pager navigation right after vertical scroll activity', () => {
		const pager = document.createElement('div');
		const target = document.createElement('div');
		pager.append(target);

		expect(
			getPagerWheelDirection({
				pagerEl: pager,
				target,
				dx: 90,
				dy: 0,
				now: 1000,
				lastNavAt: 0,
				lastScrollAt: 900,
				cooldownMs: 520,
				recentScrollBlockMs: 180,
				dxThreshold: 60,
				dyMax: 12,
				ratio: 1.8
			})
		).toBeNull();
	});

	it('allows clear horizontal wheel navigation after recent scroll guard expires', () => {
		const pager = document.createElement('div');
		const target = document.createElement('div');
		pager.append(target);

		expect(
			getPagerWheelDirection({
				pagerEl: pager,
				target,
				dx: 90,
				dy: 0,
				now: 1100,
				lastNavAt: 0,
				lastScrollAt: 800,
				cooldownMs: 520,
				recentScrollBlockMs: 180,
				dxThreshold: 60,
				dyMax: 12,
				ratio: 1.8
			})
		).toBe('next');
	});
});
