// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The OPFS flush() vault primitive (night-frontier-Z4).
 *
 * `durability: 'strict'` on IndexedDB commits is a hint — the user
 * agent MAY consider a commit durable, and Chrome 121 quietly relaxed
 * the implicit default. `FileSystemSyncAccessHandle.flush()` is the
 * fsync-shaped primitive the platform actually offers: it blocks until
 * the bytes reach the storage backend. This module is the second
 * durable home for the vault backup — the latest snapshot mirrored
 * into the Origin Private File System through a sync access handle,
 * written AND flushed inside a worker (the handle is worker-only).
 *
 * The primitive is deliberately split from the worker shim so the
 * flush semantics are testable without a worker: any context that can
 * produce a sync access handle can run it, and the tests drive it
 * against a handle spy.
 *
 * Honest limits: OPFS availability is engine-dependent (Chromium
 * ships sync access handles; engines without them degrade to the
 * IndexedDB-only vault, honestly reported); the vault holds exactly
 * the latest snapshot — the three-deep rotation stays in IndexedDB;
 * flush() proving fsync semantics end-to-end is beyond what software
 * can observe — what is proven is that the call returned and the
 * bytes are readable back byte-identical.
 */

export const VAULT_FILE = 'vault-backup.json';

export interface VaultWriteResult {
	ok: boolean;
	bytes: number;
	reason?: string;
}

/**
 * Write the vault snapshot through a sync access handle: write, then
 * FLUSH, then close. Runs in any context holding
 * navigator.storage.getDirectory(); the production caller is the vault
 * worker. Throws on platform failure — the caller decides the degrade.
 */
export async function writeVaultSnapshotWithFlush(snapshot: string): Promise<VaultWriteResult> {
	const root = await navigator.storage.getDirectory();
	const handle = await root.getFileHandle(VAULT_FILE, { create: true });
	const access = await handle.createSyncAccessHandle();
	try {
		const bytes = new TextEncoder().encode(snapshot);
		access.truncate(0);
		const written = access.write(bytes, { at: 0 });
		access.flush();
		return { ok: true, bytes: written };
	} finally {
		access.close();
	}
}
