// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

//
// The floating-window scroll lock suite (night-cafe-mclaren-2).
//
// One law: while a floating window is open the page behind it does
// not move. The suite pins the mechanics - the scroller's overflow
// hides on first acquire and restores on the last release, nested
// windows stack safely, a double release is inert, and the lock
// marker the jelly surface reads is set and cleared with the lock.
//

import { describe, it, expect, beforeEach } from 'vitest';
import { acquireScrollLock } from '../scroll-lock';

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {}
}

function makeScroller(): HTMLElement {
	const el = document.createElement('section');
	el.setAttribute('data-pager-scroll', 'true');
	el.style.overflowY = 'auto';
	document.body.appendChild(el);
	return el;
}

describe('acquireScrollLock (the floating-window law)', () => {
	beforeEach(() => {
		document.body.textContent = '';
	});

	it('hides the scroller overflow on first acquire and restores on release', () => {
		const el = makeScroller();
		const release = acquireScrollLock();
		expect(el.style.overflowY).toBe('hidden');
		expect(el.dataset.scrollLocked).toBe('true');
		release();
		expect(el.style.overflowY).toBe('auto');
		expect(el.dataset.scrollLocked).toBeUndefined();
	});

	it('stacks nested windows: the scroller unlocks only at the last release', () => {
		const el = makeScroller();
		const releaseA = acquireScrollLock();
		const releaseB = acquireScrollLock();
		expect(el.style.overflowY).toBe('hidden');
		releaseA();
		expect(el.style.overflowY).toBe('hidden');
		releaseB();
		expect(el.style.overflowY).toBe('auto');
	});

	it('a release is inert when called twice', () => {
		const el = makeScroller();
		const release = acquireScrollLock();
		release();
		release();
		expect(el.style.overflowY).toBe('auto');
	});

	it('carries the marker the jelly reads, only while locked', () => {
		const el = makeScroller();
		const release = acquireScrollLock();
		expect(el.dataset.scrollLocked).toBe('true');
		release();
		expect('scrollLocked' in el.dataset).toBe(false);
	});

	it('no-ops with no scroller mounted and still balances', () => {
		document.body.textContent = '';
		const release = acquireScrollLock();
		expect(() => release()).not.toThrow();
	});
});
