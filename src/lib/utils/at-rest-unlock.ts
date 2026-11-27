// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// Night-cafe-10: the cold-load unlock door.
//
// Since night-cafe-9 the ledger stays plaintext unless the user
// deliberately enables encryption - but a user who did enable it can
// still cold-load into a sealed, locked ledger: reads return null and
// the purge guard holds new writes until a session key exists again.
// Until now the only door back was clearing all data. This module is
// the honest one: detect the sealed-and-locked state from the read
// caches, and hand the passphrase to unlockAtRestSessionIfVerified -
// the already-proven, verifier-checked seat installer.

import { isAtRestHealthKey, isAtRestTagged } from './at-rest-state';
import { isAtRestUnlocked } from './at-rest';
import { unlockAtRestSessionIfVerified } from './crypto';
import { STORAGE_KEYS, storageGetRaw } from './storage';

/**
 * True when the persistence layers hold sealed health data while no
 * at-rest session is unlocked - the cold-load strand the door exists
 * to open. Plaintext ledgers never trigger it, and non-health keys
 * (locale, wallpaper) are ignored even if a stray tagged value exists.
 * Dependencies are injectable so the suite pins the decision without
 * touching real storage.
 */
export function detectLockedSealedLedger(
	keys: readonly string[] = Object.values(STORAGE_KEYS),
	readRaw: (key: string) => string | null = storageGetRaw,
	unlocked: () => boolean = isAtRestUnlocked
): boolean {
	if (unlocked()) return false;
	return keys.some((key) => isAtRestHealthKey(key) && isAtRestTagged(readRaw(key)));
}

/**
 * Present the passphrase at the door. Delegates entirely to
 * unlockAtRestSessionIfVerified: the passphrase must prove itself
 * against the stored verifier before a seat installs, and a proven
 * unlock refreshes the read cache internally, so sealed values return
 * to the app the moment this resolves true.
 */
export async function attemptLedgerUnlock(passphrase: string): Promise<boolean> {
	return unlockAtRestSessionIfVerified(passphrase);
}
