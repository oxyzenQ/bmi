// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
	BMI_STELLAR_SIGNATURE,
	BMI_STELLAR_SIGNATURE_BUILDER,
	BMI_STELLAR_SIGNATURE_YEAR
} from '../signature';
import pkg from '../../../../package.json';

describe('the depth signature (night-signature-1)', () => {
	it('carries the exact canonical attribution string', () => {
		expect(BMI_STELLAR_SIGNATURE).toBe('rezky_nightky (oxyzenQ) 2026');
	});

	it('matches the recorded shape: builder, year, single spaces', () => {
		expect(BMI_STELLAR_SIGNATURE).toMatch(/^rezky_nightky \(oxyzenQ\) \d{4}$/);
	});

	it('stamps the 2026 build year', () => {
		expect(BMI_STELLAR_SIGNATURE_YEAR).toBe('2026');
	});

	it('keeps the builder aligned with the package author field', () => {
		expect(pkg.author).toBe(BMI_STELLAR_SIGNATURE_BUILDER);
	});

	it('keeps the package signature field aligned with the canonical string', () => {
		expect((pkg as { signature?: string }).signature).toBe(BMI_STELLAR_SIGNATURE);
	});
});
