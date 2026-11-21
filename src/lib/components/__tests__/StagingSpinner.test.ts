// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Staging lane surface pins (night-ux-orion-2).
 *
 * The overlay's own law, held against real timers: a closed overlay
 * mounts nothing, an open one shows the helix seat with the narrated
 * label, the drawn frame is always a legal member of the reference
 * table (the draw-arm law - a slow host may show only helix frames,
 * never garbage), and the seat stays one dirty node. The exact
 * per-frame walk is pinned in the face battery against a controlled
 * clock; this surface only asserts what the real arm can show.
 */

import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import StagingSpinner from '$lib/components/StagingSpinner.svelte';
import { HELIX } from '$lib/utils/dna-helix';

/** Wait until the lane's frame text lands, polling past the lazy threshold. */
async function waitForFrame(): Promise<string> {
	let frame = '';
	await vi.waitFor(
		() => {
			frame = document.querySelector('.dna-helix__frame')?.textContent ?? '';
			expect(frame).not.toBe('');
		},
		{ timeout: 1000, interval: 25 }
	);
	return frame;
}

describe('StagingSpinner surface', () => {
	it('mounts nothing when the overlay is closed', () => {
		render(StagingSpinner, { props: { show: false } });

		expect(document.querySelector('.staging-backdrop')).toBeNull();
		expect(document.querySelector('.dna-helix__frame')).toBeNull();
	});

	it('shows the helix seat and the narrated label when open', async () => {
		render(StagingSpinner, { props: { show: true, label: 'Restoring history' } });

		const backdrop = document.querySelector('.staging-backdrop');
		expect(backdrop).not.toBeNull();
		expect(backdrop).toHaveClass('staging-visible');
		expect(screen.getByText('Restoring history')).toHaveClass('staging-text');

		const frame = await waitForFrame();
		expect(HELIX).toContain(frame as never);
		expect(document.querySelectorAll('.dna-helix__frame')).toHaveLength(1);
	});

	it('falls back to the preparing label when none is passed', async () => {
		render(StagingSpinner, { props: { show: true } });

		expect(screen.getByText('Preparing...')).toHaveClass('staging-text');
		await waitForFrame();
	});
});
