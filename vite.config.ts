import { sveltekit } from '@sveltejs/kit/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { type UserConfig } from 'vite';
import { execSync } from 'child_process';

// Get commit info from local git (fast, no network needed)
function getLocalGitInfo(): { sha: string; branch: string } {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { sha, branch };
  } catch {
    return { sha: 'unknown', branch: 'main' };
  }
}

// Export async config function
export default function config({ mode }: { mode: string }): UserConfig {
  const commitInfo = getLocalGitInfo();

  return {
    plugins: [
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
