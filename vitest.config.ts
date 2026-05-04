import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
        // @ts-expect-error - Vite version mismatch between vitest and project
        plugins: [svelte({ hot: false })],
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
                // 'browser' for $app mocks, 'import' + 'default' so
                // @noble/hashes subpath exports (direct string mappings)
                // and zxcvbn-ts ESM resolve correctly in test runs.
                conditions: ['browser', 'import', 'default']
        }
});
