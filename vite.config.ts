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
				manualChunks: (id) => {
					// Separate svelte core for better caching
					if (id.includes('node_modules/svelte/')) {
						return 'svelte-vendor';
					}
					// Bundle other node_modules together
					if (id.includes('node_modules')) {
						return 'vendor';
					}
				},
				compact: true
			},
			treeshake: 'recommended'
		},
		chunkSizeWarningLimit: 500,
		reportCompressedSize: true,
		assetsInlineLimit: 4096
	},
	optimizeDeps: {
		include: ['svelte'],
		exclude: ['lucide-svelte'],
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
