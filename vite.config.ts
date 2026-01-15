import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
	plugins: [
		sveltekit(),
		...(mode === 'analyze'
			? [
					visualizer({
						filename: 'stats.html',
						template: 'treemap',
						gzipSize: true,
						brotliSize: true,
						open: false
					})
				]
			: [])
	],
	build: {
		target: 'es2022',
		minify: 'esbuild',
		sourcemap: false
	}
}));
