import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte({ hot: false, preprocess: vitePreprocess() })],
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test-setup.ts'],
		globals: true,
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	resolve: {
		conditions: ['browser']
	}
});
