// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The vault tier — the second durable home for the rolling backup
 * (night-frontier-Z4, deepening the rolling auto-backup vault).
 *
 * Every rolling backup mirrors its snapshot into OPFS through the
 * flush worker: write, FLUSH, close — the fsync-shaped primitive, not
 * a durability hint. The IndexedDB backups store stays the primary
 * (three deep, `durability: 'strict'` commits); the vault holds
 * exactly the latest snapshot as the corruption/eviction fallback for
 * the restore path.
 *
 * Semantics, stated honestly:
 *   - Writes are fire-and-forget single-flight: a new snapshot
 *     supersedes a queued one, the mirror never blocks or fails the
 *     backup that produced it, and every outcome is logged.
 *   - Reads go through FileSystemFileHandle.getFile() on the main
 *     thread (the sync handle is worker-only; reading needs no worker).
 *   - Unavailable means unavailable: engines without OPFS sync handles
 *     degrade to the IndexedDB-only vault and the status says so.
 */

import VaultWorkerCtor from './vault.worker?worker&inline';
import { VAULT_FILE } from './vault-opfs';

/**
 * The snapshot entry the continuity witness travels under (the same
 * IndexedDB meta key `META_LEDGER_CHAIN` names in ledger-continuity).
 * Declared here instead of imported to keep this module a leaf — the
 * ledger battery pins the two constants equal, so drift fails a test,
 * not a user's ledger (night-frontier-Z7).
 */
export const VAULT_WITNESS_META_KEY = '__history_chain_head';

export interface VaultMirrorResult {
	ok: boolean;
	bytes?: number;
	reason?: string;
}

export interface VaultBackupStatus {
	/** OPFS is usable on this engine. */
	available: boolean;
	/** The latest mirror attempt succeeded (a flush returned). */
	mirrored: boolean;
	/** The vault file's byte length, when it exists. */
	bytes: number | null;
}

let workerPromise: Promise<Worker> | null = null;
let broken = false;
let nextJobId = 1;
let pending: Map<number, { resolve: (r: VaultMirrorResult) => void; reject: (e: Error) => void }> =
	new Map();
/** The latest mirror outcome, surfaced by the status. */
let lastMirrorOk = false;

/** Whether the flush worker path is currently usable. */
export function isVaultWorkerAvailable(): boolean {
	return !broken && typeof Worker !== 'undefined';
}

function attachHandlers(w: Worker): Worker {
	w.onmessage = (event: MessageEvent<{ id: number; bytes?: number; error?: string }>) => {
		const { id, bytes, error } = event.data;
		const job = pending.get(id);
		if (!job) return;
		pending.delete(id);
		if (error || bytes === undefined) {
			job.resolve({ ok: false, reason: error ?? 'vault worker returned no byte count' });
		} else {
			lastMirrorOk = true;
			job.resolve({ ok: true, bytes });
		}
	};
	w.onerror = (event) => {
		broken = true;
		const err = new Error(event.message || 'vault worker crashed');
		for (const job of pending.values()) job.resolve({ ok: false, reason: err.message });
		pending.clear();
		w.terminate();
		if (workerPromise) workerPromise = null;
	};
	return w;
}

/** Single-flight: every mirror runs strictly after the previous one. */
let mirrorTask: Promise<void> = Promise.resolve();

function enqueueMirror(snapshot: string): Promise<VaultMirrorResult> {
	const run = mirrorTask.then(async (): Promise<VaultMirrorResult> => {
		if (!isVaultWorkerAvailable()) return { ok: false, reason: 'worker unavailable' };
		const w = await (workerPromise ??= Promise.resolve(attachHandlers(new VaultWorkerCtor())));
		const id = nextJobId++;
		return new Promise<VaultMirrorResult>((resolve) => {
			pending.set(id, { resolve, reject: () => {} });
			w.postMessage({ id, snapshot });
			// The worker replies exactly once per job; a hung worker is
			// resolved by onerror's latch. No timer race by design.
		});
	});
	mirrorTask = run.then(
		() => {},
		() => {}
	);
	return run;
}

/**
 * Mirror one snapshot into the OPFS vault (write + flush + close in the
 * worker). Fire-and-forget by contract: never throws, never blocks the
 * backup that produced it, latest snapshot wins.
 */
export function mirrorVaultSnapshot(snapshot: string): Promise<VaultMirrorResult> {
	return enqueueMirror(snapshot);
}

/** @internal Test-only: resolve when the single-flight queue has drained. */
export async function _drainVaultMirrorForTesting(): Promise<void> {
	await mirrorTask;
}

/**
 * Read the vault snapshot from OPFS (main thread, no worker needed).
 * Null when absent or the platform has no OPFS directory.
 */
export async function readVaultSnapshot(): Promise<string | null> {
	try {
		const root = await navigator.storage.getDirectory();
		const handle = await root.getFileHandle(VAULT_FILE);
		const file = await handle.getFile();
		return await file.text();
	} catch {
		// Absent file or unavailable OPFS — the honest "no vault copy".
		return null;
	}
}

/**
 * Read the continuity witness copy the vault snapshot carries
 * (night-frontier-Z7, the tri-home witness). Returns the raw witness
 * JSON string, or null when the vault is absent, unreadable, or the
 * snapshot predates the witness (pre-Z3) or carries a damaged entry.
 * The caller owns the parse — this module stays a leaf and never
 * imports the ledger modules.
 */
export async function readVaultWitnessRaw(): Promise<string | null> {
	const snapshot = await readVaultSnapshot();
	if (snapshot === null) return null;
	try {
		const parsed = JSON.parse(snapshot) as Record<string, unknown>;
		const witness = parsed[VAULT_WITNESS_META_KEY];
		return typeof witness === 'string' && witness.length > 0 ? witness : null;
	} catch {
		// A snapshot that is not the shape the app wrote: the honest
		// "no vault copy" — never evidence either way.
		return null;
	}
}

/**
 * The vault status: platform availability, the latest mirror outcome,
 * and the vault file's byte length when it exists.
 */
export async function getVaultBackupStatus(): Promise<VaultBackupStatus> {
	try {
		const root = await navigator.storage.getDirectory();
		const handle = await root.getFileHandle(VAULT_FILE);
		const file = await handle.getFile();
		return { available: true, mirrored: lastMirrorOk, bytes: file.size };
	} catch {
		return { available: false, mirrored: lastMirrorOk, bytes: null };
	}
}

/** @internal Test-only: reset singleton state between tests. */
export function _resetVaultForTesting(): void {
	workerPromise?.then((w) => w.terminate()).catch(() => {});
	workerPromise = null;
	broken = false;
	pending = new Map();
	lastMirrorOk = false;
}
