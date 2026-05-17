// Copyright (c) 2025 - 2026 rezky_nightky
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeAll, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'path';

// Detect environment: node environment has no `window`, jsdom has it.
// history-io.test.ts uses @vitest-environment node for native crypto.subtle.
const hasDOM = typeof window !== 'undefined';

// Mock SvelteKit modules (works in both node and jsdom)
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

// ---------------------------------------------------------------------------
// Polyfill crypto.subtle for jsdom only
// ---------------------------------------------------------------------------
// In node environment, crypto.subtle is natively available — no polyfill needed.
// In jsdom 27+, window.crypto exists but its subtle may be non-functional.
// We only polyfill when jsdom is detected.
if (hasDOM) {
	const req = createRequire(path.resolve(process.cwd(), 'package.json'));

	(function polyfillCryptoSubtle() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const w = window as any;
		if (!w.crypto) return;

		let subtle: unknown;
		try {
			subtle = req('node:crypto')?.webcrypto?.subtle;
		} catch {
			/* not available */
		}
		if (!subtle) {
			try {
				subtle = req('crypto')?.webcrypto?.subtle;
			} catch {
				/* not available */
			}
		}

		if (!subtle) return;

		try {
			w.crypto.subtle = subtle;
		} catch {
			try {
				Object.defineProperty(w.crypto, 'subtle', {
					value: subtle,
					configurable: true,
					writable: true
				});
			} catch {
				/* non-extensible */
			}
		}
	})();
}

// Verify environment setup
beforeAll(() => {
	// Only check DOM in jsdom environment
	if (hasDOM && typeof document === 'undefined') {
		throw new Error('jsdom environment not properly configured');
	}
});

// Cleanup — only needed in DOM environment (Svelte component tests)
afterEach(() => {
	if (hasDOM) {
		cleanup();
	}
});