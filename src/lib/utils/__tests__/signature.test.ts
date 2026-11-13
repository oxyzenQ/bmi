// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	BMI_STELLAR_SIGNATURE,
	BMI_STELLAR_SIGNATURE_BUILDER,
	BMI_STELLAR_SIGNATURE_ENC,
	BMI_STELLAR_SIGNATURE_YEAR
} from '../signature';
import pkg from '../../../../package.json';

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

// Recorded independently in scripts/gates/check-signature.ts. Two
// pins, both digest-shaped - the plain value is never spelled here.
const RECORDED_DIGEST = 'ee83e27fc1f29d29e0da81fd3808394949141aefff47a29b8529f1add9a44941';

describe('the depth signature (night-signature-advanced-2)', () => {
	it('decodes to the recorded shape: builder (handle) year', () => {
		expect(BMI_STELLAR_SIGNATURE).toMatch(/^[A-Za-z_]+ \([A-Za-z]+\) \d{4}$/);
	});

	it('pins the decode against the recorded digest', () => {
		expect(sha256(BMI_STELLAR_SIGNATURE)).toBe(RECORDED_DIGEST);
	});

	it('stamps the decoded build year', () => {
		expect(BMI_STELLAR_SIGNATURE_YEAR).toMatch(/^\d{4}$/);
	});

	it('keeps the payload masked: pure hex, nothing readable', () => {
		expect(BMI_STELLAR_SIGNATURE_ENC).toMatch(/^[0-9a-f]+$/);
		expect(BMI_STELLAR_SIGNATURE_ENC).not.toMatch(/[g-z]/);
		expect(BMI_STELLAR_SIGNATURE_ENC.length).toBe(BMI_STELLAR_SIGNATURE.length * 2);
	});

	it('keeps builder and year derived from the decode', () => {
		expect(`${BMI_STELLAR_SIGNATURE_BUILDER} ${BMI_STELLAR_SIGNATURE_YEAR}`).toBe(
			BMI_STELLAR_SIGNATURE
		);
	});

	it('cross-checks the decode against the plain package author field', () => {
		expect(pkg.author).toBe(BMI_STELLAR_SIGNATURE_BUILDER);
	});

	it('keeps the package signature field in masked parity', () => {
		expect((pkg as { signature?: string }).signature).toBe(BMI_STELLAR_SIGNATURE_ENC);
	});
});
