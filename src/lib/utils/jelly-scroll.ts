// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// Night-cafe-10 jelly scroll: a rubber-band + spring settle for the
// vertical scroll limits. When a scroller is pushed past its top or
// bottom edge (wheel or touch), the content is dragged with the iOS
// rubber-band resistance curve; on release an underdamped spring
// carries it back with a couple of visible oscillations - the "kenyal"
// settle. Pure physics lives in exported functions so the suite pins
// the feel without a browser; attachJellyScroll is the thin DOM glue
// that wires the controller to a scroller element (Svelte action).
//
// The glue never calls preventDefault: native scrolling stays native,
// the transform only adds the elastic give past the hard limits, and
// the pager's own wheel/touch navigation logic is untouched.

import { prefersReducedMotion } from './animation-config';
import { getVerticalScrollState } from './scroll-helpers';

/** Tunables: the resistance curve cap and the release spring. */
export const JELLY = {
	/** Rubber-band cap: the pull asymptote as a ratio of the viewport.
	 *  night-cafe-mclaren-2: the give steps down a tier - 0.12 -> 0.08
	 *  of the viewport, clamp [32, 72] - and the settle damping rises
	 *  0.5 -> 0.7: one gentle overshoot instead of two bouncy ones.
	 *  Fewer pixels animate per frame and the spring settles ~30%
	 *  sooner, which is the low-end scroll-smoothness fix as much as
	 *  it is the elegance pass. */
	CAP_RATIO: 0.08,
	CAP_MIN: 32,
	CAP_MAX: 72,
	/** Low-tier signals: a smaller give animates fewer pixels per
	 *  frame on the hardware that can least afford it. */
	LOW_TIER_CORES: 4,
	LOW_TIER_MEMORY_GB: 4,
	CAP_MIN_LOW: 20,
	LOW_TIER_CAP_RATIO: 0.6,
	/** Release spring: a single gentle overshoot (the calm settle). */
	STIFFNESS: 170,
	DAMPING_RATIO: 0.7,
	/** Wheel inactivity that converts a drag into a release (ms). */
	WHEEL_RELEASE_IDLE_MS: 140,
	/** Per-event overscroll absorption cap (px). */
	MAX_EVENT_PX: 32,
	/** Spring settle thresholds. */
	SETTLE_DISPLACEMENT_PX: 0.5,
	SETTLE_VELOCITY_PX_S: 24,
	/** Frame integration clamp (ms) - guards a stalled tab. */
	MAX_FRAME_DT_MS: 33
} as const;

export type JellyEdge = 'top' | 'bottom';

/**
 * iOS-style rubber-band resistance: displacement grows fast at first
 * and flattens asymptotically toward cap. Sign is applied by the
 * caller; excess must be >= 0.
 */
export function rubberBandDisplacement(excess: number, cap: number): number {
	if (!(excess > 0) || !(cap > 0)) return 0;
	return cap * (1 - 1 / (excess / cap + 1));
}

/**
 * The rubber-band cap for a scroller: the viewport ratio clamped to
 * [CAP_MIN, CAP_MAX]. A low-tier device - few cores or little
 * memory - gets a smaller give, so the settle animates fewer
 * pixels per frame on the hardware that can least afford it.
 * Unknown signals (both values are optional and, where they exist
 * at all, Chrome-only) count as high tier: degrade to the full
 * feel, never punish a capable device.
 */
export function resolveJellyCap(
	clientHeight: number,
	cores: number | null,
	memoryGb: number | null
): number {
	const base = Math.max(
		JELLY.CAP_MIN,
		Math.min(JELLY.CAP_MAX, Math.round(clientHeight * JELLY.CAP_RATIO))
	);
	const lowTier =
		(cores !== null && cores <= JELLY.LOW_TIER_CORES) ||
		(memoryGb !== null && memoryGb <= JELLY.LOW_TIER_MEMORY_GB);
	if (!lowTier) return base;
	return Math.max(JELLY.CAP_MIN_LOW, Math.round(base * JELLY.LOW_TIER_CAP_RATIO));
}

/**
 * One semi-implicit Euler step of the release spring. Underdamped by
 * design: the displacement overshoots the rest point and swings back
 * before settling. Returns the stepped state and whether it may stop.
 */
export function stepSpring(
	d: number,
	v: number,
	dtSec: number,
	stiffness = JELLY.STIFFNESS,
	dampingRatio = JELLY.DAMPING_RATIO
): { d: number; v: number; settled: boolean } {
	const damping = 2 * Math.sqrt(stiffness) * dampingRatio;
	const dt = Math.max(0, Math.min(dtSec, JELLY.MAX_FRAME_DT_MS / 1000));
	// Semi-implicit Euler: velocity first with the spring force, then
	// position with the fresh velocity - stable at animation rates.
	const vNext = v + (-stiffness * d - damping * v) * dt;
	const dNext = d + vNext * dt;
	const settled =
		Math.abs(dNext) < JELLY.SETTLE_DISPLACEMENT_PX && Math.abs(vNext) < JELLY.SETTLE_VELOCITY_PX_S;
	return { d: settled ? 0 : dNext, v: settled ? 0 : vNext, settled };
}

