import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Static build configuration for GitHub Releases.
 *
 * Used exclusively by .github/workflows/release.yml to produce
 * standalone HTML/CSS/JS artifacts (no server required).
 *
 * IMPORTANT: Do NOT import this config in the main svelte.config.js.
 * The Vercel deployment uses the default adapter-vercel config.
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		})
	}
};

export default config;
