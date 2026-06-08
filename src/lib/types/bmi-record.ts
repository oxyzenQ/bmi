// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Shared BMI record type used across history storage, import/export, and UI.
 *
 * Centralized here to avoid duplicate interface definitions in
 * bmi-history.ts and history-io.ts. All consumers should import from this file.
 */

export interface BmiRecord {
	timestamp: number;
	bmi: number;
	height: number;
	weight: number;
	age?: number;
}
