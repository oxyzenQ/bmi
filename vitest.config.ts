import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Custom Vite plugin that pins resolution for packages whose exports
 * fields are ignored by vitest's bundled Vite when conditions:['browser']
 * is set. The resolveId hook fires BEFORE any package.json exports
 * lookup, so it works in every Vite version.
 */
function pinCryptoDeps(): Plugin {
	return {
		name: 'pin-crypto-deps',
		enforce: 'pre',
		resolveId(id) {
			if (id === '@noble/hashes/argon2.js') {
				return path.resolve(__dirname, 'node_modules/@noble/hashes/argon2.js');
			}
			if (id === 'zxcvbn-ts') {
				return path.resolve(__dirname, 'node_modules/zxcvbn-ts/dist/esm/index.js');
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
