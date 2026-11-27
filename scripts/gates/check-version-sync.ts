// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * check-version-sync.ts - the version-surface parity gate
 * (night-improve-3, the family law added by night-cafe-mclaren-1).
 *
 * package.json is the single version source of truth. Every version
 * surface must carry the same version or the tree is not committable:
 *   - DORMANT.md              "Version: `X.Y.Z`" (the maintenance capsule)
 *   - README.md               "Current release: `vX.Y.Z`"
 *   - every family Cargo.toml the [package] version (dynamic discovery:
 *     the package.json name and its hyphenated descendants, wherever a
 *     manifest sits in the tree - a crate added tomorrow joins with no
 *     edit here), plus its committed Cargo.lock entry
 *
 * The law lives in src/lib/utils/version-family.ts (the pure core the
 * test battery pins); this file is the fail-closed CLI seat the doctor,
 * check-all, and CI run.
 *
 * A pre-release version (X.Y.Z-<suffix>, e.g. 80.0.0-night.1) is
 * legal on every surface - the suffix rides the same parity checks.
 *
 * Surfaces are probed honestly, the zelynic way: a surface that exists
 * but disagrees FAILS; a surface that does not exist at all is reported
 * as absent (a manifest this gate never policed is not one it fails
 * on).
 */

import { auditVersionSurfaces } from '../../src/lib/utils/version-family';

const audit = await auditVersionSurfaces(process.cwd());

for (const note of audit.notes) console.log(`note: ${note}`);

if (audit.violations.length > 0) {
	console.error('Version sync failed:');
	for (const violation of audit.violations) console.error(`- ${violation}`);
	process.exit(1);
}

console.log(
	`Version sync passed: package.json ${audit.appVersion} matches DORMANT.md, the README surface, and ${audit.family.length} family Cargo.toml surface(s).`
);
