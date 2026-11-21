// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The DNA helix frame core (night-ux-orion-2) - pure tables, zero deps.
 *
 * BMI Stellar's one loading face: a silent large-data load (the
 * Argon2id encrypt/decrypt of a full history export, the staged
 * restore of ten thousand records) is indistinguishable from a hang,
 * and the abandon a frozen-looking screen invites is a bug of
 * perception, not of behavior. Every slow site narrates instead with
 * the two counter-phase braille strands - the same anti-parallel
 * streams the estate's reference CLI wants: the request out, the
 * answer back. The frame table rides the reference law byte for byte
 * (github.com/oxyzenQ/zejtron, src/output/spinner.rs): strand one
 * walks the classic ten-frame braille dot sweep forward while strand
 * two runs it backward, and the strands never collide because
 * i = 9 - i has no integer answer.
 *
 * The clock is deterministic: a frame slot is a pure function of
 * elapsed time, so a poll that lands late repeats a frame instead of
 * skipping the sequence, and the sequence wraps after the table's ten
 * frames. An operation younger than the lazy threshold has no frame
 * at all - the fast path never flashes the indicator, and nothing
 * below the threshold ever renders.
 *
 * This is a FUNCTIONAL indicator, not decoration: per the repo law in
 * src/styles/animation.css, loading indicators always animate, even
 * under prefers-reduced-motion (iOS enables that setting by default,
 * and a frozen "working" state is the exact hang this lane exists to
 * prevent). The face is slot-driven text, not CSS animation, so the
 * law holds by construction.
 */

/** The lazy threshold: an operation that lands inside 100 ms never draws. */
export const LAZY_MS = 100;

/** The frame period: ten frames per second, the sweep's smooth cadence. */
export const FRAME_PERIOD_MS = 100;

/**
 * The DNA helix: HELIX[i] pairs sweep frame i with sweep frame 9 - i -
 * strand one runs the sweep forward while strand two runs it backward,
 * the two anti-parallel streams the metaphor wants. Written out as
 * literals so the table is the pin, not a computation; the test battery
 * derives the same table from the bare sweep and holds both sides to
 * that law.
 */
export const HELIX = ['⠋⠏', '⠙⠇', '⠹⠧', '⠸⠦', '⠼⠴', '⠴⠼', '⠦⠸', '⠧⠹', '⠇⠙', '⠏⠋'] as const;

/**
 * The slot clock, pure: an operation younger than the lazy threshold
 * has no frame yet (null - nothing has ever been drawn), and an older
 * one names the slot its elapsed time pins. A broken clock (a
 * non-finite reading) draws nothing rather than garbage.
 */
export function helixSlot(elapsedMs: number): number | null {
	if (!Number.isFinite(elapsedMs) || elapsedMs < LAZY_MS) return null;
	return Math.floor((elapsedMs - LAZY_MS) / FRAME_PERIOD_MS);
}

/**
 * The frame for a slot, wrapped: slot 10 is slot 0 again, and a
 * negative slot normalizes instead of escaping the table. Deterministic
 * by construction - the same slot always returns the same bytes.
 */
export function helixFrame(slot: number): string {
	const n = HELIX.length;
	return HELIX[((slot % n) + n) % n];
}

/** The frame at an elapsed time, or null while the lazy threshold holds. */
export function helixFrameAt(elapsedMs: number): string | null {
	const slot = helixSlot(elapsedMs);
	return slot === null ? null : helixFrame(slot);
}
