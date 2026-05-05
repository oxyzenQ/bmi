import { sveltekit } from '@sveltejs/kit/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { type UserConfig, type Plugin } from 'vite';
import { createRequire } from 'node:module';
import { execFileSync } from 'child_process';

/**
 * Pins resolution for @noble/hashes/argon2.js whose exports field
 * fails in some Vite versions during production builds.
 *
 * Uses Node's require.resolve (via createRequire) instead of
 * hardcoded node_modules paths — works regardless of package manager
 * layout (flat, hoisted, bun cache, symlinks).
 */
function pinCryptoDeps(): Plugin {
  const req = createRequire(import.meta.url);
  return {
    name: 'pin-crypto-deps',
    enforce: 'pre',
    resolveId(id) {
      if (id === '@noble/hashes/argon2.js') {
        return req.resolve('@noble/hashes/argon2.js');
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
          return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim();
        } catch {
          return 'unknown';
        }
      })();

  const branch = vercelRef
    ? vercelRef
    : (() => {
        try {
          return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf-8' }).trim();
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
      sourcemap: false
    }
  };
}
