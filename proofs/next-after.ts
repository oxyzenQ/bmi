// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The float64 stepper the boundary-exactness theorems share.
 *
 * nextUp(x) returns the smallest representable double strictly greater
 * than x; nextDown(x) the largest strictly smaller. Implemented over the
 * raw IEEE-754 bit pattern (the bit ordering of a float64 IS the value
 * ordering for same-sign values), so a boundary window walked in steps
 * of one ulp can never skip a representable value between the walls.
 *
 * Honest scope: the proofs only step around positive boundary constants
 * (18.5, 25, 30, 12, 40, ...), where the sign branch below is exact.
 * The -0 corner is documented rather than exercised: -0 >= 0 is true in
 * the language, so a caller stepping below zero would cross the sign
 * wall in one step - no law in this package needs that corner.
 */

const F64 = new Float64Array(1);
const U64 = new BigUint64Array(F64.buffer);

export function nextUp(x: number): number {
	F64[0] = x;
	if (x >= 0) {
		U64[0] += 1n;
	} else {
		U64[0] -= 1n;
	}
	return F64[0];
}

export function nextDown(x: number): number {
	F64[0] = x;
	if (x > 0) {
		U64[0] -= 1n;
	} else {
		U64[0] += 1n;
	}
	return F64[0];
}
