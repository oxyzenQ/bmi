// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// @vitest-environment node
//
// night-frontier-Z3 - the v4 envelope and establish-on-import battery.
//
// Proves:
//   1. The v4 export carries the continuity chain, and the chain exactly
//      recomputes from the records it anchors (the import-side
//      cross-check accepts the genuine pair).
//   2. Every content tamper of a v4 file is rejected: record edits,
//      chain edits, truncation - the HMAC covers records + chain
//      jointly, and the recomputation cross-check is independent of it.
//   3. Encrypted v4 round-trip through the real crypto stack, with the
//      night-cafe-9 law proven at the integration level: the FIRST
//      passphrase-proven import on a device without a ledger verifier
//      establishes it (verifier-only — the at-rest session is never
//      registered), the imported write lands PLAINTEXT, and the ledger
//      stays fully readable across a simulated cold reload where a
//      follow-up calculation lands too. An import against a LOCKED
//      (sealed) ledger is honestly refused without destroying the seal.
//      A device WITH a verifier keeps the guarantee: a second import
//      under a different file passphrase never replaces it.
//   4. The legacy ladder (v0/v1/v2 fixtures) still imports, and a plain
//      import never establishes anything (no passphrase to prove).
//   5. The import is the re-anchor moment: the witness lands exactly on
//      the imported records.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const lsStore = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => lsStore.get(k) ?? null,
	setItem: (k: string, v: string) => lsStore.set(k, String(v)),
	removeItem: (k: string) => lsStore.delete(k),
	clear: () => lsStore.clear()
});

const dbState = vi.hoisted(() => ({
	meta: new Map<string, string>(),
	kv: new Map<string, string>(),
	backups: [] as Array<{
		id: number;
		data: string;
		timestamp: number;
		recordCount: number;
		appVersion: string;
	}>
}));

vi.mock('../db', () => ({
	isIndexedDbAvailable: () => true,
	dbMetaGet: vi.fn(async (key: string) => dbState.meta.get(key) ?? null),
	dbMetaSet: vi.fn(async (key: string, value: string) => {
		dbState.meta.set(key, value);
	}),
	dbSet: vi.fn(async (key: string, value: string) => {
		dbState.kv.set(key, value);
	}),
	dbRemove: vi.fn(async (key: string) => {
		dbState.kv.delete(key);
	}),
	dbGetAll: vi.fn(async () => Array.from(dbState.kv, ([key, value]) => ({ key, value }))),
	dbClose: vi.fn(),
	dbBackupSave: vi.fn(
		async (record: {
			data: string;
			timestamp: number;
			recordCount: number;
			appVersion: string;
		}) => {
			const id = dbState.backups.reduce((m, b) => Math.max(m, b.id), 0) + 1;
			dbState.backups.push({ ...record, id });
			return id;
		}
	),
	dbBackupGetAll: vi.fn(async () => [...dbState.backups].sort((a, b) => b.timestamp - a.timestamp)),
	dbBackupLatest: vi.fn(
		async () => [...dbState.backups].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
	),
	dbBackupDelete: vi.fn(async (id: number) => {
		dbState.backups = dbState.backups.filter((b) => b.id !== id);
	})
}));

import {
	STORAGE_KEYS,
	initStorage,
	storageInvalidateAll,
	_resetIdbWriteSeqForTesting
} from '../storage';
import { exportBmiHistory, importBmiHistory, validateBmiImport } from '../history-io';
import { readBmiHistory, saveBmiToHistory, _drainLedgerWritesForTesting } from '../bmi-history';
import {
	computeLedgerChain,
	computeWitnessChain,
	getSealedLedgerChain,
	META_LEDGER_CHAIN
} from '../ledger-continuity';
import { getEncryptionStatus, verifyPassphrase } from '../crypto';
import { AT_REST_TAG, _resetAtRestStateForTesting, getAtRestSessionKey } from '../at-rest-state';
import { fnv1a, dualHash } from '../legacy-hash';
import { exportBmiHistoryCsv } from '../history-csv';
import { _resetWitnessKeyForTesting } from '../witness-key';
import { _resetSealKeyForTesting } from '../seal-key';

const HISTORY = STORAGE_KEYS.HISTORY;
const PW = 'ledger-passphrase-one';
const PW_OTHER = 'a different file passphrase';

