// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// night-frontier-Z4 - the OPFS flush() vault battery.
//
// Proves, against a sync-access-handle spy:
//   1. The flush primitive's exact contract: truncate(0) before the
//      write, the full snapshot written at offset 0, exactly one
//      flush(), and close() in a finally (even when flush throws).
//   2. The byte contract: the written byte count equals the snapshot's
//      UTF-8 length, and the file reads back byte-identical.
//   3. The read path: a present file returns its text, an absent file
//      or an unavailable platform returns null (the honest "no vault
//      copy").
//   4. The mirror degrade: in an environment without Worker support,
//      the mirror reports the honest reason instead of pretending.
//   5. The status surface: availability, the mirror outcome, and the
//      file's byte length.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The fake OPFS: a directory handle that yields a sync access handle
// whose calls are all spied, plus a file handle whose getFile() reads
// back what the access handle wrote.
interface FakeAccess {
	write: (bytes: Uint8Array, opts: { at: number }) => number;
	flush: () => void;
	truncate: (n: number) => void;
	close: () => void;
}

const opfsState = vi.hoisted(() => {
	return {
		bytes: new Uint8Array(0),
		calls: [] as string[],
		failFlush: false
	};
});

function makeFakeOpfs(): void {
	const access: FakeAccess = {
		write: (bytes, opts) => {
			opfsState.calls.push(`write:${opts.at}:${bytes.length}`);
			const next = new Uint8Array(Math.max(opfsState.bytes.length, opts.at + bytes.length));
			next.set(opfsState.bytes.subarray(0, opts.at));
			next.set(bytes, opts.at);
			opfsState.bytes = next;
			return bytes.length;
		},
		flush: () => {
			opfsState.calls.push('flush');
			if (opfsState.failFlush) throw new Error('flush failed');
		},
		truncate: (n) => {
			opfsState.calls.push(`truncate:${n}`);
			opfsState.bytes = opfsState.bytes.subarray(0, n);
		},
		close: () => {
			opfsState.calls.push('close');
		}
	};
	const storage = {
		getDirectory: async () => ({
			getFileHandle: async () => ({
				createSyncAccessHandle: async () => access,
				getFile: async () => ({
					size: opfsState.bytes.length,
					text: async () => new TextDecoder().decode(opfsState.bytes)
				})
			})
		})
	};
	vi.stubGlobal('navigator', { storage });
}

beforeEach(() => {
	opfsState.bytes = new Uint8Array(0);
	opfsState.calls = [];
	opfsState.failFlush = false;
	makeFakeOpfs();
	vi.resetModules();
});

async function freshModule() {
	return await import('../vault-opfs');
}

async function freshVaultModule() {
	return await import('../vault-backup');
}

describe('the flush primitive contract', () => {
	it('writes the full snapshot at offset 0 and calls flush exactly once', async () => {
		const { writeVaultSnapshotWithFlush } = await freshModule();
		const snapshot = '{"bmi.history":"[]"}';
		const result = await writeVaultSnapshotWithFlush(snapshot);
		expect(result.ok).toBe(true);
		expect(result.bytes).toBe(new TextEncoder().encode(snapshot).length);
		expect(opfsState.calls).toEqual(['truncate:0', `write:0:${result.bytes}`, 'flush', 'close']);
	});

	it('flush precedes close (the fsync ordering is structural)', async () => {
		const { writeVaultSnapshotWithFlush } = await freshModule();
		await writeVaultSnapshotWithFlush('x');
		expect(opfsState.calls.indexOf('flush')).toBeLessThan(opfsState.calls.indexOf('close'));
	});

	it('close runs even when flush throws, and the error propagates', async () => {
		const { writeVaultSnapshotWithFlush } = await freshModule();
		opfsState.failFlush = true;
		await expect(writeVaultSnapshotWithFlush('x')).rejects.toThrow('flush failed');
		expect(opfsState.calls[opfsState.calls.length - 1]).toBe('close');
	});

	it('overwrites a larger previous snapshot completely (truncate first)', async () => {
		const { writeVaultSnapshotWithFlush } = await freshModule();
		await writeVaultSnapshotWithFlush('A'.repeat(4096));
		await writeVaultSnapshotWithFlush('B');
		const decoded = new TextDecoder().decode(opfsState.bytes);
		expect(decoded).toBe('B');
		expect(opfsState.bytes.length).toBe(1);
	});

	it('handles multibyte UTF-8 byte counts exactly', async () => {
		const { writeVaultSnapshotWithFlush } = await freshModule();
		const snapshot = '{"key":"väli-日本語"}';
		const result = await writeVaultSnapshotWithFlush(snapshot);
		expect(result.bytes).toBe(new TextEncoder().encode(snapshot).length);
		const { readVaultSnapshot } = await freshVaultModule();
		expect(await readVaultSnapshot()).toBe(snapshot);
	});
});

describe('the read path and the status surface', () => {
	it('reads back byte-identical text', async () => {
		const { writeVaultSnapshotWithFlush } = await freshModule();
		const snapshot = '{"snapshot":true}';
		await writeVaultSnapshotWithFlush(snapshot);
		const { readVaultSnapshot } = await freshVaultModule();
		expect(await readVaultSnapshot()).toBe(snapshot);
	});

	it('returns null for an absent file (the honest no-vault-copy)', async () => {
		const { readVaultSnapshot } = await freshVaultModule();
		const storage = {
			getDirectory: async () => ({
				getFileHandle: async () => {
					throw new Error('NotFoundError');
				}
			})
		};
		vi.stubGlobal('navigator', { storage });
		expect(await readVaultSnapshot()).toBeNull();
	});

	it('returns null when the platform has no OPFS directory', async () => {
		const { readVaultSnapshot } = await freshVaultModule();
		vi.stubGlobal('navigator', {
			storage: {
				getDirectory: async () => {
					throw new Error('no opfs');
				}
			}
		});
		expect(await readVaultSnapshot()).toBeNull();
	});

	it('the status reports availability, mirror outcome, and byte length', async () => {
		const { writeVaultSnapshotWithFlush } = await freshModule();
		const { getVaultBackupStatus } = await freshVaultModule();
		let status = await getVaultBackupStatus();
		expect(status.available).toBe(true);
		expect(status.mirrored).toBe(false);
		expect(status.bytes).toBe(0);
		await writeVaultSnapshotWithFlush('{"x":1}');
		status = await getVaultBackupStatus();
		expect(status.available).toBe(true);
		expect(status.bytes).toBe(7);
	});
});

describe('the mirror degrade contract (no worker support)', () => {
	it('reports the honest reason instead of pretending to flush', async () => {
		const { mirrorVaultSnapshot, _drainVaultMirrorForTesting } = await freshVaultModule();
		const result = await mirrorVaultSnapshot('{"snapshot":1}');
		await _drainVaultMirrorForTesting();
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('worker unavailable');
		// No file was written behind the caller's back.
		expect(opfsState.bytes.length).toBe(0);
	});
});
