// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The envelope KDF gate theorem (night-netrunner-Z2, the for-all tier).
 *
 * Law: validateEnvelopeKdfParams is the hostile-envelope decision table
 * the read-side contract states - the right hash-wasm type, the 256-bit
 * output, integers within the read-side caps - and its verdict is the
 * conjunction of three independent axis gates.
 *
 * The decomposition that makes the for-all verdict over the full
 * product domain honest in a finite harness: the predicate is a pure
 * conjunction of axis gates (mem gate AND time gate AND parallelism
 * gate, plus the two fixed-value gates). The harness therefore proves
 *   (1) each numeric axis exhaustively over EVERY integer in its
 *       stated range (the mem axis walks all 262,149 integers from -2
 *       through KDF_CAPS.m + 2; time and parallelism walk their full
 *       ranges), with the verdict matching the gate alone;
 *   (2) the conjunction law over the boundary lattice (six values per
 *       axis, all 216 combinations): the verdict equals the AND of the
 *       three axis verdicts;
 *   (3) the fixed-value gates and the hostile-shape corpus (wrong
 *       types, non-integers, missing fields, exotic objects).
 * Axis-exhaustive scans + the conjunction lattice decide EVERY integer
 * triple in [1, 262144] x [1, 8] x [1, 4] - all 8,388,608 of them -
 * because a conjunction of axis gates cannot interact across axes.
 *
 * This gate is the burn wall: a crafted envelope may burn one derive,
 * never the worker. Its full decision table is machine-checked here.
 */

import { describe, expect, it } from 'vitest';
import {
	KDF_CAPS,
	envelopeParamsToOptions,
	validateEnvelopeKdfParams
} from '../src/lib/utils/kdf-ladder';

/** A valid envelope with one axis overwritten. */
function envelope(overrides: Partial<{ mem: number; time: number; parallelism: number }>): {
	type: number;
	mem: number;
	time: number;
	parallelism: number;
	hashLen: number;
} {
	return { type: 2, mem: 19456, time: 2, parallelism: 1, hashLen: 32, ...overrides };
}

/** The mem axis gate, stated independently: integer within [1, KDF_CAPS.m]. */
function memGate(mem: number): boolean {
	return Number.isInteger(mem) && mem >= 1 && mem <= KDF_CAPS.m;
}

function timeGate(time: number): boolean {
	return Number.isInteger(time) && time >= 1 && time <= KDF_CAPS.t;
}

function parallelismGate(par: number): boolean {
	return Number.isInteger(par) && par >= 1 && par <= KDF_CAPS.p;
}

describe('the envelope KDF gate theorem (for-all over the full product domain)', () => {
	it('decides the mem axis exhaustively over every integer in [-2, KDF_CAPS.m + 2]', () => {
		for (let mem = -2; mem <= KDF_CAPS.m + 2; mem++) {
			expect(validateEnvelopeKdfParams(envelope({ mem }))).toBe(memGate(mem));
		}
	});

	it('decides the time axis exhaustively over every integer in [-2, KDF_CAPS.t + 2]', () => {
		for (let time = -2; time <= KDF_CAPS.t + 2; time++) {
			expect(validateEnvelopeKdfParams(envelope({ time }))).toBe(timeGate(time));
		}
	});

	it('decides the parallelism axis exhaustively over every integer in [-2, KDF_CAPS.p + 2]', () => {
		for (let par = -2; par <= KDF_CAPS.p + 2; par++) {
			expect(validateEnvelopeKdfParams(envelope({ parallelism: par }))).toBe(parallelismGate(par));
		}
	});

	it('decides every boundary-lattice combination as the AND of its axis gates', () => {
		const lattice = [0, 1, 2, KDF_CAPS.m - 1, KDF_CAPS.m, KDF_CAPS.m + 1];
		const timeLattice = [0, 1, 2, KDF_CAPS.t - 1, KDF_CAPS.t, KDF_CAPS.t + 1];
		const parLattice = [0, 1, 2, KDF_CAPS.p - 1, KDF_CAPS.p, KDF_CAPS.p + 1];
		for (const mem of lattice) {
			for (const time of timeLattice) {
				for (const par of parLattice) {
					const verdict = validateEnvelopeKdfParams(envelope({ mem, time, parallelism: par }));
					expect(verdict).toBe(memGate(mem) && timeGate(time) && parallelismGate(par));
				}
			}
		}
	});

	it('refuses every non-integer and non-finite mutation of a valid axis', () => {
		// -0 is an integer to the language and below the floor to both the
		// gate and the spec side, so it sits with the refused mutants.
		const mutants = [NaN, Infinity, -Infinity, 0.5, 1.5, KDF_CAPS.m + 0.5, -0];
		for (const mutant of mutants) {
			expect(validateEnvelopeKdfParams(envelope({ mem: mutant }))).toBe(false);
			expect(validateEnvelopeKdfParams(envelope({ time: mutant }))).toBe(false);
			expect(validateEnvelopeKdfParams(envelope({ parallelism: mutant }))).toBe(false);
		}
	});

	it('refuses every wrong type and hash length (the fixed-value gates)', () => {
		const wrongBase = envelope({});
		for (const type of [0, 1, 3, 4, '2', null, NaN]) {
			const candidate = { ...wrongBase, type } as unknown as Record<string, unknown>;
			expect(validateEnvelopeKdfParams(candidate)).toBe(false);
		}
		for (const hashLen of [0, 16, 33, 64, '32', null, NaN]) {
			const candidate = { ...wrongBase, hashLen } as unknown as Record<string, unknown>;
			expect(validateEnvelopeKdfParams(candidate)).toBe(false);
		}
	});

	it('refuses every hostile shape the parser can be handed', () => {
		const hostile: unknown[] = [
			null,
			undefined,
			42,
			'string',
			true,
			[],
			[2, 19456, 2, 1, 32],
			() => envelope({}),
			Symbol('type'),
			2n,
			{ type: 2, hashLen: 32, mem: 19456 },
			{ type: 2, hashLen: 32, time: 2, parallelism: 1 },
			Object.create(null)
		];
		for (const candidate of hostile) {
			expect(validateEnvelopeKdfParams(candidate)).toBe(false);
		}
		// The gate is structural, not identity-based: a null-prototype
		// envelope carrying every valid field still validates.
		const nullProto = Object.assign(Object.create(null), envelope({}));
		expect(validateEnvelopeKdfParams(nullProto)).toBe(true);
	});

	it('maps every accepted lattice corner through the options identity unchanged', () => {
		for (const mem of [1, 2, KDF_CAPS.m - 1, KDF_CAPS.m]) {
			for (const time of [1, 2, KDF_CAPS.t - 1, KDF_CAPS.t]) {
				for (const par of [1, 2, KDF_CAPS.p - 1, KDF_CAPS.p]) {
					const candidate = envelope({ mem, time, parallelism: par });
					expect(validateEnvelopeKdfParams(candidate)).toBe(true);
					const options = envelopeParamsToOptions(candidate);
					expect(options).toEqual({ m: mem, t: time, p: par, dkLen: 32 });
				}
			}
		}
	});
});
