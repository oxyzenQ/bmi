import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

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
// exposing Node.js's native WebCrypto API on the window object.
if (typeof window !== 'undefined' && !window.crypto?.subtle && typeof globalThis.crypto?.subtle !== 'undefined') {
  Object.defineProperty(window.crypto, 'subtle', {
    value: globalThis.crypto.subtle,
    configurable: true,
    writable: true
  });
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
