// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * Browser download for in-memory payloads — shared tail of every export
 * path (JSON envelope, CSV spreadsheet).
 *
 * The object-URL revoke is deferred by one second instead of running in
 * the same tick as the anchor click: Firefox and iOS Safari start the
 * download asynchronously and abort it when the URL dies before the
 * fetch of the blob completes. Chrome tolerates the same-tick revoke;
 * the deferral is the cross-browser-safe contract.
 */
export function downloadBlobFile(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
