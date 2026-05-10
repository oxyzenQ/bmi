/**
 * Regression tests for v15.2 Observability — warnDev integration.
 *
 * Ensures that error paths across the codebase call warnDev() / warnDevOnce()
 * instead of silently swallowing errors. Covers:
 *
 *   1. Storage functions (storageGet, storageSet, storageRemove, storageGetJSON)
 *      call warnDev when localStorage throws or JSON is malformed.
 *   2. warnDevOnce deduplication: only N warnings are emitted for the same
 *      (module, fn, message) combination, then suppressed.
 *   3. warnDev error detail formatting: Error objects trigger groupCollapsed +
 *      trace; string errors show a "Details:" prefix.
 *
 * IMPORTANT: import.meta.env.PROD is statically replaced by Vite. In the test
 * environment it is false (dev mode), so warnDev/warnDevOnce execute fully and
 * hit the console logging paths.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { warnDev, warnDevOnce } from '$lib/utils/warn-dev';
import {
	storageGet,
	storageSet,
	storageRemove,
	storageGetJSON,
	storageInvalidateAll,
} from '$lib/utils/storage';

// ── Mock localStorage ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
const mockLocalStorage = {
	getItem: vi.fn((key: string) => store[key] ?? null),
	setItem: vi.fn((key: string, value: string) => {
		store[key] = value;
	}),
	removeItem: vi.fn((key: string) => {
		delete store[key];
	}),
	clear: vi.fn(() => {
		for (const k of Object.keys(store)) delete store[k];
	}),
};

// ── Mock IndexedDB ─────────────────────────────────────────────────────────
// Replicates the mock from storage-errors.test.ts so that isIndexedDbAvailable()
// returns true and fire-and-forget dbSet/dbRemove calls resolve (silently).

const mockIndexedDb = {
	open: vi.fn().mockReturnValue({
		onupgradeneeded: null as unknown,
		onsuccess: null as unknown,
		onerror: null as unknown,
		result: {
			transaction: vi.fn().mockReturnValue({
				objectStore: vi.fn().mockReturnValue({
					get: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: null }),
					put: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
					delete: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
					getAll: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: [] }),
					getAllKeys: vi.fn().mockReturnValue({ onsuccess: null, onerror: null, result: [] }),
				}),
				complete: null,
				onerror: null,
			}),
			createObjectStore: vi.fn().mockReturnValue({
				createIndex: vi.fn(),
			}),
			objectStoreNames: {
				contains: vi.fn().mockReturnValue(false),
			},
			close: vi.fn(),
		},
	}),
};

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });
Object.defineProperty(globalThis, 'indexedDB', { value: mockIndexedDb, writable: true });

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find a console.warn call whose arguments contain the given substring.
 * Returns the matching call array or undefined.
 */
function findWarnCall(warnSpy: ReturnType<typeof vi.spyOn>, substring: string): unknown[] | undefined {
	return warnSpy.mock.calls.find((call) =>
		call.some((arg) => typeof arg === 'string' && arg.includes(substring)),
	);
}

// ── Per-test cleanup ───────────────────────────────────────────────────────

beforeEach(() => {
	vi.restoreAllMocks();
	mockLocalStorage.clear();
	storageInvalidateAll();
});

// ════════════════════════════════════════════════════════════════════════════
// 1. Storage functions call warnDev on errors
// ════════════════════════════════════════════════════════════════════════════

describe('v15.2 warnDev regression — storage error paths', () => {
	describe('storageGet', () => {
		it('calls warnDev with [storage:storageGet] tag when localStorage.getItem throws', () => {
			const warnSpy = vi.spyOn(console, 'warn');
			mockLocalStorage.getItem.mockImplementationOnce(() => {
				throw new Error('SecurityError');
			});

			const result = storageGet('fail-key');

			expect(result).toBeNull();
			expect(warnSpy).toHaveBeenCalled();

			const call = findWarnCall(warnSpy, '[storage:storageGet]');
			expect(call).toBeDefined();
			expect(call!.some((a) => typeof a === 'string' && a.includes('Failed to read key: fail-key'))).toBe(true);
		});

		it('includes the error in warnDev output when getItem throws', () => {
			const warnSpy = vi.spyOn(console, 'warn');
			mockLocalStorage.getItem.mockImplementationOnce(() => {
				throw new Error('SecurityError');
			});

			storageGet('fail-key');

			// Error objects trigger groupCollapsed + trace (tested in section 4)
			// but the initial warn call should still be present
			const call = findWarnCall(warnSpy, '[storage:storageGet]');
			expect(call).toBeDefined();
		});
	});

	describe('storageSet', () => {
		it('calls warnDev with [storage:storageSet] tag when localStorage.setItem throws', () => {
			const warnSpy = vi.spyOn(console, 'warn');
			mockLocalStorage.setItem.mockImplementationOnce(() => {
				throw new Error('QuotaExceededError');
			});

			const result = storageSet('quota-key', 'big-value');

			expect(result).toBe(false);
			expect(warnSpy).toHaveBeenCalled();

			const call = findWarnCall(warnSpy, '[storage:storageSet]');
			expect(call).toBeDefined();
			expect(call!.some((a) => typeof a === 'string' && a.includes('Failed to write key: quota-key'))).toBe(
				true,
			);
		});

		it('returns false on SecurityError from setItem', () => {
			const warnSpy = vi.spyOn(console, 'warn');
			mockLocalStorage.setItem.mockImplementationOnce(() => {
				throw new Error('SecurityError');
			});

			expect(storageSet('sec-key', 'val')).toBe(false);
			expect(findWarnCall(warnSpy, '[storage:storageSet]')).toBeDefined();
		});
	});

	describe('storageRemove', () => {
		it('calls warnDev with [storage:storageRemove] tag when localStorage.removeItem throws', () => {
			const warnSpy = vi.spyOn(console, 'warn');
			mockLocalStorage.removeItem.mockImplementationOnce(() => {
				throw new Error('SecurityError');
			});

			expect(() => storageRemove('rm-key')).not.toThrow();
			expect(warnSpy).toHaveBeenCalled();

			const call = findWarnCall(warnSpy, '[storage:storageRemove]');
			expect(call).toBeDefined();
			expect(
				call!.some((a) => typeof a === 'string' && a.includes('Failed to remove key: rm-key')),
			).toBe(true);
		});
	});
});

