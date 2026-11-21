// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Crypto modal loading lane surface pins (night-ux-orion-2).
 *
 * The lane that narrates the Argon2id encrypt/decrypt of a full
 * history export: the retired progress bar is gone, the helix seat is
 * claimed, the drawn frame is always a legal member of the reference
 * table, and the seat stays one dirty node - the draw-arm law against
 * real timers, the same surface the staging lane holds.
 */

import { render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import EncryptionProgress from '$lib/components/encryption/EncryptionProgress.svelte';
import { HELIX } from '$lib/utils/dna-helix';

describe('EncryptionProgress surface', () => {
	it('claims the helix seat, never the retired progress bar', async () => {
		render(EncryptionProgress);

		expect(document.querySelector('.encrypt-progress-wrap')).not.toBeNull();
		expect(document.querySelector('.bmi-progress')).toBeNull();

		await vi.waitFor(
			() => {
				const frame = document.querySelector('.dna-helix__frame')?.textContent ?? '';
				expect(frame).not.toBe('');
				expect(HELIX).toContain(frame as never);
			},
			{ timeout: 1000, interval: 25 }
		);
		expect(document.querySelectorAll('.dna-helix__frame')).toHaveLength(1);
	});
});
