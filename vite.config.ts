import { sveltekit } from '@sveltejs/kit/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
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
	build: {
		target: 'es2022',
		minify: 'esbuild',
		sourcemap: false
	}
}));