/**
 * The jelly state machine. Deliberately DOM-free: pushes and frames
 * arrive as plain numbers, so tests drive the feel deterministically.
 */
export class JellyController {
	private excess = 0;
	private edge: JellyEdge = 'top';
	private dragging = false;
	private releasing = false;
	private lastPushAt = 0;
	private lastFrameAt = 0;
	private d = 0;
	private v = 0;

	get active(): boolean {
		return this.dragging || this.releasing;
	}

	/** Current signed displacement (top edge pulls down: positive). */
	get displacement(): number {
		return this.dragging ? this.signedRubberBand() : this.d;
	}

	private signedRubberBand(): number {
		const sign = this.edge === 'top' ? 1 : -1;
		return sign * rubberBandDisplacement(this.excess, this.cap);
	}

	constructor(private cap: number = JELLY.CAP_MAX) {}

	/**
	 * Absorb one overscroll event. A push on the opposite edge of an
	 * active drag drops the drag and starts fresh on the new edge.
	 * Returns the signed displacement after the push.
	 */
	push(excessDelta: number, now: number, edge: JellyEdge): number {
		if (!(excessDelta > 0)) return this.displacement;
		if (this.dragging && edge !== this.edge) {
			this.startRelease(now);
		}
		if (this.releasing) {
			// A push during release restarts a drag from the current pose.
			this.releasing = false;
			this.dragging = true;
			this.excess = this.capAtDisplacement(this.d);
		}
		this.dragging = true;
		this.edge = edge;
		this.excess = Math.min(this.excess + excessDelta, this.cap * 4);
		this.lastPushAt = now;
		return this.displacement;
	}

	/** Reverse-map a signed displacement to the excess that produced it. */
	private capAtDisplacement(d: number): number {
		const magnitude = Math.min(Math.abs(d), this.cap * 0.999);
		if (magnitude <= 0) return 0;
		// Invert d = cap * (1 - 1/(x/cap + 1)) -> x = cap * (d / (cap - d)).
		return (this.cap * magnitude) / (this.cap - magnitude);
	}

	/** Hand the pose to the release spring. */
	release(now: number): void {
		this.startRelease(now);
	}

	private startRelease(_now: number): void {
		if (!this.dragging) {
			this.releasing = false;
			return;
		}
		this.d = this.signedRubberBand();
		this.v = 0;
		this.dragging = false;
		this.releasing = true;
	}

	/**
	 * Advance the state machine. While dragging the displacement rides
	 * the rubber band, with an idle wheel auto-releasing; while
	 * releasing the spring integrates toward rest. Returns the signed
	 * displacement to render (0 once fully settled).
	 */
	frame(now: number): number {
		if (this.dragging) {
			if (now - this.lastPushAt > JELLY.WHEEL_RELEASE_IDLE_MS) {
				this.startRelease(now);
				this.lastFrameAt = now;
				return this.d;
			}
			return this.displacement;
		}
		if (!this.releasing) return 0;
		const dt = this.lastFrameAt ? (now - this.lastFrameAt) / 1000 : JELLY.MAX_FRAME_DT_MS / 1000;
		const step = stepSpring(this.d, this.v, dt);
		this.d = step.d;
		this.v = step.v;
		this.lastFrameAt = now;
		if (step.settled) {
			this.releasing = false;
			this.excess = 0;
		}
		return this.d;
	}

	/** Drop everything back to rest (pager navigated, element remounted). */
	reset(): void {
		this.excess = 0;
		this.dragging = false;
		this.releasing = false;
		this.d = 0;
		this.v = 0;
	}
}

/**
 * The DOM glue as a Svelte action. Listens on the scroller (wheel,
 * touch), resolves the overscrolled edge with the shared scroll
 * helpers, and paints the transform on the content wrapper (the
 * scroller's first element child) so the scrollbar stays still.
 * Passive listeners only - native scroll behavior is never hijacked.
 */