// Fresh timestamps keep the merged records inside the one-year save
// window, so the night-cafe-9 reload regression can exercise a real
// follow-up calculation over the imported ledger.
const NOW = Date.now();
const RECORDS = [
	{ timestamp: NOW - 7_200_000, bmi: 22.5, height: 170, weight: 65, age: 30 },
	{ timestamp: NOW - 3_600_000, bmi: 23.1, height: 170, weight: 67.5 },
	{ timestamp: NOW - 1_800_000, bmi: 21.8, height: 170, weight: 63 }
];

beforeEach(() => {
	lsStore.clear();
	dbState.meta.clear();
	dbState.kv.clear();
	dbState.backups = [];
	storageInvalidateAll();
	_resetIdbWriteSeqForTesting();
	_resetSealKeyForTesting(getAtRestSessionKey());
	_resetAtRestStateForTesting();
	_resetWitnessKeyForTesting();
	initStorage();
});

async function seedHistory(): Promise<void> {
	lsStore.set(HISTORY, JSON.stringify(RECORDS));
}

describe('v4 envelope: the continuity anchor rides the export', () => {
	it('the v4 export carries a chain that recomputes exactly from its records', async () => {
		await seedHistory();
		const exported = await exportBmiHistory();
		expect(exported).not.toBeNull();
		const parsed = JSON.parse(exported!) as {
			version: number;
			chain?: { head: string; length: number };
			records: unknown[];
		};
		expect(parsed.version).toBe(4);
		expect(parsed.chain).toBeTruthy();
		const expected = await computeLedgerChain(parsed.records as never);
		expect(parsed.chain!.head).toBe(expected.head);
		expect(parsed.chain!.length).toBe(3);
	});

	it('validates as integrityVersion 4', async () => {
		await seedHistory();
		const exported = await exportBmiHistory();
		const result = await validateBmiImport(exported!);
		expect(result.valid).toBe(true);
		expect(result.integrityVersion).toBe(4);
		expect(result.integrityVerified).toBe(true);
	});
});

describe('v4 tamper battery: every content change is rejected', () => {
	async function exportParsed(): Promise<Record<string, unknown>> {
		await seedHistory();
		return JSON.parse((await exportBmiHistory())!) as Record<string, unknown>;
	}

	it('rejects an edited record value', async () => {
		const env = await exportParsed();
		const records = env.records as Array<Record<string, unknown>>;
		records[0].weight = 200;
		expect((await validateBmiImport(JSON.stringify(env))).valid).toBe(false);
	});

	it('rejects a truncated record list', async () => {
		const env = await exportParsed();
		env.records = (env.records as unknown[]).slice(0, 2);
		expect((await validateBmiImport(JSON.stringify(env))).valid).toBe(false);
	});

	it('rejects an edited chain head', async () => {
		const env = await exportParsed();
		const chain = env.chain as { head: string };
		chain.head = '0'.repeat(64);
		expect((await validateBmiImport(JSON.stringify(env))).valid).toBe(false);
	});

	it('rejects an edited chain length', async () => {
		const env = await exportParsed();
		const chain = env.chain as { length: number };
		chain.length = 99;
		expect((await validateBmiImport(JSON.stringify(env))).valid).toBe(false);
	});

	it('rejects a chain stripped from the envelope', async () => {
		const env = await exportParsed();
		delete env.chain;
		// Without the chain the v4 shape is incomplete: the v4 branch
		// requires it, and no other format can claim this signature.
		expect((await validateBmiImport(JSON.stringify(env))).valid).toBe(false);
	});

	it('rejects a replayed duplicate record', async () => {
		const env = await exportParsed();
		env.records = [...(env.records as unknown[]), (env.records as unknown[])[0]];
		expect((await validateBmiImport(JSON.stringify(env))).valid).toBe(false);
	});
});

