// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

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

	// ---------------------------------------------------------------------------
	// Restore a functional localStorage when the host shadows it
	// ---------------------------------------------------------------------------
	// Node 26+ ships webstorage GA: a native `localStorage` binding exists
	// on the worker global with an undefined value until
	// --localstorage-file is provided (and pointing concurrent workers at
	// one shared runner-side file would break test isolation anyway).
	// Vitest's jsdom environment then drops jsdom's own storage:
	// getWindowKeys filters out window keys that already exist on the
	// global, so the key stays the native undefined binding and every
	// test that touches localStorage reads undefined. Node 26 exposes the
	// same broken state on `window` in this pool, so the storage cannot
	// be copied back from jsdom - install a per-file in-memory Storage
	// instead, matching jsdom's own unbacked-Map semantics. Node 24 and
	// older (no native binding) already get jsdom's storage from vitest,
	// making this guard a no-op there.
	if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
		const items = new Map<string, string>();
		const storage = {
			get length() {
				return items.size;
			},
			key(index: number) {
				return [...items.keys()][index] ?? null;
			},
			getItem(key: string) {
				return items.has(key) ? (items.get(key) as string) : null;
			},
			setItem(key: string, value: string) {
				items.set(key, String(value));
			},
			removeItem(key: string) {
				items.delete(key);
			},
			clear() {
				items.clear();
			}
		};
		Object.defineProperty(globalThis, 'localStorage', {
			value: storage,
			configurable: true,
			writable: true
		});
	}
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
