// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/// <reference lib="webworker" />
/**
 * The vault flush worker (night-frontier-Z4).
 *
 * FileSystemSyncAccessHandle is worker-only by spec, so the OPFS
 * write-then-FLUSH runs here: a real fsync-shaped call that blocks
 * until the bytes reach the storage backend. The worker is a thin shim
 * over vault-opfs.ts — the flush semantics live in the primitive (and
 * are testable there against a handle spy); this file owns the message
 * protocol and nothing else.
 *
 * Protocol: { id, snapshot } in, { id, bytes } out on success or
 * { id, error } on failure. One file, latest snapshot wins.
 */
import { writeVaultSnapshotWithFlush } from './vault-opfs';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<{ id: number; snapshot: string }>) => {
	// Origin gate, mirroring the service-worker and kdf-worker convention:
	// the inline blob worker can only be driven by its creating document,
	// so any message whose origin disagrees with the worker's own origin
	// is dropped unread. The snapshot string never leaves this worker
	// except into the OPFS handle - a forged-origin message gets nothing.
	const trustedOrigin = ctx.location.origin;
	if (event.origin && event.origin !== trustedOrigin) return;
	const { id, snapshot } = event.data;
	try {
		const result = await writeVaultSnapshotWithFlush(snapshot);
		ctx.postMessage({ id, bytes: result.bytes });
	} catch (err) {
		ctx.postMessage({
			id,
			error: err instanceof Error ? err.message : 'vault write failed'
		});
	}
};
