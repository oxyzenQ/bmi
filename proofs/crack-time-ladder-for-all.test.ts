// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The crack-time ladder theorem (night-netrunner-Z2, the for-all tier).
 *
 * Law: formatCrackTime is the unit-ladder decision table the spec
 * states - the first unit whose floor the seconds value reaches wins,
 * the count is round(seconds / unit), the singular key is chosen iff
 * the count is exactly 1 - for EVERY integer second in [0, 20000]
 * (the instant, seconds, minutes, and hours buckets, exhaustively) and
 * at every remaining unit boundary to one ulp on each side.
 *
 * Decomposition: the ladder is a monotone step function of seconds.
 * Exhaustive coverage of the low buckets plus exact boundary windows
 * at the high thresholds decides every input in between: the count
 * rounding cannot change the bucket away from a boundary, because the
 * bucket choice precedes the rounding and compares raw seconds.
 *
 * The non-finite posture is pinned, not ignored: NaN falls through
 * every comparison to the instant bucket; Infinity lands in the
 * centuries bucket with an infinite count. The estimate engine feeds
 * finite values only; the posture is pinned so a regression upstream
 * is caught here rather than in a user's face.
 */

import { describe, expect, it } from 'vitest';
import { formatCrackTime } from '../src/lib/utils/crack-time';
import { nextDown, nextUp } from './next-after';

/** The observer stub: every verdict is the exact key and count pair. */
const observe = (
	key: string,
	params?: Record<string, string | number | undefined | null>
): string => `${key}|${String(params?.n ?? '')}`;

/** The spec ladder, stated independently of the implementation order. */
const SPEC_UNITS = [
	{ singular: 'crypto.crack_centuries', seconds: 100 * 365.25 * 24 * 3600 },
	{ singular: 'crypto.crack_years', seconds: 365.25 * 24 * 3600 },
	{ singular: 'crypto.crack_months', seconds: 30.44 * 24 * 3600 },
	{ singular: 'crypto.crack_days', seconds: 24 * 3600 },
	{ singular: 'crypto.crack_hours', seconds: 3600 },
	{ singular: 'crypto.crack_minutes', seconds: 60 },
	{ singular: 'crypto.crack_seconds', seconds: 1 }
] as const;

const INSTANT = 'crypto.crack_instant|';

/** The spec verdict for a finite input: the first unit whose floor is reached. */
function specVerdict(seconds: number): string {
	if (seconds < 1) return INSTANT;
	for (const unit of SPEC_UNITS) {
		if (seconds >= unit.seconds) {
			const n = Math.round(seconds / unit.seconds);
			const key = n === 1 ? unit.singular : `${unit.singular}_plural`;
			return `${key}|${String(n)}`;
		}
	}
	return INSTANT;
}

const UNIT_RANK: Record<string, number> = {
	'crypto.crack_instant': 0,
	'crypto.crack_seconds': 1,
	'crypto.crack_minutes': 2,
	'crypto.crack_hours': 3,
	'crypto.crack_days': 4,
	'crypto.crack_months': 5,
	'crypto.crack_years': 6,
	'crypto.crack_centuries': 7
};

function rankOf(verdict: string): number {
	return UNIT_RANK[verdict.split('|')[0].replace('_plural', '')];
}

describe('the crack-time ladder theorem (for-all over [0, 20000])', () => {
	it('matches the spec decision table for every integer second in [0, 20000]', () => {
		for (let s = 0; s <= 20_000; s++) {
			expect(formatCrackTime(s, observe)).toBe(specVerdict(s));
		}
	});

	it('holds the singular law exactly at the unit boundary crossings', () => {
		// At each threshold the count is exactly 1: the singular key fires.
		expect(formatCrackTime(1, observe)).toBe('crypto.crack_seconds|1');
		expect(formatCrackTime(60, observe)).toBe('crypto.crack_minutes|1');
		expect(formatCrackTime(3600, observe)).toBe('crypto.crack_hours|1');
		expect(formatCrackTime(24 * 3600, observe)).toBe('crypto.crack_days|1');
		expect(formatCrackTime(30.44 * 24 * 3600, observe)).toBe('crypto.crack_months|1');
		expect(formatCrackTime(365.25 * 24 * 3600, observe)).toBe('crypto.crack_years|1');
		expect(formatCrackTime(100 * 365.25 * 24 * 3600, observe)).toBe('crypto.crack_centuries|1');
	});

	it('flips the bucket exactly at every high threshold, to one ulp on each side', () => {
		const thresholds = [
			{ unit: SPEC_UNITS[3], below: 'crypto.crack_hours' },
			{ unit: SPEC_UNITS[2], below: 'crypto.crack_days' },
			{ unit: SPEC_UNITS[1], below: 'crypto.crack_months' },
			{ unit: SPEC_UNITS[0], below: 'crypto.crack_years' }
		];
		for (const t of thresholds) {
			const justBelow = specVerdict(nextDown(t.unit.seconds));
			expect(justBelow.split('|')[0]).toBe(`${t.below}_plural`);
			expect(formatCrackTime(nextDown(t.unit.seconds), observe)).toBe(justBelow);
			expect(formatCrackTime(nextUp(t.unit.seconds), observe)).toBe(
				specVerdict(nextUp(t.unit.seconds))
			);
		}
	});

	it('keeps the unit rank monotone and the count non-decreasing within a bucket', () => {
		let previousRank = -1;
		let previousCount = -1;
		for (let i = 0; i <= 2000; i++) {
			const seconds = Math.floor(Math.pow(10, (9.6 * i) / 2000));
			const verdict = formatCrackTime(seconds, observe);
			const rank = rankOf(verdict);
			const count = Number(verdict.split('|')[1]);
			expect(rank).toBeGreaterThanOrEqual(previousRank);
			if (rank === previousRank) {
				expect(count).toBeGreaterThanOrEqual(previousCount);
			}
			previousRank = rank;
			previousCount = count;
		}
	});

	it('pins the non-finite posture (fall-through to instant, infinity to centuries)', () => {
		expect(formatCrackTime(Number.NaN, observe)).toBe(INSTANT);
		expect(formatCrackTime(0.999, observe)).toBe(INSTANT);
		const infinite = formatCrackTime(Number.POSITIVE_INFINITY, observe);
		expect(infinite.split('|')[0]).toBe('crypto.crack_centuries_plural');
		expect(Number(infinite.split('|')[1])).toBe(Number.POSITIVE_INFINITY);
	});
});
