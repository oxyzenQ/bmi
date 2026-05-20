// Copyright (c) 2025 - 2026 rezky_nightky
import { HAPTIC, SCROLL } from './animation-config';
import { isMidScrollY, targetHasVerticalScroller } from './scroll-helpers';

interface TouchPagerOptions {
	getPagerEl: () => HTMLElement | null;
	getActiveScroller: () => HTMLElement | null;
	isTouchScrollingActive: () => boolean;
	getLastTouchScrollAt: () => number;
	triggerHaptic: (pattern: number | number[]) => void;
	prevSection: () => void;
	nextSection: () => void;
}

export function createTouchPager(options: TouchPagerOptions) {
	let startX: number | null = null;
	let startY: number | null = null;
	let startTarget: HTMLElement | null = null;
	let startTime = 0;

	function reset(): void {
		startX = null;
		startY = null;
		startTarget = null;
	}

	function shouldCancelForVerticalScroll(absDy: number): boolean {
		if (absDy < SCROLL.TOUCH_VERTICAL_CANCEL_PX) return false;
		if (
			options.isTouchScrollingActive() ||
			Date.now() - options.getLastTouchScrollAt() < SCROLL.TOUCH_SCROLL_MODE_IDLE_DELAY
		)
			return true;

		const scroller = options.getActiveScroller();
		if (scroller && isMidScrollY(scroller)) return true;
		return targetHasVerticalScroller(startTarget, options.getPagerEl(), scroller);
	}

	function handleTouchStart(e: TouchEvent): void {
		const touch = e.touches[0];
		if (!touch) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('button, a, input, textarea, select, label, [role="button"]')) return;
		if (target?.closest('.pager-nav, .pager-nav-shell, .pager-controls, .pager-controls-shell'))
			return;

		startX = touch.clientX;
		startY = touch.clientY;
		startTarget = target;
		startTime = Date.now();
	}

	function handleTouchEnd(e: TouchEvent): void {
		if (startX === null || startY === null) {
			reset();
			return;
		}

		const touch = e.changedTouches[0];
		if (!touch) {
			reset();
			return;
		}

		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;
		const elapsed = Date.now() - startTime;
		startX = null;
		startY = null;

		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);
		const isHorizontal = absDx > absDy * SCROLL.TOUCH_SWIPE_ANGLE_RATIO;
		const isLongEnough = absDx >= SCROLL.TOUCH_SWIPE_DX_MIN;
		const isFastEnough = elapsed < SCROLL.TOUCH_SWIPE_MAX_MS;
		const verticalDidNotDominate = absDy < SCROLL.TOUCH_VERTICAL_CANCEL_PX || isHorizontal;
		const verticalScrollInProgress = shouldCancelForVerticalScroll(absDy);
		startTarget = null;

		if (
			isHorizontal &&
			isLongEnough &&
			isFastEnough &&
			verticalDidNotDominate &&
			!verticalScrollInProgress
		) {
			options.triggerHaptic(HAPTIC.NAV);
			if (dx < 0) options.nextSection();
			else options.prevSection();
		}
	}

	return { handleTouchStart, handleTouchEnd, reset };
}
