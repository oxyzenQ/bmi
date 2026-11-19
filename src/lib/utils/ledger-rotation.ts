// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The unlocked-rotation re-seal (night-frontier-Z9).
 *
 * The gap this closes, stated from the source: enableEncryption() with a
 * new passphrase used to clear the session FIRST (the old seal key and
 * witness key die), so the next legit save's reseat found a `kf` mismatch
 * and tombstoned the witness — and every value sealed under the old key
 * became permanent-opaque under the new one (the rotation lockout). The
 * blind window between the rotation and the next legit save was the one
 * moment tampering could happen unobserved.
 *
 * The deeper route, when the rotation happens in an ALREADY-UNLOCKED
 * session: the old key does not need to die blind. Both keys are alive
 * for one critical section, so the rotation can:
 *   1. verify the current ledger one last time UNDER THE OLD KEY (the
 *      `witnessRotationVerdict` law — mode-aware, vault-veto parity),
 *   2. capture the plaintext of every health key the unlocked refresh
 *      already opened (no lockout: nothing stays sealed-forever),
 *   3. swap the seats (old wiped, new derived),
 *   4. re-seal the captured values under the NEW seat,
 *   5. re-anchor the witness under the NEW key over the verified records.
 * All five ride ONE `withLedgerLock` section (the commitImportedRecords
 * pattern), so a concurrent legit write can never interleave between the
 * verification and the re-anchor.
 *
 * Honest boundaries, in the same breath:
 *   - A verdict of `frozen` (old head mismatch, unattestable old witness,
 *     or the vault veto) NEVER re-anchors — the freeze rule is untouched,
 *     the witness stays as evidence. The VALUES still re-seal: persistence
 *     is not blessing, and the user keeps access to their own data.
 *   - A rotation while LOCKED runs the honest route this module replaces
 *     nothing of: the tombstone path stays exactly as it was.
 *   - A value the old session could not open (corrupt envelope) cannot be
 *     captured — it stays sealed-opaque under the new key too.
 *   - The re-seal is the ordinary storageSet path (fresh IV per value,
 *     fail-open to plaintext on seal failure with a dev warning — data
 *     preservation beats encryption coverage, as documented).
 */

import { clearAtRestSession, registerAtRestSession } from './at-rest';
import { sealLedgerChain, witnessRotationVerdict } from './ledger-continuity';
import { withLedgerLock } from './ledger-lock';
import { storageRefreshAtRestCache, storageSet, getAtRestCachePlaintext } from './storage';
import { getAtRestHealthKeys } from './at-rest-state';
import { refreshHealthKeysFromMirror } from './storage-coherence';
import { readBmiHistory } from './bmi-history';
import { warnDevOnce } from './warn-dev';

/**
 * Rotate the at-rest session to a NEW passphrase while the session is
 * already unlocked (the caller proved the passphrase moment by enabling
 * encryption). Verify → capture → swap → re-seal → re-anchor, all inside
 * one ledger-lock section. Throws when the new session fails to register
 * (the caller decides the fallback — the same contract as the old path);
 * witness verdicts never throw.
 */
export async function rotateUnlockedAtRestSession(passphrase: string): Promise<void> {
	await withLedgerLock(async () => {
		// Freshness first (the commitImportedRecords law): the merge base and
		// the verified records must be the freshest cross-tab state.
		await refreshHealthKeysFromMirror();
		const records = readBmiHistory();
		const verdict = await witnessRotationVerdict(records);
		// Capture while the OLD key still answers: every health key the
		// unlocked refresh already opened lives in the cache.
		const plaintexts = new Map<string, string>();
		for (const key of getAtRestHealthKeys()) {
			const plaintext = getAtRestCachePlaintext(key);
			if (plaintext !== null) plaintexts.set(key, plaintext);
		}
		// The seat swap: the old key's job is done (verified + captured).
		clearAtRestSession();
		await registerAtRestSession(passphrase);
		// Re-seal under the NEW seat — no lockout: every captured value
		// returns to sealed-at-rest under the new key (fresh IV per value).
		for (const [key, plaintext] of plaintexts) {
			storageSet(key, plaintext, { skipBackup: true });
		}
		await storageRefreshAtRestCache();
		// The re-anchor the old route deferred to a blind window: the same
		// verified records, attested under the NEW key, inside this section.
		if (verdict.kind === 'reanchor') {
			await sealLedgerChain(records);
		} else {
			warnDevOnce(
				'ledger-rotation',
				'rotation-frozen',
				`Rotation re-sealed the values but left the witness untouched: ${verdict.reason}`
			);
		}
	});
}
