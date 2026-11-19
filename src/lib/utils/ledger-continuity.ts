// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The Ledger Continuity Chain (night-frontier-Z3).
 *
 * The physics gap this closes: AES-GCM protects per-value and the HMAC
 * v3/v4 signature protects per-file, but nothing protected the
 * *sequence* — a party with device access could truncate, reorder, or
 * rewrite the history and the absence would be undetectable by per-object
 * AEAD. This module makes the sequence itself tamper-evident: a SHA-256
 * hash chain over the validated records, with the chain head sealed in
 * the IndexedDB meta store (the `__at_rest_salt` precedent).
 *
 * Construction:
 *   link_0 = SHA-256("bmi-stellar-ledger-v4-genesis")
 *   link_i = SHA-256(link_{i-1} + ":" + canonicalJson(record_i))
 *   head   = link_n after n records (empty history: { head: link_0, length: 0 })
 *
 * canonicalJson is a fixed-key-order serialization (timestamp, bmi,
 * height, weight, age), so the same logical record always produces the
 * same bytes across engines (ECMAScript number formatting is mandated
 * deterministic). The chain runs over the timestamp-ascending canonical
 * order (stable sort), so it binds the logical ledger: a content edit,
 * a replay, a foreign insertion, or a truncation changes the recomputed
 * head; a pure reordering of distinct-timestamp records is a no-op the
 * app cannot even observe (every read sorts), and a swap of two
 * equal-timestamp records stays visible through the stable sort.
 *
 * Threat model, stated honestly:
 *   - The chain detects any history change that did not go through a
 *     legit write path, because legit writes are the only re-seal points.
 *   - A party who can write BOTH the history and the meta head can
 *     re-seal — absence of an external witness cannot be fixed on
 *     device. The real witness is the user's own encrypted export: the
 *     v4 envelope carries the chain head, so a backup taken earlier
 *     detects later tampering. Zero cloud witness, the anchor lives in
 *     the user's hand.
 *   - The witness freeze rule: a save that observes a pre-state which
 *     does not match the sealed head must NOT re-seal (sealing would
 *     bless the tampered content and destroy the evidence). The head
 *     stays frozen at the last verified state until the user re-anchors
 *     deliberately — importing their own backup or clearing the ledger.
 *
 * This module is a dependency leaf: db (meta store), storage (history
 * key), at-rest-state (seal tag, session flag), and the record type.
 * The audit function that combines it with the validated read lives in
 * bmi-history.ts, so no import cycle exists.
 */

import { dbMetaGet, dbMetaSet } from './db';
import { STORAGE_KEYS, storageGetRaw, storageInvalidate } from './storage';
import { withLedgerLock } from './ledger-lock';
import { isAtRestTagged } from './at-rest-state';
import { isAtRestUnlocked } from './at-rest';
import { getWitnessKeyFingerprint, getWitnessMac, type WitnessMac } from './witness-key';
import { warnDev, warnDevOnce } from './warn-dev';
import type { BmiRecord } from '$lib/types/bmi-record';

/** IndexedDB meta key holding the sealed chain head (the witness). */
export const META_LEDGER_CHAIN = '__history_chain_head';

/** The seed the chain starts from; also the head of an empty ledger. */
const GENESIS_SEED = 'bmi-stellar-ledger-v4-genesis';

/**
 * The sealed witness: chain head plus the length it covers. A keyed
 * witness (night-frontier-Z6) carries `mode: 'keyed'` and the PUBLIC
 * key fingerprint `kf` (SHA-256 hex of the attestation key material),
 * so the reseat path proves the witness and the installed key belong to
 * the same passphrase before it recomputes anything. Legacy witnesses
 * and plaintext ledgers omit both fields - the plain SHA-256 chain
 * unchanged.
 */
export interface LedgerChain {
	head: string;
	length: number;
	mode?: 'keyed';
	kf?: string;
}

let genesisPromise: Promise<string> | null = null;

/** SHA-256 of the genesis seed — computed once per realm. */
function ledgerGenesis(): Promise<string> {
	if (!genesisPromise) {
		genesisPromise = sha256Hex(new TextEncoder().encode(GENESIS_SEED));
	}
	return genesisPromise;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer as ArrayBuffer);
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canonical serialization of one record: fixed key order, age omitted
 * when undefined. Two structurally identical records must produce the
 * same string no matter how their object keys were ordered.
 */
export function canonicalRecordJson(record: BmiRecord): string {
	return JSON.stringify({
		timestamp: record.timestamp,
		bmi: record.bmi,
		height: record.height,
		weight: record.weight,
		age: record.age
	});
}