describe('establish-on-import: verifier-only, the ledger stays plaintext (night-cafe-9)', () => {
	it('the first passphrase-proven import establishes the verifier and the ledger stays plaintext and readable', async () => {
		await seedHistory();
		const encrypted = await exportBmiHistory(PW);
		expect(encrypted).not.toBeNull();

		// Fresh device: no verifier, no session.
		expect((await getEncryptionStatus()).hasPassphrase).toBe(false);

		const result = await importBmiHistory(encrypted!, PW);
		expect(result.success).toBe(true);

		// The verifier now exists; the session never registered.
		expect((await getEncryptionStatus()).enabled).toBe(true);
		expect(await verifyPassphrase(PW)).toBe(true);
		expect(getAtRestSessionKey()).toBeNull();

		// The imported history landed PLAINTEXT: raw storage holds the
		// readable JSON, never the envelope.
		await vi.waitFor(
			() => {
				const raw = lsStore.get(HISTORY) ?? '';
				expect(raw.startsWith(AT_REST_TAG)).toBe(false);
				expect(JSON.parse(raw)).toHaveLength(RECORDS.length);
			},
			{ timeout: 8000, interval: 50 }
		);

		// And the witness landed exactly on the imported records, in the
		// PLAIN mode: no session, no attestation key, a portable anchor.
		await vi.waitFor(
			async () => {
				const sealed = await getSealedLedgerChain();
				const expected = await computeWitnessChain(RECORDS as never, 'plain');
				expect(sealed).toEqual(expected);
			},
			{ timeout: 8000, interval: 50 }
		);

		// The night-cafe-9 regression, end to end: the cold reload kills the
		// volatile session, and the ledger must survive it — records readable,
		// and a follow-up calculation lands instead of being silently refused
		// by the purge guard.
		_resetSealKeyForTesting(getAtRestSessionKey());
		_resetAtRestStateForTesting();
		_resetWitnessKeyForTesting();
		storageInvalidateAll();

		expect(readBmiHistory()).toHaveLength(RECORDS.length);
		saveBmiToHistory({
			bmi: 24.2,
			heightCm: 170,
			weightKg: 70,
			age: '30',
			lastSignature: null
		});
		await _drainLedgerWritesForTesting();
		expect(readBmiHistory()).toHaveLength(RECORDS.length + 1);
	});

	it('an import on a device WITH a verifier stays plaintext across a cold reload', async () => {
		await seedHistory();
		const fileOne = await exportBmiHistory(PW);
		await importBmiHistory(fileOne!, PW);
		expect(await verifyPassphrase(PW)).toBe(true);

		// Simulate the cold reload: the volatile session is gone while the
		// verifier and the plaintext ledger stay on the device.
		_resetSealKeyForTesting(getAtRestSessionKey());
		_resetAtRestStateForTesting();
		_resetWitnessKeyForTesting();
		storageInvalidateAll();

		const result = await importBmiHistory(fileOne!, PW);
		expect(result.success).toBe(true);
		await vi.waitFor(
			() => {
				const raw = lsStore.get(HISTORY) ?? '';
				expect(raw.startsWith(AT_REST_TAG)).toBe(false);
				expect(JSON.parse(raw)).toHaveLength(RECORDS.length);
			},
			{ timeout: 8000, interval: 50 }
		);
		expect(getAtRestSessionKey()).toBeNull();
	});

	it('an import against a LOCKED sealed ledger is honestly refused, seal untouched (night-cafe-9)', async () => {
		// A stranded v80.6.0 device: the ledger is a sealed envelope the
		// session cannot open. The purge guard must refuse the import write
		// instead of silently destroying the seal; the documented recovery is
		// the explicit clear-ledger moment followed by a fresh import.
		const stranded = AT_REST_TAG + 'bm9vcGFxdWVqb3VybmFs';
		lsStore.set(HISTORY, stranded);

		const payload = JSON.stringify({
			version: 2,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			records: JSON.stringify(RECORDS)
		});
		const digest = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(payload).buffer as ArrayBuffer
		);
		const checksum = Array.from(new Uint8Array(digest), (b) =>
			b.toString(16).padStart(2, '0')
		).join('');
		const plain = JSON.stringify({
			version: 2,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			checksum,
			records: RECORDS
		});

		const result = await importBmiHistory(plain);
		expect(result.success).toBe(false);
		expect(result.errorCode).toBe('save_failed');
		expect(lsStore.get(HISTORY)).toBe(stranded);
	});

	it('a later import under a different file passphrase never replaces the verifier', async () => {
		await seedHistory();
		const fileOne = await exportBmiHistory(PW);
		await importBmiHistory(fileOne!, PW);
		expect(await verifyPassphrase(PW)).toBe(true);
		const verifierBefore = dbState.meta.get('__encryption_verifier');

		// A second encrypted file, sealed under a different passphrase.
		lsStore.clear();
		storageInvalidateAll();
		lsStore.set(HISTORY, JSON.stringify([RECORDS[0]]));
		const fileTwo = await exportBmiHistory(PW_OTHER);
		const result = await importBmiHistory(fileTwo!, PW_OTHER);
		expect(result.success).toBe(true);

		// The verifier is untouched: only the ledger passphrase registers.
		expect(dbState.meta.get('__encryption_verifier')).toBe(verifierBefore);
		expect(await verifyPassphrase(PW)).toBe(true);
		expect(await verifyPassphrase(PW_OTHER)).toBe(false);
	});

	it('a plain import never establishes anything (no passphrase to prove)', async () => {
		lsStore.set(HISTORY, JSON.stringify(RECORDS));
		const payload = JSON.stringify({
			version: 2,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			records: JSON.stringify(RECORDS)
		});
		const digest = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(payload).buffer as ArrayBuffer
		);
		const checksum = Array.from(new Uint8Array(digest), (b) =>
			b.toString(16).padStart(2, '0')
		).join('');
		const plain = JSON.stringify({
			version: 2,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			checksum,
			records: RECORDS
		});
		const result = await importBmiHistory(plain);
		expect(result.success).toBe(true);
		expect((await getEncryptionStatus()).hasPassphrase).toBe(false);
		expect(lsStore.get(HISTORY)?.startsWith(AT_REST_TAG)).toBe(false);
	});
});

