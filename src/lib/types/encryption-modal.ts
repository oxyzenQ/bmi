// Copyright (c) 2025 - 2026 rezky_nightky

export type EncryptionMode = 'export' | 'import';

export interface EncryptionImportMeta {
	encrypted: boolean;
	format?: string;
	exportedAt?: string;
	recordCount?: number;
	version?: number;
}

export type EncryptionErrorSeverity = 'default' | 'warning' | 'danger';
