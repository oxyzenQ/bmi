// Copyright (c) 2025 - 2026 rezky_nightky
import { HAPTIC, SCROLL } from './animation-config';
import {
	getVerticalScrollState,
	isMidScrollY,
	targetCanScrollVertically,
	targetHasVerticalScroller,
	type VerticalScrollDirection
} from './scroll-helpers';

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
	let startScroller: HTMLElement | null = null;
	let startScrollerTop = 0;
	let maxAbsDx = 0;
	let maxAbsDy = 0;
	let gestureIntent: 'horizontal' | 'vertical' | null = null;
	let lastNavAt = 0;

	function reset(): void {
		startX = null;
		startY = null;
		startTarget = null;
		startScroller = null;
		startScrollerTop = 0;
		maxAbsDx = 0;
		maxAbsDy = 0;
		gestureIntent = null;
	}

	function getTouchVerticalDirection(dy: number): VerticalScrollDirection {
		return dy > 0 ? 'up' : 'down';
	}

	function activeScrollerMoved(): boolean {
		if (!startScroller) return false;
		return Math.abs(startScroller.scrollTop - startScrollerTop) > 2;
	}

	function shouldCancelForVerticalScroll(dy: number): boolean {
		const absDy = Math.abs(dy);
		if (gestureIntent === 'vertical') return true;
		if (activeScrollerMoved()) return true;
		if (absDy < SCROLL.TOUCH_VERTICAL_CANCEL_PX) return false;
		if (
			options.isTouchScrollingActive() ||
			Date.now() - options.getLastTouchScrollAt() < SCROLL.TOUCH_SCROLL_MODE_IDLE_DELAY
		)
			return true;

		const scroller = options.getActiveScroller();
		if (scroller && isMidScrollY(scroller)) return true;
		const direction = getTouchVerticalDirection(dy);
		if (targetCanScrollVertically(startTarget, options.getPagerEl(), direction, scroller)) {
			return true;
		}
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
		startScroller = options.getActiveScroller();
		startScrollerTop = startScroller ? getVerticalScrollState(startScroller).scrollTop : 0;
		maxAbsDx = 0;
		maxAbsDy = 0;
		gestureIntent = null;
	}

	function handleTouchMove(e: TouchEvent): void {
		if (startX === null || startY === null) return;
		const touch = e.touches[0];
		if (!touch) return;

		const absDx = Math.abs(touch.clientX - startX);
		const absDy = Math.abs(touch.clientY - startY);
		maxAbsDx = Math.max(maxAbsDx, absDx);
		maxAbsDy = Math.max(maxAbsDy, absDy);

		if (gestureIntent !== null) return;
		if (maxAbsDy >= SCROLL.TOUCH_INTENT_PX && maxAbsDy > maxAbsDx * 0.72) {
			gestureIntent = 'vertical';
			return;
		}
		if (
			maxAbsDx >= SCROLL.TOUCH_INTENT_PX &&
			maxAbsDx > maxAbsDy * SCROLL.TOUCH_SWIPE_ANGLE_RATIO
		) {
			gestureIntent = 'horizontal';
		}
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

		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);
		const isHorizontal = absDx > absDy * SCROLL.TOUCH_SWIPE_ANGLE_RATIO;
		const isLongEnough = absDx >= SCROLL.TOUCH_SWIPE_DX_MIN;
		const isFastEnough = elapsed < SCROLL.TOUCH_SWIPE_MAX_MS;
		const now = Date.now();
		const isPastNavCooldown = now - lastNavAt >= SCROLL.TOUCH_NAV_COOLDOWN;
		const verticalScrollInProgress = shouldCancelForVerticalScroll(dy);

		if (
			isHorizontal &&
			isLongEnough &&
			isFastEnough &&
			isPastNavCooldown &&
			gestureIntent !== 'vertical' &&
			!verticalScrollInProgress
		) {
			lastNavAt = now;
			options.triggerHaptic(HAPTIC.NAV);
			if (dx < 0) options.nextSection();
			else options.prevSection();
		}
		reset();
	}

	return { handleTouchStart, handleTouchMove, handleTouchEnd, reset };
}
