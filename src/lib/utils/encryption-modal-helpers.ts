// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import type { EncryptionErrorSeverity } from '$lib/types/encryption-modal';

export function getEncryptionErrorSeverity(
	errorCode?: string,
	hasLocalError = false
): EncryptionErrorSeverity {
	if (hasLocalError) return 'default';
	if (!errorCode) return 'default';
	if (errorCode === 'integrity_failed' || errorCode === 'wrong_passphrase') return 'danger';
	if (errorCode === 'corrupted_file') return 'warning';
	return 'default';
}

export function getEncryptionErrorDescriptionKey(errorCode?: string): string {
	if (errorCode === 'wrong_passphrase') return 'crypto.error_wrong_passphrase_desc';
	if (errorCode === 'corrupted_file') return 'crypto.error_corrupted_desc';
	if (errorCode === 'integrity_failed') return 'crypto.error_tampered_desc';
	return '';
}
