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
import { computeChainSync } from './ledger-chain';
import {
	readVaultWitness,
	recordsAgainstChain,
	parseWitnessRaw,
	isSealFailedWitnessRaw,
	SEAL_FAILED_WITNESS,
	type LedgerChain
} from './ledger-vault-anchor';
import { warnDev, warnDevOnce } from './warn-dev';
import type { BmiRecord } from '$lib/types/bmi-record';

/** IndexedDB meta key holding the sealed chain head (the witness). */
export const META_LEDGER_CHAIN = '__history_chain_head';

/**
 * The sealed witness shape. Defined in ledger-vault-anchor.ts (the
 * tri-home bridge, night-frontier-Z7) and re-exported here so every
 * existing import path keeps working.
 */
export type { LedgerChain } from './ledger-vault-anchor';

/**
 * Canonical serialization of one record: fixed key order, age omitted
 * when undefined. Two structurally identical records must produce the
 * same string no matter how their object keys were ordered.
 *
 * The chain MATH itself (genesis, links, the sync engine and its sound
 * checkpoint cache) lives in ledger-chain.ts (night-frontier-Z6, A2);
 * this module keeps the witness state machine and re-exports the math
 * surface so every existing import path keeps working.
 */
export { canonicalRecordJson } from './ledger-chain';

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
 *
 * A2: the computation is fully synchronous (the checkpoint engine) and
 * the async signature stays for every existing caller.
 */
export async function computeWitnessChain(
	records: BmiRecord[],
	mode: 'plain' | 'keyed'
): Promise<LedgerChain> {
	let mac: WitnessMac | null = null;
	let fingerprint: string | null = null;
	if (mode === 'keyed') {
		mac = getWitnessMac();
		if (!mac) throw new Error('keyed witness chain requested without an attestation key');
		fingerprint = getWitnessKeyFingerprint();
	}
	return computeChainSync(records, mode, mac, fingerprint);
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

/** Read the sealed witness. Returns null when none exists (unanchored). */
export async function getSealedLedgerChain(): Promise<LedgerChain | null> {
	try {
		const raw = await dbMetaGet(META_LEDGER_CHAIN);
		if (!raw) return null;
		return parseWitnessRaw(raw);
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
			'Witness seal failed — degrading to the typed seal-failure marker',
			err
		);
		// Night-frontier-Z9: a seal FAILURE writes the typed marker, not the
		// empty string — "I failed to witness" is a different statement from
		// "I am not here" (a deliberate tombstone), and the audit plus the
		// vault-veto path can now tell them apart by name. Both read as no
		// witness to every consumer (fail-closed, pre-Z9 behavior).
		await dbMetaSet(META_LEDGER_CHAIN, SEAL_FAILED_WITNESS).catch(() => {});
	}
}

/**
 * Whether the meta witness entry is the typed seal-failure marker
 * (night-frontier-Z9): the ledger DID try to witness and the seal
 * failed — a seal-degraded state, distinct from a deliberate wipe (the
 * empty-string tombstone) and from a live witness. The audit surfaces
 * this as `sealDegraded` next to its `unanchored` state.
 */
