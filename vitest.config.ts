import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createRequire } from 'node:module';
import path from 'path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Custom Vite plugin that pins resolution for packages whose exports
 * fields are ignored by vitest's bundled Vite when conditions:['browser']
 * is set.
 *
 * CRITICAL: createRequire MUST be scoped to the project root (process.cwd()),
 * NOT import.meta.url. Vitest bundles this config to node_modules/.vite-temp/
 * and bun's require won't walk up from there to find packages in the
 * parent node_modules directory.
 */
function pinCryptoDeps(): Plugin {
        // Scope require to project root — process.cwd() is always the project dir
        const projectRoot = process.cwd();
        const req = createRequire(path.resolve(projectRoot, 'package.json'));

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
                include: ['src/**/*.{test,spec}.{js,ts}'],
                testTimeout: 15000, // v16.0: increased for Argon2id (64 MiB, 3 iter) crypto operations
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
