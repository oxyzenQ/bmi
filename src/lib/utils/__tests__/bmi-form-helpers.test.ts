// Copyright (c) 2025 - 2026 rezky_nightky
import { describe, expect, it } from 'vitest';
import {
	formatBmiExportDate,
	importErrorKey,
	sanitizeDecimal,
	sanitizeInteger
} from '../bmi-form-helpers';

describe('bmi-form-helpers', () => {
	it('sanitizes integer input for age', () => {
		expect(sanitizeInteger('2a5')).toBe('25');
		expect(sanitizeInteger('1234')).toBe('123');
	});

	it('sanitizes decimal input for height and weight', () => {
		expect(sanitizeDecimal('70.5kg')).toBe('70.5');
		expect(sanitizeDecimal('1.2.3')).toBe('1.23');
		expect(sanitizeDecimal('00072')).toBe('072');
		expect(sanitizeDecimal('1234567')).toBe('123456');
	});

	it('formats export dates deterministically', () => {
		expect(formatBmiExportDate(new Date(2026, 4, 9))).toBe('2026-05-09');
	});

	it('maps import error codes to existing i18n keys', () => {
		expect(importErrorKey('wrong_passphrase')).toBe('history.wrong_passphrase');
		expect(importErrorKey('save_failed')).toBe('history.save_failed');
	});
});
