// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The one bytes-to-hex encoder (night-depth-hardening-5 dragon hunt).
 *
 * Eight hand-rolled copies of the same loop had drifted across the
 * crypto-adjacent modules (witness-key, ledger-chain, history-io,
 * shell-integrity, signature); this leaf imports nothing and is the
 * single auditable home. Lowercase, zero-padded, exactly two chars per
 * byte — the encoding every digest and signature in the tree speaks.
 */
export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
