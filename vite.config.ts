import { sveltekit } from '@sveltejs/kit/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { type UserConfig, type Plugin } from 'vite';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * Pins resolution for packages whose exports fields fail in some
 * Vite versions during both test and production builds.
 * Uses enforce:'pre' resolveId hook — fires BEFORE any package.json
 * exports lookup, so it works across all Vite versions.
 */
function pinCryptoDeps(): Plugin {
  return {
    name: 'pin-crypto-deps',
    enforce: 'pre',
    resolveId(id) {
      if (id === '@noble/hashes/argon2.js') {
        return path.resolve(__dirname, 'node_modules/@noble/hashes/argon2.js');
      }
      if (id === 'zxcvbn-ts') {
        return path.resolve(__dirname, 'node_modules/zxcvbn-ts/dist/esm/index.js');
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