export function attachJellyScroll(node: HTMLElement): { destroy: () => void } {
	if (typeof window === 'undefined' || prefersReducedMotion()) {
		return { destroy: () => {} };
	}

	const nav = navigator as Navigator & { deviceMemory?: number };
	const cap = resolveJellyCap(
		node.clientHeight,
		typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
		typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
	);
	const controller = new JellyController(cap);
	const content = (): HTMLElement => (node.firstElementChild as HTMLElement) ?? node;
	let rafId = 0;
	let loopRunning = false;

	// Keep native overscroll chaining off the section so the jelly is
	// the only give past the edge (same boundary language as the
	// changelog well). Restored on destroy.
	const previousOverscroll = node.style.overscrollBehaviorY;
	node.style.overscrollBehaviorY = 'contain';

	function paint(displacement: number): void {
		const el = content();
		if (Math.abs(displacement) < 0.01) {
			el.style.transform = '';
			el.style.willChange = '';
			return;
		}
		el.style.willChange = 'transform';
		el.style.transform = `translate3d(0, ${displacement.toFixed(2)}px, 0)`;
	}

	function tick(now: number): void {
		rafId = 0;
		const displacement = controller.frame(now);
		paint(displacement);
		if (controller.active) startLoop();
		else loopRunning = false;
	}

	function startLoop(): void {
		if (loopRunning && rafId) return;
		loopRunning = true;
		rafId = requestAnimationFrame(tick);
	}

	function overscrollEdge(deltaY: number): JellyEdge | null {
		// A floating window owns the gesture: the page behind it stays
		// still - no native scroll (the scroll lock) and no elastic give.
		if (node.dataset.scrollLocked === 'true') return null;
		const state = getVerticalScrollState(node);
		// A native elastic overscroll in flight owns the visual already.
		if (node.scrollTop < -1 || node.scrollTop > state.maxY + 1) return null;
		if (deltaY < 0 && !state.canScrollUp) return 'top';
		if (deltaY > 0 && !state.canScrollDown) return 'bottom';
		return null;
	}

	function onWheel(e: WheelEvent): void {
		const { deltaY } = e;
		if (deltaY === 0) return;
		const edge = overscrollEdge(deltaY);
		if (!edge) {
			// Scrolling inward: let the spring take it home.
			if (controller.active) {
				controller.release(e.timeStamp);
				startLoop();
			}
			return;
		}
		controller.push(Math.min(Math.abs(deltaY), JELLY.MAX_EVENT_PX), e.timeStamp, edge);
		startLoop();
	}

	let touchLastY: number | null = null;
	let touchLastX = 0;
	let touchTotalDx = 0;
	let touchTotalDy = 0;
	let touchEdge: JellyEdge | null = null;

	function onTouchStart(e: TouchEvent): void {
		const touch = e.touches[0];
		if (!touch) return;
		touchLastY = touch.clientY;
		touchLastX = touch.clientX;
		touchTotalDx = 0;
		touchTotalDy = 0;
		touchEdge = null;
	}

	function onTouchMove(e: TouchEvent): void {
		if (touchLastY === null) return;
		const touch = e.touches[0];
		if (!touch) return;
		const dy = touch.clientY - touchLastY;
		const dx = touch.clientX - touchLastX;
		touchLastY = touch.clientY;
		touchLastX = touch.clientX;
		// Horizontal intent wins: the pager owns sideways drags.
		touchTotalDx += Math.abs(dx);
		touchTotalDy += Math.abs(dy);
		if (touchTotalDx > touchTotalDy * 1.2) {
			touchEdge = null;
			if (controller.active) {
				controller.release(e.timeStamp);
				startLoop();
			}
			return;
		}
		if (dy === 0) return;
		const edge = overscrollEdge(dy);
		if (!edge) {
			touchEdge = null;
			if (controller.active) {
				controller.release(e.timeStamp);
				startLoop();
			}
			return;
		}
		if (touchEdge && touchEdge !== edge) {
			controller.release(e.timeStamp);
		}
		touchEdge = edge;
		controller.push(Math.min(Math.abs(dy), JELLY.MAX_EVENT_PX), e.timeStamp, edge);
		startLoop();
	}

	function onTouchEnd(e: TouchEvent): void {
		if (controller.active && touchEdge) {
			controller.release(e.timeStamp);
			startLoop();
		}
		touchLastY = null;
		touchEdge = null;
	}

	function onScroll(): void {
		// Any native scroll means the user is inside the range again;
		// the elastic give must yield immediately.
		if (controller.active) {
			controller.release(performance.now());
			startLoop();
		}
	}

	function onDestroy(): void {
		if (rafId) cancelAnimationFrame(rafId);
		loopRunning = false;
		controller.reset();
		paint(0);
		node.style.overscrollBehaviorY = previousOverscroll;
		node.removeEventListener('wheel', onWheel, { passive: true } as EventListenerOptions);
		node.removeEventListener('touchstart', onTouchStart, { passive: true } as EventListenerOptions);
		node.removeEventListener('touchmove', onTouchMove, { passive: true } as EventListenerOptions);
		node.removeEventListener('touchend', onTouchEnd, { passive: true } as EventListenerOptions);
		node.removeEventListener('touchcancel', onTouchEnd, { passive: true } as EventListenerOptions);
		node.removeEventListener('scroll', onScroll);
	}

	node.addEventListener('wheel', onWheel, { passive: true });
	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: true });
	node.addEventListener('touchend', onTouchEnd, { passive: true });
	node.addEventListener('touchcancel', onTouchEnd, { passive: true });
	node.addEventListener('scroll', onScroll, { passive: true });

	return { destroy: onDestroy };
}
