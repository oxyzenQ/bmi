// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

export type Gender = 'male' | 'female' | '';

export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '';

export interface ActivityLevel {
	value: Activity;
	label: string;
	factor: number;
}

export interface ImportNotifyResult {
	action: 'import-validate' | 'import-success' | 'import-error';
	text?: string;
	recordCount?: number;
	integrityVerified?: boolean;
	error?: string;
}
