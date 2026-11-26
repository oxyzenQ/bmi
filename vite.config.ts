// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

import { sveltekit } from '@sveltejs/kit/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { type UserConfig, type Plugin } from 'vite';
import { createRequire } from 'node:module';
import { execFileSync } from 'child_process';
import { readFileSync } from 'node:fs';
import path from 'path';
import { extractChangelogHistory } from './src/lib/utils/changelog.ts';

/**
 * Pins resolution for @noble/hashes/argon2.js whose exports field
 * fails in some Vite versions during production builds.
 *
 * CRITICAL: createRequire MUST be scoped to the project root (process.cwd()),
 * NOT import.meta.url. Vite may bundle/relocate the config, and bun's
 * require won't walk up from a temp directory to find packages.
 */
function pinCryptoDeps(): Plugin {
	const projectRoot = process.cwd();
	const req = createRequire(path.resolve(projectRoot, 'package.json'));
	return {
		name: 'pin-crypto-deps',
		enforce: 'pre',
		resolveId(id) {
			if (id === '@noble/hashes/argon2.js') {
				return req.resolve('@noble/hashes/argon2.js');
			}
			if (id === '@zxcvbn-ts/core') {
				// Pin to ESM entry — CJS entry causes "exports is not defined" in browser
				return req.resolve('@zxcvbn-ts/core/dist/index.esm.js');
			}
			if (id === '@zxcvbn-ts/language-common') {
				return req.resolve('@zxcvbn-ts/language-common/dist/index.esm.js');
			}
		}
	};
}

/**
 * Serves the Keep-a-Changelog section for the current app version as a
 * virtual module (night-cafe-6). Every build re-reads CHANGELOG.md, so
 * the bundled section can never go stale and no generated artifact
 * needs syncing; the release ledger's "latest commit" churn stays out
 * of the UI. The section is resolved at build time and shipped offline
 * - the floating window needs no network and fetches nothing.
 */
function changelogLatest(): Plugin {
	const VIRTUAL_ID = 'virtual:changelog-latest';
	const RESOLVED_ID = '\0' + VIRTUAL_ID;
	return {
		name: 'changelog-latest',
		resolveId(id) {
			return id === VIRTUAL_ID ? RESOLVED_ID : null;
		},
		load(id) {
			if (id !== RESOLVED_ID) return null;
			const version = createRequire(path.resolve(process.cwd(), 'package.json'))(
				'./package.json'
			) as { version: string };
			const markdown = readFileSync(path.resolve(process.cwd(), 'CHANGELOG.md'), 'utf-8');
			const payload = {
				version: version.version,
				history: extractChangelogHistory(markdown)
			};
			return `export const changelogLatest = ${JSON.stringify(payload)};`;
		}
	};
}

// Get commit info — prefer Vercel env vars (reliable in Vercel builds),
// fall back to local git commands for local dev.
function getLocalGitInfo(): { sha: string; branch: string } {
	// Vercel injects these during builds; they are always accurate.
	const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
	const vercelRef = process.env.VERCEL_GIT_COMMIT_REF;

	// Use the full 40-character SHA so it can be exactly compared with the
	// GitHub API response (also 40 chars). Short SHA (7 chars) caused a
	// false-positive update loop because `===` could never match.
	const sha = vercelSha
		? vercelSha
		: (() => {
				try {
					return execFileSync('git', ['rev-parse', 'HEAD'], {
						encoding: 'utf-8',
						stdio: ['ignore', 'pipe', 'ignore']
					}).trim();
				} catch {
					return 'unknown';
				}
			})();

	const branch = vercelRef
		? vercelRef
		: (() => {
				try {
					return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
						encoding: 'utf-8',
						stdio: ['ignore', 'pipe', 'ignore']
					}).trim();
				} catch {
					return 'main';
				}
			})();

	return { sha, branch };
}

// Export async config function
export default function config({ mode }: { mode: string }): UserConfig {
	const commitInfo = getLocalGitInfo();
	// The application version rides a build-time constant on purpose.
	// Importing package.json for this one field inlines the whole
	// manifest - the author, the signature field, every contact URL -
	// into the client bundle as plaintext (night-netrunner-Z1).
	const appVersion = createRequire(path.resolve(process.cwd(), 'package.json'))(
		'./package.json'
	) as { version: string };

	return {
		plugins: [
			pinCryptoDeps(),
			changelogLatest(),
			sveltekit(),
			...(mode === 'analyze'
				? [
						visualizer({
							filename: '.reports/stats.html',
							template: 'treemap',
							gzipSize: true,
							brotliSize: true,
							open: false
						})
					]
				: [])
		],
		define: {
			__GIT_COMMIT_ID__: JSON.stringify(commitInfo.sha),
			__GIT_BRANCH__: JSON.stringify(commitInfo.branch),
			__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
			__IS_VERCEL_DEPLOYMENT__: JSON.stringify(process.env.VERCEL === '1'),
			__APP_VERSION__: JSON.stringify(appVersion.version)
		},
		build: {
			target: 'es2022',
			minify: 'esbuild',
			sourcemap: false,
			rollupOptions: {
				// The depth-strict build law: a build that prints a warning is
				// a failed build. Every bundler warning (chunk size, plugin
				// warning) becomes a hard error, so the verdict stays binary
				// and the build output stays clean.
				onwarn(warning) {
					throw new Error(
						`build warning treated as failure (warning = failed law): ${warning.code ?? ''} ${warning.message}`
					);
				}
			},
			// 700 KB warning threshold catches real regressions early - and
			// through the onwarn law above, crossing it fails the build.
			// Known heavy lazy chunks (acceptable, under the cap):
			//   @zxcvbn-ts/language-common: ~465 KB raw / ~229 KB gzip (password dictionary)
			// These are dynamically imported only when the encryption modal opens.
			chunkSizeWarningLimit: 700
		}
	};
}
