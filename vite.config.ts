import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	build: {
		// Production optimizations
		target: 'es2020', // Modern browsers + Tauri WebView
		minify: 'esbuild', // Fast minification
		cssMinify: true,
		sourcemap: false, // Disable sourcemaps for smaller builds
		rollupOptions: {
			output: {
				// Optimize chunk splitting
				manualChunks: {
					// Vendor chunks for better caching
					'svelte-core': ['svelte', 'svelte/internal'],
					'lucide': ['lucide-svelte']
				},
				// Smaller output file names
				compact: true,
				// Asset file names
				assetFileNames: 'assets/[name]-[hash][extname]',
				chunkFileNames: 'chunks/[name]-[hash].js',
				entryFileNames: 'entries/[name]-[hash].js'
			}
		},
		// Chunk size warning limit
		chunkSizeWarningLimit: 600,
		// Report compressed size
		reportCompressedSize: true,
		// Asset inlining threshold (bytes)
		assetsInlineLimit: 4096
	},
	optimizeDeps: {
		// Pre-bundle dependencies
		include: ['svelte', 'lucide-svelte'],
		// Force optimize
		force: false
	},
	server: {
		// Development server optimizations
		fs: {
			strict: true
		},
		hmr: {
			overlay: true
		}
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test-setup.ts'],
		globals: true,
		deps: {
			optimizer: {
				web: {
					include: ['svelte', '@testing-library/svelte']
				}
			}
		}
	}
});
