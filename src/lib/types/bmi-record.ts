// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

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
