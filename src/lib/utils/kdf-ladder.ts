// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The Device-Tier Argon2id Ladder (night-frontier-Z4).
 *
 * One fixed derivation cost taxes the extremes in opposite directions:
 * a 64 MiB / 3-iteration derive is seconds of burn on a low-end phone
 * and milliseconds on a desktop. The ladder scales the cost from the
 * capability engine that already exists (getPerformanceTier:
 * hardwareConcurrency + deviceMemory + connection) while holding one
 * hard line — production derivations are NEVER below the OWASP
 * Argon2id floor (m = 19456 KiB, t = 2, p = 1).
 *
 * The cross-device contract that makes tier variance safe: the
 * derivation parameters ride the encrypted envelope (`kdfParams` — the
 * field already existed as decoration; night-frontier-Z4 makes decrypt
 * HONOR it). A vault sealed on a low-tier phone opens on a high-tier
 * desktop and vice versa, because the reader derives with the writer's
 * recorded parameters, not its own. Envelopes without parameters (the
 * legacy pre-ladder files) derive with the fixed legacy defaults those
 * files were actually written with.
 *
 * The at-rest session anchors on the stored verifier's parameters, so
 * a tier change between sessions never re-derives a different key from
 * the sealed ledger.
 *
 * Honest limits: the tier is a heuristic (hardwareConcurrency and
 * deviceMemory are self-reported); the floor is a policy, not physics —
 * below-floor parameters can still be READ (within caps) because
 * refusing legacy or foreign files buys nothing once the passphrase
 * gates them; test-mode parameters stay below the floor by design and
 * are excluded from every production path.
 */

import type { Argon2Options } from './kdf-worker-client';
import { getPerformanceTier } from './animation-config';

/** The OWASP Argon2id floor: 19 MiB, 2 iterations, parallelism 1. */
export const OWASP_FLOOR = { m: 19456, t: 2, p: 1 } as const;

/**
 * Read-side caps — parameters beyond these are refused (fail-closed).
 * Sized for burn, not for reach (night-depth-hardening-5): the highest
 * rung this app ever writes is 64 MiB / t 3 / p 1, so the caps keep a 4x
 * memory headroom while bounding a hostile envelope to a few seconds per
 * passphrase attempt — the previous 1 GiB / t 64 ceiling let one crafted
 * file burn the KDF worker to an OOM inside the tab.
 */
export const KDF_CAPS = { m: 262144, t: 8, p: 4 } as const;

/** The production ladder, high to low. Every rung sits at or above the floor. */
export const KDF_LADDER: Record<'high' | 'medium' | 'low', { m: number; t: number; p: number }> = {
	high: { m: 64 * 1024, t: 3, p: 1 },
	medium: { m: 32 * 1024, t: 3, p: 1 },
	low: { m: OWASP_FLOOR.m, t: OWASP_FLOOR.t, p: OWASP_FLOOR.p }
};

/** Test-mode derivation: CI-friendly, never leaves the test environment. */
export const TEST_KDF_OPTIONS: Argon2Options = { m: 1024, t: 1, p: 1, dkLen: 32 };

/** The pre-ladder fixed defaults — the parameters legacy envelopes were written with. */
export const LEGACY_KDF_OPTIONS: Argon2Options = { m: 64 * 1024, t: 3, p: 1, dkLen: 32 };

const DK_LEN = 32;

function clampToFloor(params: { m: number; t: number; p: number }): {
	m: number;
	t: number;
	p: number;
} {
	return {
		m: Math.max(params.m, OWASP_FLOOR.m),
		t: Math.max(params.t, OWASP_FLOOR.t),
		p: Math.max(params.p, OWASP_FLOOR.p)
	};
}

/** Pure mapping: a tier to its clamped rung (the floor always holds). */
export function resolveKdfOptionsForTier(tier: 'high' | 'medium' | 'low'): Argon2Options {
	return { ...clampToFloor(KDF_LADDER[tier]), dkLen: DK_LEN };
}

let overrideForTesting: Argon2Options | null = null;

/** @internal Test-only: pin the ladder to an explicit rung. */
export function _setKdfLadderOverrideForTesting(options: Argon2Options | null): void {
	overrideForTesting = options;
}

/**
 * The derivation options for THIS device right now: the performance
 * tier picks the ladder rung, the floor clamps the result. Test mode
 * stays on the CI-friendly parameters.
 */
export function getKdfOptions(): Argon2Options {
	if (overrideForTesting) return overrideForTesting;
	if (import.meta.env?.MODE === 'test') return TEST_KDF_OPTIONS;
	return resolveKdfOptionsForTier(getPerformanceTier());
}

/** The shape the envelope records: hash-wasm style parameter naming. */
export interface EnvelopeKdfParams {
	type: number;
	mem: number;
	time: number;
	parallelism: number;
	hashLen: number;
}

/**
 * Validate envelope-recorded derivation parameters before using them to
 * derive (fail-closed): the right hash-wasm type, the 256-bit output the
 * AES-256 key needs, integers within the read-side caps. This is a
 * structural gate, not a floor gate — below-floor parameters still open
 * their own files (the passphrase is the gate), absurd parameters open
 * nothing.
 */
export function validateEnvelopeKdfParams(params: unknown): params is EnvelopeKdfParams {
	if (!params || typeof params !== 'object') return false;
	const p = params as Record<string, unknown>;
	if (p.type !== 2) return false;
	if (p.hashLen !== DK_LEN) return false;
	const mem = p.mem;
	const time = p.time;
	const parallelism = p.parallelism;
	if (typeof mem !== 'number' || !Number.isInteger(mem) || mem < 1 || mem > KDF_CAPS.m)
		return false;
	if (typeof time !== 'number' || !Number.isInteger(time) || time < 1 || time > KDF_CAPS.t)
		return false;
	if (
		typeof parallelism !== 'number' ||
		!Number.isInteger(parallelism) ||
		parallelism < 1 ||
		parallelism > KDF_CAPS.p
	)
		return false;
	return true;
}

/** Envelope parameters → Argon2Options (already validated). */
export function envelopeParamsToOptions(params: EnvelopeKdfParams): Argon2Options {
	return { m: params.mem, t: params.time, p: params.parallelism, dkLen: params.hashLen };
}
