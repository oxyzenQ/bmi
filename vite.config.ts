import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	build: {
		// Production optimizations
		target: 'es2022', // Latest modern browsers for smaller output
		minify: 'esbuild', // Fast minification
		cssMinify: 'lightningcss', // Faster CSS minification
		sourcemap: false, // Disable sourcemaps for smaller builds
		cssCodeSplit: true, // Split CSS for better caching
		rollupOptions: {
			output: {
				// Optimize chunk splitting
				manualChunks: {
						// Vendor chunks for better caching
					'svelte-vendor': ['svelte'],
					'icons': ['lucide-svelte']
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
		// Asset inlining threshold (bytes) - inline small assets
		assetsInlineLimit: 8192, // 8KB threshold for better performance
	},
	optimizeDeps: {
		// Pre-bundle dependencies for faster dev server
		include: ['svelte', 'lucide-svelte'],
		exclude: [], // Exclude nothing
		// Esbuild options
		esbuildOptions: {
			target: 'es2022'
		}
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
