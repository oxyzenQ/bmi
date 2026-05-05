import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import { webcrypto } from 'node:crypto';

// Mock SvelteKit modules
vi.mock('$app/environment', () => ({
        browser: true,
        dev: false,
        building: false,
        version: 'test'
}));

vi.mock('$app/stores', () => ({
        page: { subscribe: vi.fn() },
        navigating: { subscribe: vi.fn() },
        updated: { subscribe: vi.fn() }
}));

// Polyfill crypto.subtle in jsdom — jsdom provides window.crypto but NOT
// window.crypto.subtle. The production app always runs in a browser where
// crypto.subtle is available. In test (jsdom), we bridge the gap by
// exposing Node.js's WebCrypto API on the window object.
//
// Uses node:crypto.webcrypto as the primary source (available in all Node 18+
// and Bun versions). Falls back to globalThis.crypto.subtle (Node 20+/Bun).
// Handles cases where window.crypto may be frozen or non-extensible.
if (typeof window !== 'undefined' && !window.crypto?.subtle) {
        const subtle =
                (webcrypto as unknown as { subtle?: unknown })?.subtle ??
                (globalThis.crypto as unknown as { subtle?: unknown })?.subtle;

        if (subtle) {
                try {
                        Object.defineProperty(window.crypto, 'subtle', {
                                value: subtle,
                                configurable: true,
                                writable: true,
                        });
                } catch {
                        // window.crypto may be frozen — replace entire crypto object
                        try {
                                const patched = Object.assign({}, window.crypto, { subtle });
                                Object.defineProperty(window, 'crypto', {
                                        value: patched,
                                        configurable: true,
                                        writable: true,
                                });
                        } catch {
                                console.warn(
                                        '[test-setup] WARNING: Could not polyfill crypto.subtle. ' +
                                        'Tests using WebCrypto (HMAC, AES-GCM) will fail.',
                                );
                        }
                }
        }
}

// Setup jsdom environment
beforeAll(() => {
        if (typeof document === 'undefined') {
                throw new Error('jsdom environment not properly configured');
        }
});

// Cleanup after each test
afterEach(() => {
        cleanup();
});