/**
 * Compute the chain over the LOGICAL ledger: the records sorted ascending
 * by timestamp (stable, so equal-timestamp swaps stay visible). A pure
 * reordering of distinct-timestamp records is a logical no-op — the app
 * always reads ascending — so it must not flip the head; a content edit,
 * a replay, an insertion, or a truncation always does. Every legit writer
 * passes validated records; the sort here makes the chain independent of
 * each writer's local ordering.
 *
 * Mode contract (night-frontier-Z6): `'plain'` is the historical
 * SHA-256 chain — byte-identical, the export anchor and the
 * plaintext-ledger witness. `'keyed'` runs every record link under the
 * witness attestation key (HMAC-SHA256) and THROWS when no key is
 * installed: a caller that cannot attest must neither bless nor accuse.
 * The genesis link stays the plain seed digest in both modes — an empty
 * ledger has nothing to MAC, and the genesis is a public constant.
 */
export async function computeWitnessChain(
	records: BmiRecord[],
	mode: 'plain' | 'keyed'
): Promise<LedgerChain> {
	let mac: WitnessMac | null = null;
	if (mode === 'keyed') {
		mac = getWitnessMac();
		if (!mac) throw new Error('keyed witness chain requested without an attestation key');
	}
	let link = await ledgerGenesis();
	const ordered = [...records].sort((a, b) => a.timestamp - b.timestamp);
	for (const record of ordered) {
		const input = new TextEncoder().encode(`${link}:${canonicalRecordJson(record)}`);
		link = mac ? toHex(mac(input)) : await sha256Hex(input);
	}
	return { head: link, length: records.length };
}

/**
 * The plain chain — the byte-identical historical construction. The
 * export envelope (history-io v4) and every existing consumer keep this
 * exact contract: a portable, self-verifiable anchor that needs no key,
 * no session, and no device state.
 */
