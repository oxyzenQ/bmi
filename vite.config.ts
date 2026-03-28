import { sveltekit } from '@sveltejs/kit/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { type UserConfig } from 'vite';

// GitHub repo info
const GITHUB_OWNER = 'oxyzenQ';
const GITHUB_REPO = 'bmi';
const GITHUB_BRANCH = 'main';

// Fetch latest commit from GitHub API
async function fetchGitHubCommit(): Promise<{ sha: string; branch: string }> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'bmi-calculator-build'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json() as { sha: string };
    return {
      sha: data.sha.substring(0, 7),
      branch: GITHUB_BRANCH
    };
  } catch (error) {
    console.warn('Failed to fetch from GitHub API, falling back to local git:', error);
    // Fallback to local git
    const { execSync } = await import('child_process');
    try {
      const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
      return { sha, branch };
    } catch {
      return { sha: 'unknown', branch: 'main' };
    }
  }
}

// Export async config function
export default async function config({ mode }: { mode: string }): Promise<UserConfig> {
  // Fetch commit info from GitHub API (or fallback to local)
  const commitInfo = await fetchGitHubCommit();

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
