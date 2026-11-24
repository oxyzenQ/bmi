// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

import { createRequire } from 'node:module';
import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * The detached proof harness project (night-netrunner-Z2, D1).
 *
 * A dedicated vitest project, apart from the root test lane: the root
 * vitest.config.ts includes `src/**` only, so these harnesses never ride
 * the sampled tier's invocation. The detachment mirrors the zelynic
 * proofs-package shape - the instruments live apart, while every harness
 * imports the SAME source modules the app bundles, through relative
 * `../src/...` paths (the include law: a law the proofs verify is a law
 * the app runs - no copies, no re-implementations).
 *
 * Run: bun run test:proofs -- proofs/<harness>.test.ts
 * CI runs one invocation per harness (the proofs.yml matrix) so a verdict
 * is never lost to a sibling's budget.
 */
const req = createRequire(path.resolve(process.cwd(), 'package.json'));
// The config is bundled by vitest, so __dirname points at the proofs
// directory this file lives in - resolve the project root explicitly.
const ROOT = path.resolve(__dirname, '..');

export default defineConfig({
	define: {
		// The same build-time constant the root config injects, so any
		// transitively imported module reads the real version.
		__APP_VERSION__: JSON.stringify(req('./package.json').version)
	},
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['proofs/**/*.test.ts'],
		// The for-all tier quantifies over each law's full stated finite
		// domain inside the harness; a wide axis scan is still seconds, but
		// give it room above the sampled tier's 10 s.
		testTimeout: 60000
	},
	resolve: {
		alias: {
			$lib: path.resolve(ROOT, 'src/lib'),
			'$lib/*': path.resolve(ROOT, 'src/lib/*'),
			$app: path.resolve(ROOT, 'src/__mocks__/$app'),
			'$app/*': path.resolve(ROOT, 'src/__mocks__/$app/*')
		}
	}
});
