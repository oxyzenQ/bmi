// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

export type EncryptionMode = 'export' | 'import';

export interface EncryptionImportMeta {
	encrypted: boolean;
	format?: string;
	exportedAt?: string;
	recordCount?: number;
	version?: number;
}

export type EncryptionErrorSeverity = 'default' | 'warning' | 'danger';
