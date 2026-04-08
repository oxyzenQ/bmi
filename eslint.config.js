import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
        includeIgnoreFile(gitignorePath),
        js.configs.recommended,
        ...ts.configs.recommended,
        ...svelte.configs.recommended,
        prettier,
        ...svelte.configs.prettier,
        {
                languageOptions: {
                        globals: { ...globals.browser, ...globals.node }
                },
                rules: {
                        'no-undef': 'off',
                        'svelte/no-at-html-tags': 'off',
                        'svelte/no-dom-manipulating': 'off',
                        '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
                        // Catch potential bugs with implicit type coercion
                        'no-implicit-coercion': ['warn', { 'boolean': true, 'number': true, 'string': true }]
                }
        },
        {
                files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
                languageOptions: {
                        parserOptions: {
                                projectService: true,
                                tsconfigRootDir: import.meta.dirname,
                                extraFileExtensions: ['.svelte'],
                                parser: ts.parser,
                                svelteConfig
                        }
                },
                rules: {
                        '@typescript-eslint/no-unused-vars': 'off'
                }
        },
        {
                files: ['**/*.test.ts', '**/*.test.js'],
                rules: {
                        '@typescript-eslint/no-unused-vars': 'off'
                }
        }
);
