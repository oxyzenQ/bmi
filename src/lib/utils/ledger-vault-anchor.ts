// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The tri-home anchor bridge (night-frontier-Z7).
 *
 * The witness lives in three homes: the live IndexedDB meta entry (the
 * sealed witness), the IndexedDB backup rotation (each snapshot carries
 * the witness live at backup time), and the OPFS vault — the
 * flush()-mirrored latest snapshot (vault-backup.json). Z6 made the
 * witness keyed; Z7 makes the vault copy CONSUMED: it is the anchor a
 * meta-store wipe cannot destroy.
 *
 * The physics gap this closes: the freeze rule's one escape hatch was
 * deleting the witness itself. An out-of-band writer who rewrites the
 * history (at the same record length) and tombstones the meta entry
 * never faces a mismatch — the next legit save sees no witness and
 * re-anchors over the rewritten records, blessing them. The vault copy
 * survives that wipe: the reseat path consults it before any
 * unanchored re-anchor, and a same-length disagreement freezes the
 * re-anchor (blessing would destroy the vault's evidence). Recovery
 * stays the documented one: import your own v4 backup or clear the
 * ledger.
 *
 * Honest limits, in the same breath:
 *   - The vault witness is as fresh as the last backup — stale by
 *     design. A stale copy (different length) is silence, never
 *     evidence: the ledger may have legitimately grown since.
 *   - A keyed vault witness compares only under its own attestation
 *     key; without the key the bridge answers 'unknown' — it can
 *     neither bless nor accuse what it cannot attest.
 *   - A same-length disagreement freezes but cannot by itself separate
 *     tamper from the rare honest edge (a seal-failure tombstone plus
 *     an in-place edit between backup and save) — the freeze is the
 *     existing rule's spirit applied to a wiped witness: preserve the
 *     vault's evidence, let the user re-anchor deliberately. The edge
 *     is named in the ledger docs, not hidden.
 */

import { readVaultWitnessRaw } from './vault-backup';
import { computeChainSync, type ChainHead } from './ledger-chain';
import { getWitnessKeyFingerprint, getWitnessMac, type WitnessMac } from './witness-key';
import { warnDev } from './warn-dev';
import type { BmiRecord } from '$lib/types/bmi-record';

/**
 * The sealed witness: chain head plus the length it covers. A keyed
 * witness carries `mode: 'keyed'` and the public key fingerprint `kf`.
 * Lives here (the bridge) and is re-exported by ledger-continuity for
 * every existing import path.
 */
export interface LedgerChain {
	head: string;
	length: number;
	mode?: 'keyed';
	kf?: string;
}

/**
 * The TYPED seal-failure marker (night-frontier-Z9): what the meta
 * witness entry holds when a seal attempt itself failed, instead of the
 * empty string a deliberate tombstone writes. The distinction is the
 * honesty sharpener — "I failed to witness" is a different statement
 * from "I am not here", and the audit plus the vault-veto path can now
 * say which one they are looking at (the Z7 honest edge — a seal-failure
 * tombstone plus an in-place edit — is nameable instead of reading
 * identically to a wiped witness). Fail-closed by construction: the
 * marker carries no head and no length, so every witness consumer reads
 * it as NO WITNESS (unanchored, never violated) — pre-Z9 data and
 * unknown shapes keep the exact same behavior.
 */
export const SEAL_FAILED_WITNESS = '{"t":"seal-failed"}';

/** True when a raw witness entry is the typed seal-failure marker. */
export function isSealFailedWitnessRaw(raw: string | null | undefined): boolean {
	return typeof raw === 'string' && raw === SEAL_FAILED_WITNESS;
}

/**
 * Parse a raw witness JSON string into a LedgerChain. Fail-closed
 * toward honesty: a keyed marker means keyed even when the fingerprint
 * field is damaged (the witness then reads as attestable-by-nothing,
 * never as a plain witness that could accuse records with a
 * recomputation the seal never ran), the seal-failure marker reads as
 * no witness at all (it is a statement about the seal, not an anchor),
 * and any unknown mode reads as no witness at all - unanchored, never
 * violated.
 */
export function parseWitnessRaw(raw: string): LedgerChain | null {
	if (isSealFailedWitnessRaw(raw)) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<LedgerChain>;
		if (typeof parsed.head !== 'string' || typeof parsed.length !== 'number') return null;
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
		warnDev('ledger-vault-anchor', 'parseWitnessRaw', 'Failed to read a witness copy', err);
		return null;
	}
}

/**
 * The vault witness copy: the OPFS flush mirror of the latest backup
 * snapshot carries the witness that was live at backup time. Null when
 * the vault is absent, unreadable, predates the witness, or the
 * platform has no OPFS - the honest "no second home".
 */
export async function readVaultWitness(): Promise<LedgerChain | null> {
	const raw = await readVaultWitnessRaw();
	if (raw === null) return null;
	return parseWitnessRaw(raw);
}

/**
 * Compare records against a witness anchor, mode-aware (the reseat and
 * audit laws recompute under the SEALED witness's mode, never the
 * current one). Resolves true (the records reproduce the anchor), false
 * (they provably do not), or 'unknown' (a keyed anchor without its
 * attestation key or under a rotated one: the comparison cannot run, so
 * it can neither bless nor accuse).
 */
export async function recordsAgainstChain(
	records: BmiRecord[],
	anchor: LedgerChain
): Promise<boolean | 'unknown'> {
	let mac: WitnessMac | null = null;
	let fingerprint: string | null = null;
	if (anchor.mode === 'keyed') {
		mac = getWitnessMac();
		if (!mac) return 'unknown';
		fingerprint = getWitnessKeyFingerprint();
		if (fingerprint !== anchor.kf) return 'unknown';
	}
	const computed: ChainHead = computeChainSync(
		records,
		anchor.mode === 'keyed' ? 'keyed' : 'plain',
		mac,
		fingerprint
	);
	return computed.head === anchor.head && computed.length === anchor.length;
}
