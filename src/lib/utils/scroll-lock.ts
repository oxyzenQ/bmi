// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// The floating-window scroll lock. Every floating window rides one
// law: while one is open the page behind it does not move - the
// window's own well scrolls, the app's scroller stays still. The
// shell (ModalShell) wires it for its dialogs; DebugPanel wires it
// directly; the jelly surface reads the marker so its elastic give
// stays inert behind the window too.
//
// Nesting-safe: each acquire returns its own release, and the
// scroller only unlocks when the last window lets go. SSR-safe: the
// calls no-op without a document.

let lockCount = 0;
let savedOverflowY = '';

function scrollerEl(): HTMLElement | null {
	if (typeof document === 'undefined') return null;
	return document.querySelector<HTMLElement>('[data-pager-scroll="true"]');
}

function applyLock(): void {
	const el = scrollerEl();
	if (!el) return;
	savedOverflowY = el.style.overflowY;
	el.style.overflowY = 'hidden';
	// The jelly reads this marker per gesture: while a window is open,
	// overscroll touches behind it release instead of displacing the
	// frozen page.
	el.dataset.scrollLocked = 'true';
}

function releaseLock(): void {
	const el = scrollerEl();
	if (el) {
		el.style.overflowY = savedOverflowY;
		delete el.dataset.scrollLocked;
	}
	savedOverflowY = '';
}

/**
 * Lock the app scroller while a floating window is open. Returns the
 * release function - call it exactly once when the window closes (a
 * Svelte effect cleanup is the natural home). Idempotent per window:
 * nested windows stack, the scroller unlocks only at the last release.
 */
export function acquireScrollLock(): () => void {
	lockCount += 1;
	if (lockCount === 1) applyLock();
	let released = false;
	return () => {
		if (released) return;
		released = true;
		lockCount = Math.max(0, lockCount - 1);
		if (lockCount === 0) releaseLock();
	};
}
