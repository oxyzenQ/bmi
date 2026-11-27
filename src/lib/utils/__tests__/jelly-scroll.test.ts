// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

//
// Jelly scroll physics suite (night-cafe-10).
//
// The rubber-band resistance and the release spring are pinned as pure
// math: the pull flattens toward the cap, the release overshoots the
// rest point and swings back before settling, and the controller keeps
// edge/sign consistency across pushes. No DOM, no timers - every frame
// is driven by an explicit timestamp.

import { describe, it, expect } from 'vitest';
import { JELLY, JellyController, rubberBandDisplacement, stepSpring } from '../jelly-scroll';

const CAP = 60;
const DT = 1 / 60;

describe('rubber-band resistance', () => {
	it('starts at zero and grows monotonically', () => {
		expect(rubberBandDisplacement(0, CAP)).toBe(0);
		let previous = 0;
		for (let x = 1; x <= 600; x += 10) {
			const d = rubberBandDisplacement(x, CAP);
			expect(d).toBeGreaterThan(previous);
			previous = d;
		}
	});

	it('never passes the cap, however hard the pull', () => {
		expect(rubberBandDisplacement(CAP, CAP)).toBeLessThan(CAP);
		expect(rubberBandDisplacement(CAP * 10, CAP)).toBeLessThan(CAP);
		expect(rubberBandDisplacement(CAP * 100000, CAP)).toBeGreaterThan(CAP - 0.01);
	});

	it('resists harder the further the pull already is', () => {
		// The first 30px of excess moves the pose more than the next 30px.
		const early = rubberBandDisplacement(30, CAP);
		const late = rubberBandDisplacement(60, CAP) - early;
		expect(early).toBeGreaterThan(late);
	});
});

describe('release spring', () => {
	it('overshoots the rest point and swings back (the kenyal settle)', () => {
		let d = CAP;
		let v = 0;
		let sawOvershoot = false;
		for (let i = 0; i < 300; i += 1) {
			const step = stepSpring(d, v, DT);
			d = step.d;
			v = step.v;
			if (d < -1) sawOvershoot = true;
			if (step.settled) break;
		}
		expect(sawOvershoot).toBe(true);
		expect(d).toBe(0);
	});

	it('settles from any reasonable pose', () => {
		for (const start of [CAP, -CAP, CAP / 2]) {
			let d = start;
			let v = start;
			let settled = false;
			for (let i = 0; i < 600; i += 1) {
				const step = stepSpring(d, v, DT);
				d = step.d;
				v = step.v;
				if (step.settled) {
					settled = true;
					break;
				}
			}
			expect(settled).toBe(true);
			expect(d).toBe(0);
		}
	});

	it('clamps a stalled frame instead of exploding', () => {
		const step = stepSpring(CAP, 0, 5); // 5 seconds in one step
		expect(Number.isFinite(step.d)).toBe(true);
		expect(Number.isFinite(step.v)).toBe(true);
	});
});

describe('jelly controller', () => {
	it('rides the rubber band while dragged and bounds the pull', () => {
		const c = new JellyController(CAP);
		let now = 0;
		let peak = 0;
		for (let i = 0; i < 60; i += 1) {
			now += 16;
			const d = c.push(JELLY.MAX_EVENT_PX, now, 'top');
			peak = Math.max(peak, d);
			expect(d).toBeGreaterThan(0);
			expect(d).toBeLessThan(CAP);
		}
		expect(peak).toBeGreaterThan(10);
		expect(c.active).toBe(true);
	});

	it('signs the displacement by edge: top pulls down, bottom pulls up', () => {
		const top = new JellyController(CAP);
		const bottom = new JellyController(CAP);
		top.push(40, 0, 'top');
		bottom.push(40, 0, 'bottom');
		expect(top.displacement).toBeGreaterThan(0);
		expect(bottom.displacement).toBeLessThan(0);
	});

	it('releases into an underdamped settle with a visible overshoot', () => {
		const c = new JellyController(CAP);
		let now = 0;
		for (let i = 0; i < 10; i += 1) {
			now += 16;
			c.push(24, now, 'top');
		}
		c.release(now);
		let sawOvershoot = false;
		let frames = 0;
		while (c.active && frames < 600) {
			now += 16;
			const d = c.frame(now);
			if (d < -1) sawOvershoot = true;
			frames += 1;
		}
		expect(sawOvershoot).toBe(true);
		expect(c.active).toBe(false);
		expect(c.frame(now + 16)).toBe(0);
	});

	it('auto-releases a stalled wheel drag (idle hand-off)', () => {
		const c = new JellyController(CAP);
		c.push(40, 0, 'top');
		expect(c.active).toBe(true);
		const idleAt = JELLY.WHEEL_RELEASE_IDLE_MS + 1;
		const d = c.frame(idleAt);
		// The pose is handed to the spring: still positive, coming home.
		expect(d).toBeGreaterThan(0);
		expect(c.active).toBe(true);
		let frames = 0;
		let now = idleAt;
		while (c.active && frames < 600) {
			now += 16;
			c.frame(now);
			frames += 1;
		}
		expect(c.active).toBe(false);
	});

	it('reverses the edge mid-drag: release, then a fresh opposite pull', () => {
		const c = new JellyController(CAP);
		let now = 0;
		for (let i = 0; i < 5; i += 1) {
			now += 16;
			c.push(24, now, 'top');
		}
		const afterFlip = c.push(24, (now += 16), 'bottom');
		// The opposite-edge push restarts from a smaller pose, not from
		// the full previous pull, and now reads negative (bottom edge).
		expect(afterFlip).toBeLessThan(0);
		expect(Math.abs(afterFlip)).toBeLessThan(CAP);
	});

	it('reset returns everything to rest', () => {
		const c = new JellyController(CAP);
		c.push(40, 0, 'bottom');
		c.reset();
		expect(c.active).toBe(false);
		expect(c.frame(16)).toBe(0);
		expect(c.displacement).toBe(0);
	});
});
