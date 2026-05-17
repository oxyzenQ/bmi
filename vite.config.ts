// Copyright (c) 2025 - 2026 rezky_nightky
import { sveltekit } from '@sveltejs/kit/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { type UserConfig, type Plugin } from 'vite';
import { createRequire } from 'node:module';
import { execFileSync } from 'child_process';
import path from 'path';

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

// Get commit info — prefer Vercel env vars (reliable in Vercel builds),
// fall back to local git commands for local dev.
function getLocalGitInfo(): { sha: string; branch: string } {
        // Vercel injects these during builds; they are always accurate.
        const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
        const vercelRef = process.env.VERCEL_GIT_COMMIT_REF;

        const sha = vercelSha
                ? vercelSha.slice(0, 7)
                : (() => {
                                try {
                                        return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
                                } catch {
                                        return 'unknown';
                                }
                        })();

        const branch = vercelRef
                ? vercelRef
                : (() => {
                                try {
                                        return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
                                } catch {
                                        return 'main';
                                }
                        })();

        return { sha, branch };
}

// Export async config function
export default function config({ mode }: { mode: string }): UserConfig {
        const commitInfo = getLocalGitInfo();

        return {
                plugins: [
                        pinCryptoDeps(),
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
                        __BUILD_TIME__: JSON.stringify(new Date().toISOString())
                },
                build: {
                        target: 'es2022',
                        minify: 'esbuild',
                        sourcemap: false,
                        // 700 KB warning threshold catches real regressions early.
                        // Known heavy lazy chunks (acceptable):
                        //   @zxcvbn-ts/language-common: ~465 KB raw / ~229 KB gzip (password dictionary)
                        // These are dynamically imported only when the encryption modal opens.
                        chunkSizeWarningLimit: 700
                }
        };
}