export async function isLedgerWitnessSealDegraded(): Promise<boolean> {
	try {
		return isSealFailedWitnessRaw(await dbMetaGet(META_LEDGER_CHAIN));
	} catch (err) {
		warnDev('ledger-continuity', 'isLedgerWitnessSealDegraded', 'Witness marker read failed', err);
		return false;
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
 * The rotation-time verdict on the CURRENT witness (night-frontier-Z9).
 *
 * A passphrase rotation in an ALREADY-UNLOCKED session does not need the
 * old seal to die blind: the old attestation key is still installed, so
 * the ledger can be VERIFIED one last time under it and then re-anchored
 * under the new key in the same critical section — no blind window, no
 * lockout. The verdict applies the reseat law verbatim, mode-aware:
 *   - no witness: consult the vault copy before blessing anything (the
 *     Z7 tombstone-escape guard — a same-length disagreement vetoes).
 *   - keyed witness: it must be attestable under the CURRENT (old) key —
 *     the fingerprint must match, or the verdict is frozen (the witness
 *     can neither bless nor accuse a recomputation it cannot run).
 *   - either mode: the records must reproduce the sealed head exactly.
 *     A mismatch is the freeze rule, untouched: the witness stays at the
 *     last verified state as evidence (it will read witness-opaque under
 *     the new key; the next save's existing rotation path handles it), a
 *     re-anchor here would bless tampered content.
 *
 * Runs INSIDE the caller's ledger-lock section while the old key lives;
 * it never mutates witness state.
 */
export async function witnessRotationVerdict(
	records: BmiRecord[]
): Promise<{ kind: 'reanchor'; mode: 'keyed' | 'plain' } | { kind: 'frozen'; reason: string }> {
	const sealed = await getSealedLedgerChain();
	if (sealed === null) {
		// Unanchored: the vault copy speaks before anything is blessed (the
		// Z7 law a rotation must not escape either).
		const vault = await readVaultWitness();
		if (vault && vault.length === records.length) {
			const verdict = await recordsAgainstChain(records, vault);
			if (verdict === false) {
				return {
					kind: 'frozen',
					reason:
						'the vault anchor disagrees at the same length — re-anchoring would bless a changed ledger'
				};
			}
		}
		return { kind: 'reanchor', mode: 'plain' };
	}
	if (sealed.mode === 'keyed') {
		const kf = getWitnessKeyFingerprint();
		if (!getWitnessMac() || kf !== sealed.kf) {
			return { kind: 'frozen', reason: 'the old witness is not attestable in this session' };
		}
	}
	const computed = await computeWitnessChain(records, sealed.mode === 'keyed' ? 'keyed' : 'plain');
	if (computed.head === sealed.head && computed.length === sealed.length) {
		return { kind: 'reanchor', mode: sealed.mode === 'keyed' ? 'keyed' : 'plain' };
	}
	return {
		kind: 'frozen',
		reason: 'the ledger changed outside a legit write — the witness stays frozen as evidence'
	};
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
			// Unanchored: consult the vault mirror before blessing anything
			// (night-frontier-Z7, the tri-home witness). A wiped witness is
			// the one way the freeze rule could be escaped - the anchor
			// deleted instead of disobeyed. The OPFS vault copy survives
			// that wipe, so a same-length disagreement freezes the
			// re-anchor (blessing would destroy the vault's evidence; the
			// recovery stays the documented one - import your own v4
			// backup or clear the ledger). A stale copy (different length),
			// no vault, or an attestation state the bridge cannot compare
			// is silence, never evidence. The typed seal-failure marker
			// (Z9) names its own state: the meta entry says "I failed to
			// witness", not "I was wiped" — the veto below can say which.
			const vault = await readVaultWitness();
			if (vault && vault.length === preRecords.length) {
				const verdict = await recordsAgainstChain(preRecords, vault);
				if (verdict === false) {
					const sealDegraded = await isLedgerWitnessSealDegraded();
					warnDevOnce(
						'ledger-continuity',
						'vault-veto',
						sealDegraded
							? 'The vault anchor disagrees at the same length and the meta entry is a seal-failure marker — a degraded seal plus a changed ledger is exactly the suspicious edge; refusing to re-anchor (recovery: import your own v4 backup or clear the ledger)'
							: 'The vault anchor disagrees at the same length — the meta witness was wiped over a changed ledger; refusing to re-anchor (recovery: import your own v4 backup or clear the ledger)'
					);
					return;
				}
			}
			await sealWithCurrentMode(newRecords);
			return;
		}
		// Night-frontier-Z6: the pre-state recomputes under the SEALED
		// witness's attestation mode, never the current one - the blessing
		// compares like with like.
		if (sealed.mode === 'keyed') {
			const kf = getWitnessKeyFingerprint();
			if (!getWitnessMac()) {
				// Locked (or otherwise keyless) session: the witness can be
				// neither verified nor advanced - it STAYS, evidence
				// preserved. A refused write (the purge guard blocks locked
				// saves) must never reshape the witness: erasing a valid
				// keyed seal is exactly what an attacker wants and what the
				// P8 contract forbids. The audit reads this state as
				// witness-opaque, and the next unlock resumes attestability.
				return;
			}
			if (kf !== sealed.kf) {
				// The installed key belongs to another passphrase (rotation):
				// the old seal can never be verified again, so it steps aside
				// to honestly unanchored and the next legit save re-anchors
				// under the new key. The external witness (the user's own v4
				// export, a plain anchor) is untouched by this.
				await tombstoneWitness('attestation key rotated');
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