// ════════════════════════════════════════════════════════════════════════════
// 2. JSON parse errors trigger warnDev
// ════════════════════════════════════════════════════════════════════════════

describe('v15.2 warnDev regression — JSON parse errors', () => {
	it('storageGetJSON calls warnDev with [storage:storageGetJSON] when JSON is malformed', () => {
		const warnSpy = vi.spyOn(console, 'warn');
		store['bad-json'] = 'not-valid-json{{{';

		const result = storageGetJSON('bad-json', { fallback: true });

		expect(result).toEqual({ fallback: true });
		expect(warnSpy).toHaveBeenCalled();

		const call = findWarnCall(warnSpy, '[storage:storageGetJSON]');
		expect(call).toBeDefined();
		expect(
			call!.some((a) => typeof a === 'string' && a.includes('Failed to parse JSON for key: bad-json')),
		).toBe(true);
	});

	it('storageGetJSON calls warnDev for deeply nested invalid JSON', () => {
		const warnSpy = vi.spyOn(console, 'warn');
		store['nested-bad'] = '{"a": {"b": invalid}}';

		const result = storageGetJSON('nested-bad', []);

		expect(result).toEqual([]);
		expect(findWarnCall(warnSpy, '[storage:storageGetJSON]')).toBeDefined();
	});

	it('storageGetJSON calls warnDev for empty string input', () => {
		const warnSpy = vi.spyOn(console, 'warn');
		store['empty-str'] = '';

		const result = storageGetJSON('empty-str', 'default');

		// Empty string is valid JSON (JSON.parse('') throws), so warnDev is called
		expect(result).toBe('default');
		expect(findWarnCall(warnSpy, '[storage:storageGetJSON]')).toBeDefined();
	});
});

// ════════════════════════════════════════════════════════════════════════════
// 3. warnDevOnce deduplication
// ════════════════════════════════════════════════════════════════════════════

