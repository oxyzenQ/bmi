// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
	getEncryptionErrorDescriptionKey,
	getEncryptionErrorSeverity
} from '../encryption-modal-helpers';

describe('encryption-modal-helpers', () => {
	it('keeps local validation errors at default severity', () => {
		expect(getEncryptionErrorSeverity('wrong_passphrase', true)).toBe('default');
	});

	it('maps structured import errors to existing severity levels', () => {
		expect(getEncryptionErrorSeverity('wrong_passphrase')).toBe('danger');
		expect(getEncryptionErrorSeverity('integrity_failed')).toBe('danger');
		expect(getEncryptionErrorSeverity('corrupted_file')).toBe('warning');
		expect(getEncryptionErrorSeverity('invalid_format')).toBe('default');
		expect(getEncryptionErrorSeverity()).toBe('default');
	});

	it('maps structured import errors to existing description keys', () => {
		expect(getEncryptionErrorDescriptionKey('wrong_passphrase')).toBe(
			'crypto.error_wrong_passphrase_desc'
		);
		expect(getEncryptionErrorDescriptionKey('corrupted_file')).toBe('crypto.error_corrupted_desc');
		expect(getEncryptionErrorDescriptionKey('integrity_failed')).toBe('crypto.error_tampered_desc');
		expect(getEncryptionErrorDescriptionKey('invalid_format')).toBe('');
	});
});
