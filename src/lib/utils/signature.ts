// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The BMI Stellar depth signature (night-signature-1).
 *
 * One canonical attribution string, embedded at every recorded depth of
 * the project so a copied, stripped, or re-branded build cannot
 * silently masquerade as the original:
 *
 *   - src/lib/components/sections/AboutSection.svelte  (the About UI row)
 *   - src/app.html                                     (the author meta)
 *   - static/manifest.json                             (the PWA manifest)
 *   - package.json                                     (the package manifest)
 *   - scripts/build.sh                                 (the -V/--version banner)
 *   - src/service-worker.ts                            (the offline shell footer)
 *   - scripts/gates/check-signature.ts                 (the fail-closed gate)
 *
 * Stripping the signature means editing the gate too - a visible diff
 * in the repository's own history, never a silent one. The honest
 * limit, stated plainly: an attacker holding the full source can
 * reword anything; the AGPL-3.0-only license and TRADEMARK.md make the
 * legal cost of doing it real, and the gate makes it loud.
 */

export const BMI_STELLAR_SIGNATURE_BUILDER = 'rezky_nightky (oxyzenQ)' as const;
export const BMI_STELLAR_SIGNATURE_YEAR = '2026' as const;
// The canonical string is a literal anchor on purpose - the signature
// gate greps for exactly this string in this exact file.
export const BMI_STELLAR_SIGNATURE = 'rezky_nightky (oxyzenQ) 2026' as const;
