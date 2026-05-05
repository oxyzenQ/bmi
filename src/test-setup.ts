import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import { createRequire } from 'node:module';
import path from 'path';

// Vitest bundles setup files to node_modules/.vite-temp/.
// createRequire MUST be scoped to project root (not import.meta.url)
// so bun's require can resolve packages in the parent node_modules.
const req = createRequire(path.resolve(process.cwd(), 'package.json'));

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

// ---------------------------------------------------------------------------
// Polyfill crypto.subtle for jsdom test environment
// ---------------------------------------------------------------------------
//
// jsdom 27+ provides window.crypto.getRandomValues() but its crypto.subtle
// implementation may be incomplete or non-functional. In bun 1.3.11,
// globalThis.crypto.subtle may also be absent.
//
// We unconditionally replace crypto.subtle with Node.js's working WebCrypto
// implementation to guarantee HMAC, AES-GCM, SHA-256 etc. work in tests.
//
// Sources tried (in order):
//   1. require('node:crypto').webcrypto.subtle  — Node.js compat layer
//   2. require('crypto').webcrypto.subtle         — Bun native
//   3. globalThis.crypto.subtle                   — Node 20+ / Bun 1.3.12+
(function polyfillCryptoSubtle() {
	if (typeof window === 'undefined') return;

	let subtle: unknown;

	// Source 1: node:crypto (Node.js compat)
	try {
		subtle = req('node:crypto')?.webcrypto?.subtle;
	} catch { /* not available */ }

	// Source 2: crypto (Bun native)
	if (!subtle) {
		try {
			subtle = req('crypto')?.webcrypto?.subtle;
		} catch { /* not available */ }
	}

	// Source 3: globalThis (Node 20+ / newer Bun)
	if (!subtle) {
		try {
			subtle = (globalThis as unknown as Record<string, unknown>)?.crypto
				? ((globalThis as unknown as Record<string, unknown>).crypto as Record<string, unknown>)?.subtle
				: undefined;
		} catch { /* not available */ }
	}

	if (!subtle) {
		console.error(
			'[test-setup] CRITICAL: Cannot obtain crypto.subtle from any source.\n' +
			'  require("node:crypto").webcrypto.subtle: unavailable\n' +
			'  require("crypto").webcrypto.subtle: unavailable\n' +
			'  globalThis.crypto.subtle: unavailable\n' +
			'WebCrypto-dependent tests (HMAC, AES-GCM) WILL fail.'
		);
		return;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const w = window as any;
	const g = globalThis as Record<string, unknown>;

	// Strategy 1: Direct property assignment on window.crypto
	try {
		w.crypto.subtle = subtle;
		if (w.crypto.subtle === subtle) return;
	} catch { /* property may be non-writable */ }

	// Strategy 2: Object.defineProperty on window.crypto
	try {
		Object.defineProperty(w.crypto, 'subtle', {
			value: subtle,
			configurable: true,
			writable: true
		});
		if (w.crypto.subtle === subtle) return;
	} catch { /* window.crypto may be sealed */ }

	// Strategy 3: Replace entire window.crypto object
	try {
		const patched = Object.assign({}, w.crypto, { subtle });
		Object.defineProperty(w, 'crypto', {
			value: patched,
			configurable: true,
			writable: true
		});
		if (w.crypto === patched) return;
	} catch { /* window.crypto may be non-configurable */ }

	// Strategy 4: Replace via vi.stubGlobal (modifies globalThis)
	try {
		const existing = g.crypto ?? {};
		const patched = { ...existing, subtle };
		vi.stubGlobal('crypto', patched);
		if (g.crypto === patched) return;
	} catch { /* last resort failed */ }

	console.error(
		'[test-setup] CRITICAL: All crypto.subtle polyfill strategies failed.\n' +
		'window.crypto may be frozen or non-extensible in this environment.'
	);
})();

// Verify environment setup
beforeAll(() => {
	if (typeof document === 'undefined') {
		throw new Error('jsdom environment not properly configured');
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (typeof (window as any).crypto?.subtle !== 'object') {
		console.error(
			'[test-setup] crypto.subtle verification FAILED.\n' +
			`  window.crypto type: ${typeof window.crypto}\n` +
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			`  window.crypto.subtle type: ${typeof (window as any).crypto?.subtle}`
		);
	}
});

// Cleanup after each test
afterEach(() => {
	cleanup();
});