export async function computeLedgerChain(records: BmiRecord[]): Promise<LedgerChain> {
	return computeWitnessChain(records, 'plain');
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Read the sealed witness. Returns null when none exists (unanchored). */
export async function getSealedLedgerChain(): Promise<LedgerChain | null> {
	try {
		const raw = await dbMetaGet(META_LEDGER_CHAIN);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<LedgerChain>;
		if (typeof parsed.head !== 'string' || typeof parsed.length !== 'number') return null;
		// Fail-closed toward honesty: a keyed marker means keyed even when
		// the fingerprint field is damaged (the witness then reads as
		// attestable-by-nothing, never as a plain witness that could accuse
		// records with a recomputation the seal never ran), and any unknown
		// mode reads as no witness at all - unanchored, never violated.
		if (parsed.mode === 'keyed') {
			return {
				head: parsed.head,
				length: parsed.length,
				mode: 'keyed',
				kf: typeof parsed.kf === 'string' ? parsed.kf : undefined
			};
		}
		if (parsed.mode !== undefined) return null;
		return { head: parsed.head, length: parsed.length };
	} catch (err) {
		warnDev('ledger-continuity', 'getSealedLedgerChain', 'Failed to read the sealed witness', err);
		return null;
	}
}

// The witness is device state; overlapping legit writes must seal in the
// order they were decided, so every seal goes through one queue (the
// same per-key serialization discipline storage.ts uses for values).
// Cross-tab, the single-writer law (night-frontier-Z5) holds the
// origin-wide ledger lock across each legit write, so this per-realm
// queue only ever sees sections the lock has already ordered; the
// lock-free internals here run inside a held section.
let sealTask: Promise<void> = Promise.resolve();

function enqueueSeal(step: () => Promise<void>): Promise<void> {
	const run = sealTask.then(step, step);
	// The queue never rejects: a failed step degrades the witness to
	// unsealed (inside the step) and the chain continues.
	sealTask = run.catch(() => {});
	return run;
}

/**
 * Seal the witness for the given records (a legit re-anchor moment:
 * import, clear). The seal runs in the CURRENT attestation mode: keyed
 * when a witness key is installed, plain otherwise. Internal seal
 * failures degrade the witness to absent — "no anchor" is honest, a
 * stale anchor would be a false accusation.
 */
export function sealLedgerChain(records: BmiRecord[]): Promise<void> {
	return enqueueSeal(async () => {
		await sealWithCurrentMode(records);
	});
}

/** The seal itself, in the current attestation mode. */
async function sealWithCurrentMode(records: BmiRecord[]): Promise<void> {
	try {
		const mode = getWitnessMac() ? 'keyed' : 'plain';
		const chain = await computeWitnessChain(records, mode);
		const witness: LedgerChain =
			mode === 'keyed' ? { ...chain, mode, kf: getWitnessKeyFingerprint() ?? undefined } : chain;
		await dbMetaSet(META_LEDGER_CHAIN, JSON.stringify(witness));
	} catch (err) {
		warnDev(
			'ledger-continuity',
			'sealWithCurrentMode',
			'Witness seal failed — degrading to unanchored',
			err
		);
		await dbMetaSet(META_LEDGER_CHAIN, '').catch(() => {});
	}
}

/**
 * Tombstone the witness: an attestation state the ledger can no longer
 * vouch for (locked edge, passphrase rotation) reads as honestly
 * unanchored, never as a stale anchor that would accuse honest use.
 */
async function tombstoneWitness(reason: string): Promise<void> {
	warnDevOnce('ledger-continuity', 'tombstone', `Witness stepped aside: ${reason}`);
	await dbMetaSet(META_LEDGER_CHAIN, '').catch(() => {});
}

/**
 * The post-write witness update for a legit save: the transition is
 * blessed only when the pre-save state matches the sealed witness. On a
 * mismatch the witness stays frozen at the last verified state (the
 * freeze rule in the module doc) and the mismatch is reported.
 *
 * Never throws; runs through the seal queue.
 */
export function reseatLedgerChainAfterSave(
	preRecords: BmiRecord[],
	newRecords: BmiRecord[]
): Promise<void> {
	return enqueueSeal(async () => {
		let sealed: LedgerChain | null;
		try {
			sealed = await getSealedLedgerChain();
		} catch (err) {
			warnDev('ledger-continuity', 'reseatLedgerChainAfterSave', 'Witness read failed', err);
			return;
		}
		if (sealed === null) {
			// Unanchored (fresh device or degraded seal): anchor now.
			await sealWithCurrentMode(newRecords);
			return;
		}
		// Night-frontier-Z6: the pre-state recomputes under the SEALED
		// witness's attestation mode, never the current one - the blessing
		// compares like with like.
		if (sealed.mode === 'keyed') {
			const kf = getWitnessKeyFingerprint();
			if (!getWitnessMac() || kf !== sealed.kf) {
				// The attestation key is gone or belongs to another passphrase
				// (locked edge, passphrase rotation). The witness can neither
				// verify this pre-state nor accuse it - it steps aside to
				// honestly unanchored, and the next legit save re-anchors.
				// The external witness (the user's own v4 export, a plain
				// anchor) is untouched by this.
				await tombstoneWitness('attestation key unavailable or rotated');
				return;
			}
		}
		const pre = await computeWitnessChain(preRecords, sealed.mode === 'keyed' ? 'keyed' : 'plain');
		if (pre.head === sealed.head && pre.length === sealed.length) {
			await sealWithCurrentMode(newRecords);
			return;
		}
		warnDevOnce(
			'ledger-continuity',
			'reseat',
			'Continuity witness mismatch — history changed outside a legit write; witness stays frozen'
		);
	});
}

/** @internal Test-only: resolve when all queued witness work has drained. */
export function _drainLedgerContinuityForTesting(): Promise<void> {
	return sealTask.then(
		() => {},
		() => {}
	);
}

/**
 * Clear the history key and seal the empty-ledger witness (genesis/0).
 * The explicit reset moment: the user chose to start a fresh ledger.
 * night-frontier-Z5: removal and the genesis seal hold the ledger lock
 * as one critical section, and the same-realm cache entry drops with
 * the mirror — a cleared ledger must read as cleared in this realm
 * immediately, or the next legit save would merge over a stale
 * pre-state and freeze the witness against honest use.
 */
export async function clearLedgerHistory(): Promise<void> {
	await withLedgerLock(async () => {
		storageRemoveHistory();
		storageInvalidate(STORAGE_KEYS.HISTORY);
		await sealLedgerChain([]);
	});
}

function storageRemoveHistory(): void {
	// Local import keeps this leaf free of the storage barrel's write
	// surface; removal is the one operation the clear path needs.
	try {
		localStorage.removeItem(STORAGE_KEYS.HISTORY);
	} catch (err) {
		warnDev('ledger-continuity', 'clearLedgerHistory', 'History removal failed', err);
	}
}

/**
 * Whether the stored history value is an at-rest envelope the current
 * session cannot open (locked). The audit surfaces this as
 * `sealed-opaque`: continuity cannot be measured through a sealed value,
 * and a sealed value must never be misread as tampered.
 */
export function isHistorySealedOpaque(): boolean {
	try {
		// Raw read on purpose: storageGet translates a sealed value into
		// null (locked-read semantics), which would mask exactly the state
		// this check exists to report.
		const raw = storageGetRaw(STORAGE_KEYS.HISTORY);
		return raw !== null && isAtRestTagged(raw) && !isAtRestUnlocked();
	} catch (err) {
		warnDev('ledger-continuity', 'isHistorySealedOpaque', 'Raw history read failed', err);
		return false;
	}
}
