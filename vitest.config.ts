import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createRequire } from 'node:module';
import path from 'path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Custom Vite plugin that pins resolution for packages whose exports
 * fields are ignored by vitest's bundled Vite when conditions:['browser']
 * is set.
 *
 * Uses Node's require.resolve instead of hardcoded paths so it works
 * regardless of node_modules layout (flat, hoisted, bun cache, symlinks).
 */
function pinCryptoDeps(): Plugin {
	// createRequire is scoped to this config file's directory (= project root)
	const req = createRequire(import.meta.url);

	return {
		name: 'pin-crypto-deps',
		enforce: 'pre',
		resolveId(id) {
			if (id === '@noble/hashes/argon2.js') {
				return req.resolve('@noble/hashes/argon2.js');
			}
			if (id === 'zxcvbn-ts') {
				return req.resolve('zxcvbn-ts');
			}
		}
	};
}

export default defineConfig({
	// @ts-expect-error - Vite version mismatch between vitest and project
	plugins: [svelte({ hot: false }), pinCryptoDeps()],
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test-setup.ts'],
		globals: true,
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	resolve: {
		alias: {
			'$lib': path.resolve(__dirname, 'src/lib'),
			'$lib/*': path.resolve(__dirname, 'src/lib/*'),
			'$app': path.resolve(__dirname, 'src/__mocks__/$app'),
			'$app/*': path.resolve(__dirname, 'src/__mocks__/$app/*')
		},
		conditions: ['browser']
	}
});
