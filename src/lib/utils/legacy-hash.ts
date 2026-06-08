// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Legacy hash helpers — kept solely for backward compatibility when importing
 * old BMI history exports that used non-cryptographic checksums.
 *
 * These are NOT used for new exports (v3+ uses HMAC-SHA256 via Web Crypto).
 * They exist only so that imports of v0 (FNV-1a) and v1 (FNV-1a+DJB2) files
 * continue to validate correctly.
 *
 * Do NOT use these for any new integrity checks — they provide no cryptographic
 * security and are trivially forgeable. They are checksums only.
 */

/**
 * FNV-1a 32-bit hash. Produces an 8-character hex string.
 * Used by v0 legacy exports for records-only checksum.
 */
export function fnv1a(data: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < data.length; i++) {
		h ^= data.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * FNV-1a + DJB2 dual hash. Produces a 16-character hex string (8+8).
 * Used by v1 legacy exports for full-envelope checksum.
 */
export function dualHash(data: string): string {
	let fnv = 0x811c9dc5;
	let djb = 0x1505;
	for (let i = 0; i < data.length; i++) {
		const c = data.charCodeAt(i);
		fnv = Math.imul(fnv ^ c, 0x01000193);
		djb = ((djb << 5) + djb + c) | 0;
	}
	return (fnv >>> 0).toString(16).padStart(8, '0') + (djb >>> 0).toString(16).padStart(8, '0');
}
