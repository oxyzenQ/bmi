// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * DNA helix core pins (night-ux-orion-2) - the pure half of the
 * loading lane, held byte for byte.
 *
 * The frame table is the pin, not a computation: the battery derives
 * the reference table from the bare ten-frame sweep and asserts the
 * shipped table matches it exactly, the way the reference CLI's
 * surface pins read the same bytes the binary ships. The slot clock's
 * lazy threshold, the deterministic repeat-never-skip law, the wrap,
 * and the broken-clock silence are each pinned on the boundary.
 */

import { describe, it, expect } from 'vitest';
import { HELIX, LAZY_MS, FRAME_PERIOD_MS, helixSlot, helixFrame, helixFrameAt } from '../dna-helix';

/** The bare ten-frame braille dot walk, clockwise - the strand's own ladder. */
const SWEEP = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

describe('DNA helix frame table', () => {
	it('is ten counter-phase strands', () => {
		expect(HELIX).toHaveLength(10);
	});

	it('matches the reference table byte for byte', () => {
		expect([...HELIX]).toEqual(['⠋⠏', '⠙⠇', '⠹⠧', '⠸⠦', '⠼⠴', '⠴⠼', '⠦⠸', '⠧⠹', '⠇⠙', '⠏⠋']);
	});

	it('pairs the forward sweep with the backward sweep at every frame', () => {
		for (let i = 0; i < 10; i++) {
			const expected = SWEEP[i] + SWEEP[9 - i];
			expect(HELIX[i], `frame ${i}: forward x backward strand`).toBe(expected);
		}
	});

	it('never lets the two strands collide', () => {
		for (let i = 0; i < 10; i++) {
			const cells = Array.from(HELIX[i]);
			expect(cells, `frame ${i}: two strands, one cell each`).toHaveLength(2);
			expect(cells[0], `frame ${i}: the strands never collide`).not.toBe(cells[1]);
		}
	});

	it('is width-stable: every frame is exactly two braille cells', () => {
		for (const frame of HELIX) {
			expect(Array.from(frame)).toHaveLength(2);
			for (const cell of Array.from(frame)) {
				const code = cell.codePointAt(0) as number;
				expect(code, 'a braille cell stays in the braille block').toBeGreaterThanOrEqual(0x2800);
				expect(code, 'a braille cell stays in the braille block').toBeLessThanOrEqual(0x28ff);
			}
		}
	});

	it('exposes the lazy threshold and frame period constants the law pins', () => {
		expect(LAZY_MS).toBe(100);
		expect(FRAME_PERIOD_MS).toBe(100);
	});
});

describe('DNA helix slot clock', () => {
	it('draws nothing below the lazy threshold', () => {
		expect(helixSlot(0)).toBeNull();
		expect(helixSlot(50)).toBeNull();
		expect(helixSlot(99.9)).toBeNull();
	});

	it('names slot zero exactly at the lazy threshold', () => {
		expect(helixSlot(LAZY_MS)).toBe(0);
		expect(helixSlot(100.1)).toBe(0);
		expect(helixSlot(199.9)).toBe(0);
	});

	it('advances one slot per frame period', () => {
		expect(helixSlot(200)).toBe(1);
		expect(helixSlot(299.9)).toBe(1);
		expect(helixSlot(1000)).toBe(9);
		expect(helixSlot(1100)).toBe(10);
	});

	it('is a pure function of elapsed time - late polls repeat, never skip', () => {
		// A poll that lands at any instant inside a period names that
		// period's slot: the same elapsed reading always yields the
		// same slot, no internal state, no sequence drift.
		for (let ms = 0; ms <= 2050; ms += 7) {
			const slot = helixSlot(ms);
			if (slot === null) continue;
			const boundarySlot = Math.floor((ms - LAZY_MS) / FRAME_PERIOD_MS);
			expect(slot).toBe(boundarySlot);
		}
	});

	it('silences a broken clock instead of drawing garbage', () => {
		expect(helixSlot(Number.NaN)).toBeNull();
		expect(helixSlot(Number.POSITIVE_INFINITY)).toBeNull();
		expect(helixSlot(Number.NEGATIVE_INFINITY)).toBeNull();
	});
});

describe('DNA helix frame wrap', () => {
	it('wraps after the tenth frame', () => {
		expect(helixFrame(0)).toBe(HELIX[0]);
		expect(helixFrame(9)).toBe(HELIX[9]);
		expect(helixFrame(10)).toBe(HELIX[0]);
		expect(helixFrame(11)).toBe(HELIX[1]);
		expect(helixFrame(107)).toBe(HELIX[7]);
	});

	it('normalizes a negative slot instead of escaping the table', () => {
		expect(helixFrame(-1)).toBe(HELIX[9]);
		expect(helixFrame(-10)).toBe(HELIX[0]);
	});

	it('is deterministic: the same slot always returns the same bytes', () => {
		for (let slot = 0; slot < 25; slot++) {
			expect(helixFrame(slot)).toBe(helixFrame(slot));
			expect(helixFrame(slot)).toBe(helixFrame(slot % 10));
		}
	});
});

describe('DNA helix frame at an elapsed time', () => {
	it('holds silence below the lazy threshold', () => {
		expect(helixFrameAt(0)).toBeNull();
		expect(helixFrameAt(99)).toBeNull();
	});

	it('renders the first frame when the threshold crosses', () => {
		expect(helixFrameAt(LAZY_MS)).toBe(HELIX[0]);
	});

	it('composes the slot clock and the wrapped table', () => {
		expect(helixFrameAt(200)).toBe(HELIX[1]);
		expect(helixFrameAt(1050)).toBe(HELIX[9]);
		expect(helixFrameAt(1100)).toBe(HELIX[0]);
	});
});