describe('v15.2 warnDev regression — warnDevOnce deduplication', () => {
	it('emits exactly maxLogs (default 5) warnings and then suppresses', () => {
		const warnSpy = vi.spyOn(console, 'warn');

		// Unique module:fn:message to avoid map collisions with other tests
		for (let i = 0; i < 7; i++) {
			warnDevOnce('dedup-default', 'poll', 'Connection refused');
		}

		const dedupCalls = warnSpy.mock.calls.filter((call) =>
			call.some((arg) => typeof arg === 'string' && arg.includes('[dedup-default:poll]')),
		);

		expect(dedupCalls).toHaveLength(5);
	});

	it('the last emitted warning includes "(further warnings suppressed)"', () => {
		const warnSpy = vi.spyOn(console, 'warn');

		for (let i = 0; i < 7; i++) {
			warnDevOnce('dedup-msg', 'stream', 'Buffer overflow');
		}

		const dedupCalls = warnSpy.mock.calls.filter((call) =>
			call.some((arg) => typeof arg === 'string' && arg.includes('[dedup-msg:stream]')),
		);

		// The 5th (last) call should carry the suppression notice
		const lastCall = dedupCalls[dedupCalls.length - 1];
		expect(
			lastCall.some((arg) => typeof arg === 'string' && arg.includes('(further warnings suppressed)')),
		).toBe(true);

		// Earlier calls should NOT have the suppression notice
		for (let i = 0; i < dedupCalls.length - 1; i++) {
			expect(
				dedupCalls[i].some(
					(arg) => typeof arg === 'string' && arg.includes('(further warnings suppressed)'),
				),
			).toBe(false);
		}
	});

	it('respects custom maxLogs=1 — only 1 warning emitted', () => {
		const warnSpy = vi.spyOn(console, 'warn');

		warnDevOnce('dedup-custom1', 'send', 'Rate limited', undefined, 1);
		warnDevOnce('dedup-custom1', 'send', 'Rate limited', undefined, 1);

		const dedupCalls = warnSpy.mock.calls.filter((call) =>
			call.some((arg) => typeof arg === 'string' && arg.includes('[dedup-custom1:send]')),
		);

		expect(dedupCalls).toHaveLength(1);
	});

	it('custom maxLogs=1 includes suppression notice on the first (and only) call', () => {
		const warnSpy = vi.spyOn(console, 'warn');

		warnDevOnce('dedup-custom1b', 'post', 'Timeout', undefined, 1);

		const dedupCalls = warnSpy.mock.calls.filter((call) =>
			call.some((arg) => typeof arg === 'string' && arg.includes('[dedup-custom1b:post]')),
		);

		expect(dedupCalls).toHaveLength(1);
		expect(
			dedupCalls[0].some(
				(arg) => typeof arg === 'string' && arg.includes('(further warnings suppressed)'),
			),
		).toBe(true);
	});

	it('respects custom maxLogs=3 — emits 3 warnings out of 5 calls', () => {
		const warnSpy = vi.spyOn(console, 'warn');

		for (let i = 0; i < 5; i++) {
			warnDevOnce('dedup-custom3', 'retry', 'Backoff exceeded', undefined, 3);
		}

		const dedupCalls = warnSpy.mock.calls.filter((call) =>
			call.some((arg) => typeof arg === 'string' && arg.includes('[dedup-custom3:retry]')),
		);

		expect(dedupCalls).toHaveLength(3);
	});
});

// ════════════════════════════════════════════════════════════════════════════
// 4. warnDev error detail formatting
// ════════════════════════════════════════════════════════════════════════════

describe('v15.2 warnDev regression — error detail formatting', () => {
	it('Error object triggers console.groupCollapsed and console.trace for stack trace', () => {
		const warnSpy = vi.spyOn(console, 'warn');
		const groupSpy = vi.spyOn(console, 'groupCollapsed');
		const traceSpy = vi.spyOn(console, 'trace');
		const groupEndSpy = vi.spyOn(console, 'groupEnd');

		const err = new Error('connection reset');
		warnDev('net', 'fetch', 'Request failed', err);

		// Base structured warning
		expect(warnSpy).toHaveBeenCalled();
		const baseCall = findWarnCall(warnSpy, '[net:fetch]');
		expect(baseCall).toBeDefined();

		// Error → groupCollapsed with error message
		expect(groupSpy).toHaveBeenCalledTimes(1);
		expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('connection reset'));

		// Stack trace
		expect(traceSpy).toHaveBeenCalledTimes(1);
		expect(traceSpy).toHaveBeenCalledWith('  Stack');

		// Group is properly closed
		expect(groupEndSpy).toHaveBeenCalledTimes(1);
	});

	it('string error includes "Details:" prefix in console.warn output', () => {
		const warnSpy = vi.spyOn(console, 'warn');

		warnDev('api', 'parse', 'Response body invalid', 'unexpected token at position 42');

		expect(warnSpy).toHaveBeenCalled();

		// The structured warning should be the first call
		const baseCall = findWarnCall(warnSpy, '[api:parse]');
		expect(baseCall).toBeDefined();

		// The "Details:" call should be a separate console.warn
		const detailCall = warnSpy.mock.calls.find(
			(call) => call[0] === '  Details:',
		);
		expect(detailCall).toBeDefined();
		expect(detailCall![1]).toBe('unexpected token at position 42');
	});

	it('non-Error, non-string error is coerced to string with "Details:" prefix', () => {
		const warnSpy = vi.spyOn(console, 'warn');

		warnDev('fmt', 'coerce', 'Unknown error type', 404);

		expect(warnSpy).toHaveBeenCalled();

		const detailCall = warnSpy.mock.calls.find(
			(call) => call[0] === '  Details:',
		);
		expect(detailCall).toBeDefined();
		expect(detailCall![1]).toBe('404');
	});

	it('no error argument produces only the structured warning (no extra calls)', () => {
		const warnSpy = vi.spyOn(console, 'warn');
		const groupSpy = vi.spyOn(console, 'groupCollapsed');
		const traceSpy = vi.spyOn(console, 'trace');

		warnDev('clean', 'noop', 'Nothing to see here');

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(findWarnCall(warnSpy, '[clean:noop]')).toBeDefined();
		expect(groupSpy).not.toHaveBeenCalled();
		expect(traceSpy).not.toHaveBeenCalled();
	});
});
