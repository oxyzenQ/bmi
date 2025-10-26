import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	build: {
		target: 'es2022',
		minify: 'esbuild',
		cssMinify: 'lightningcss',
		sourcemap: false,
		cssCodeSplit: true,
		rollupOptions: {
			output: {
				manualChunks: {
					'svelte-vendor': ['svelte'],
					'icons': ['lucide-svelte']
				},
				compact: true
			}
		},
		chunkSizeWarningLimit: 600,
		reportCompressedSize: true,
		assetsInlineLimit: 8192
	},
	optimizeDeps: {
		include: ['svelte', 'lucide-svelte'],
		esbuildOptions: {
			target: 'es2022'
		}
	},
	server: {
		fs: {
			strict: true
		},
		hmr: {
			overlay: true
		}
	}
});
