// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * DNA helix face pins (night-ux-orion-2) - the thread half of the
 * loading lane, held against a controlled clock.
 *
 * The clock is the test's, not the machine's: performance.now is
 * pinned to a controllable reading so every law the reference lane
 * keeps is asserted on an exact elapsed time - silence below the lazy
 * threshold, the first frame exactly at it, the deterministic
 * repeat-never-skip walk, the wrap after the tenth frame, the one
 * dirty node per frame, and the poll's teardown on unmount. The waits
 * are real timer slices (30 ms against the 25 ms poll), so the pins
 * exercise the real interval cadence, never a mock of it.
 */

import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DnaHelix from '$lib/components/DnaHelix.svelte';
import { HELIX } from '$lib/utils/dna-helix';

/** A controllable clock: the component reads whatever the test pins. */
let now = 0;

beforeEach(() => {
	// Each test mounts at time zero - the clock never leaks across tests.
	now = 0;
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** Pin the clock to `ms` and wait one real slice past the poll cadence. */
async function clockAt(ms: number): Promise<void> {
	now = ms;
	await new Promise((resolve) => setTimeout(resolve, 30));
}

describe('DnaHelix face', () => {
	it('draws nothing below the lazy threshold', async () => {
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const { container } = render(DnaHelix, { props: { label: 'Loading data' } });

		await clockAt(50);
		const frame = container.querySelector('.dna-helix__frame');
		expect(frame?.textContent).toBe('');
	});

	it('renders the first frame exactly when the threshold crosses', async () => {
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const { container } = render(DnaHelix, { props: { label: 'Loading data' } });

		await clockAt(100);
		expect(container.querySelector('.dna-helix__frame')?.textContent).toBe(HELIX[0]);
	});

	it('walks the table one frame per period, repeating never skipping', async () => {
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const { container } = render(DnaHelix, { props: { label: 'Loading data' } });

		// Four consecutive periods: slots 0, 1, 2, 3 - the walk stays
		// deterministic even though the poll lands at arbitrary
		// instants inside each period.
		const expected = [HELIX[0], HELIX[1], HELIX[2], HELIX[3]];
		for (let i = 0; i < expected.length; i++) {
			await clockAt(100 + i * 100 + 40);
			expect(container.querySelector('.dna-helix__frame')?.textContent).toBe(expected[i]);
		}
	});

	it('wraps after the tenth frame', async () => {
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const { container } = render(DnaHelix, { props: { label: 'Loading data' } });

		await clockAt(100 + 10 * 100);
		expect(container.querySelector('.dna-helix__frame')?.textContent).toBe(HELIX[0]);
	});

	it('touches exactly one frame node across updates - no DOM churn', async () => {
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const { container } = render(DnaHelix, { props: { label: 'Loading data' } });
		const frameNode = container.querySelector('.dna-helix__frame');

		for (let i = 1; i <= 4; i++) {
			await clockAt(100 + i * 100);
		}

		expect(container.querySelectorAll('.dna-helix__frame')).toHaveLength(1);
		expect(container.querySelector('.dna-helix__frame')).toBe(frameNode);
	});

	it('exposes the busy status and the narrated label, never raw braille', async () => {
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const { container } = render(DnaHelix, { props: { label: 'Decrypting history' } });

		await clockAt(120);

		const status = screen.getByRole('status');
		expect(status).toHaveAttribute('aria-busy', 'true');
		expect(screen.getByText('Decrypting history')).toHaveClass('sr-only');
		expect(container.querySelector('.dna-helix__frame')).toHaveAttribute('aria-hidden', 'true');
	});

	it('scales with the size prop and hides the label when empty', async () => {
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const { container } = render(DnaHelix, { props: { size: 36, label: '' } });

		await clockAt(120);

		const status = screen.getByRole('status');
		expect(status).toHaveStyle({ 'font-size': '36px' });
		expect(container.querySelector('.sr-only')).toBeNull();
	});

	it('stops the poll on unmount - the lane never leaks a timer', async () => {
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const clearSpy = vi.spyOn(window, 'clearInterval');
		const { unmount } = render(DnaHelix, { props: { label: 'Loading data' } });

		await clockAt(120);
		const callsBefore = clearSpy.mock.calls.length;
		unmount();

		expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBefore);
	});
});