describe('the legacy ladder stays readable (v0/v1/v2 fixtures)', () => {
	it('imports a v2 SHA-256 fixture and leaves the device unestablished', async () => {
		const records = [RECORDS[0]];
		const payload = JSON.stringify({
			version: 2,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			records: JSON.stringify(records)
		});
		const digest = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(payload).buffer as ArrayBuffer
		);
		const checksum = Array.from(new Uint8Array(digest), (b) =>
			b.toString(16).padStart(2, '0')
		).join('');
		const envelope = {
			version: 2,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			checksum,
			records
		};
		const result = await importBmiHistory(JSON.stringify(envelope));
		expect(result.success).toBe(true);
		expect(result.integrityVersion).toBe(2);
		expect((await getEncryptionStatus()).hasPassphrase).toBe(false);
	});

	it('imports a v0 FNV-1a fixture', async () => {
		const records = [RECORDS[0]];
		const recordsJson = JSON.stringify(records);
		const envelope = {
			version: 0,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			checksum: fnv1a(recordsJson),
			records
		};
		const result = await importBmiHistory(JSON.stringify(envelope));
		expect(result.success).toBe(true);
		expect(result.integrityVersion).toBe(0);
	});

	it('imports a v1 dual-hash fixture', async () => {
		const records = [RECORDS[0]];
		const payload = JSON.stringify({
			version: 1,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			records: JSON.stringify(records)
		});
		const envelope = {
			version: 1,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			checksum: dualHash(payload),
			records
		};
		const result = await importBmiHistory(JSON.stringify(envelope));
		expect(result.success).toBe(true);
		expect(result.integrityVersion).toBe(1);
	});
});

describe('witness re-seal and CSV surface', () => {
	it('the import re-anchors the witness exactly on the imported records', async () => {
		lsStore.set(HISTORY, JSON.stringify(RECORDS));
		const innerPayload = JSON.stringify({
			version: 2,
			source: 'bmi-calculator',
			exportedAt: '2026-01-01T00:00:00.000Z',
			records: JSON.stringify([RECORDS[0], RECORDS[1]])
		});
		const digest = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(innerPayload).buffer as ArrayBuffer
		);
		const checksum = Array.from(new Uint8Array(digest), (b) =>
			b.toString(16).padStart(2, '0')
		).join('');
		const result = await importBmiHistory(
			JSON.stringify({
				version: 2,
				source: 'bmi-calculator',
				exportedAt: '2026-01-01T00:00:00.000Z',
				checksum,
				records: [RECORDS[0], RECORDS[1]]
			})
		);
		expect(result.success).toBe(true);
		await vi.waitFor(
			async () => {
				const sealed = await getSealedLedgerChain();
				const expected = await computeLedgerChain([RECORDS[0], RECORDS[1]]);
				expect(sealed).toEqual(expected);
			},
			{ timeout: 8000, interval: 50 }
		);
		expect(dbState.meta.has(META_LEDGER_CHAIN)).toBe(true);
	});

	it('the CSV export moved to history-csv.ts without behavior change', async () => {
		lsStore.set(HISTORY, JSON.stringify(RECORDS));
		const csv = exportBmiHistoryCsv();
		expect(csv).not.toBeNull();
		expect(csv!).toContain('"Date","Time","BMI","Height (cm)","Weight (kg)","Age","Category"');
		expect(csv!).toContain('"22.5"');
	});
});
