// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import type { ImportError } from '$lib/utils/history-io';

export function sanitizeInteger(value: string): string {
	return value.replace(/\D+/g, '').slice(0, 3);
}

export function sanitizeDecimal(value: string): string {
	let sanitized = value.replace(/[^0-9.]/g, '');
	const firstDot = sanitized.indexOf('.');

	if (firstDot !== -1) {
		sanitized = sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, '');
	}

	if (sanitized.startsWith('00')) {
		sanitized = sanitized.replace(/^0+/, '0');
	}

	return sanitized.slice(0, 6);
}

export function formatBmiExportDate(date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function importErrorKey(code: ImportError): string {
	const map: Record<ImportError, string> = {
		empty_file: 'history.empty_file',
		file_too_large: 'history.file_too_large',
		invalid_json: 'history.invalid_json',
		invalid_format: 'history.invalid_format',
		unsupported_version: 'history.unsupported_version',
		encrypted_no_passphrase: 'history.encrypted_no_passphrase',
		wrong_passphrase: 'history.wrong_passphrase',
		corrupted_file: 'history.corrupted_file',
		no_valid_records: 'history.no_valid_records',
		integrity_failed: 'history.integrity_failed',
		save_failed: 'history.save_failed'
	};

	return map[code] ?? 'form.import_failed';
}
