// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

//
// Paranoid Masterclass audit — PWA offline integrity suite (update logic).
//
// Covers the pure update-decision helpers and the offline path of the
// update check: when the device is offline the check must resolve to an
// explicit 'offline' status without performing any network fetch, and
// the store must record the attempt so the UI can reflect it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/utils/warn-dev', () => ({
	warnDev: vi.fn(),
	warnDevOnce: vi.fn()
}));

import {
	applyPwaUpdate,
	bindPwaUpdateRegistration,
	checkForPwaUpdate,
	commitsMatch,
	hasNewerCommit,
	isInUpstreamConvergenceWindow,
	isNewerUpstreamForBuild,
	normalizeBranch,
	normalizeCommitId,
	noteUpdateApplied,
	purgeAppCaches,
	pwaUpdateState,
	shouldUseCommitUpdateCheck,
	shortCommitId,
	UPSTREAM_CONVERGENCE_WINDOW_MS
} from '../../stores/pwa-update';

const FULL_SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_SHA = 'fedcba9876543210fedcba9876543210fedcba98';

beforeEach(() => {
	pwaUpdateState.set({
		checked: false,
		checking: false,
		updateAvailable: false,
		swUpdateReady: false,
		applying: false,
		latestVersion: null,
		latestCommit: null,
		lastCheckedAt: null,
		error: null,
		source: 'idle'
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

// ── normalization helpers ──

describe('commit id normalization', () => {
	it('trims and lowercases commit ids', () => {
		expect(normalizeCommitId('  ABCDEF1234  ')).toBe('abcdef1234');
	});

	it('maps empty values to "unknown"', () => {
		expect(normalizeCommitId('')).toBe('unknown');
		expect(normalizeCommitId(null)).toBe('unknown');
		expect(normalizeCommitId(undefined)).toBe('unknown');
	});

	it('shortens to 7 chars for display only', () => {
		expect(shortCommitId(FULL_SHA)).toBe(FULL_SHA.slice(0, 7));
		expect(shortCommitId('abc123')).toBe('abc123');
		expect(shortCommitId(null)).toBe('unknown');
	});

	it('normalizes branch names and defaults to unknown', () => {
		expect(normalizeBranch(' Main ')).toBe('main');
		expect(normalizeBranch('')).toBe('unknown');
	});
});

// ── update decision logic ──

describe('update decision logic', () => {
	it('uses the commit check only on main', () => {
		expect(shouldUseCommitUpdateCheck('main')).toBe(true);
		expect(shouldUseCommitUpdateCheck('feature/x')).toBe(false);
		expect(shouldUseCommitUpdateCheck(null)).toBe(false);
	});

	it('commitsMatch requires exact normalized equality', () => {
		expect(commitsMatch(FULL_SHA, FULL_SHA.toUpperCase())).toBe(true);
		// Prefix matching is unsafe — abc123 vs abc123def must NOT match.
		expect(commitsMatch(FULL_SHA.slice(0, 7), FULL_SHA)).toBe(false);
		expect(commitsMatch('unknown', FULL_SHA)).toBe(false);
		expect(commitsMatch(FULL_SHA, null)).toBe(false);
	});

	it('hasNewerCommit is false when either side is unknown', () => {
		expect(hasNewerCommit(OTHER_SHA, 'unknown')).toBe(false);
		expect(hasNewerCommit(null, FULL_SHA)).toBe(false);
		expect(hasNewerCommit(OTHER_SHA, FULL_SHA)).toBe(true);
		expect(hasNewerCommit(FULL_SHA, FULL_SHA)).toBe(false);
	});

	it('isNewerUpstreamForBuild: newer version wins immediately', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '22.0.0',
				latestCommit: FULL_SHA,
				localVersion: '21.8.0',
				localCommit: FULL_SHA,
				localBranch: 'main'
			})
		).toBe(true);
	});

	it('isNewerUpstreamForBuild: same version falls through to commit compare on main', () => {
		const base = {
			latestVersion: '21.8.0',
			localVersion: '21.8.0',
			localBranch: 'main'
		};
		expect(
			isNewerUpstreamForBuild({ ...base, latestCommit: OTHER_SHA, localCommit: FULL_SHA })
		).toBe(true);
		expect(
			isNewerUpstreamForBuild({ ...base, latestCommit: FULL_SHA, localCommit: FULL_SHA })
		).toBe(false);
	});

	it('isNewerUpstreamForBuild: commit drift is ignored off main', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.8.0',
				latestCommit: OTHER_SHA,
				localVersion: '21.8.0',
				localCommit: FULL_SHA,
				localBranch: 'develop'
			})
		).toBe(false);
	});
});

// ── upstream convergence window ──

// Right after an applied update the upstream mirrors (raw.githubusercontent
// behind a 300s CDN, api.github.com) can still serve the previous release.
// A commit-mismatch-only signal in that window is the mirror catching up,
// not a new release - it must not resurrect the update prompt.

describe('upstream convergence window', () => {
	const NOW = 1_000_000_000_000;
	const WINDOW = UPSTREAM_CONVERGENCE_WINDOW_MS;

	it('isInUpstreamConvergenceWindow: true only inside the window', () => {
		expect(isInUpstreamConvergenceWindow(NOW, NOW, WINDOW)).toBe(true);
		expect(isInUpstreamConvergenceWindow(NOW - WINDOW + 1, NOW, WINDOW)).toBe(true);
		expect(isInUpstreamConvergenceWindow(NOW - WINDOW, NOW, WINDOW)).toBe(false);
		expect(isInUpstreamConvergenceWindow(NOW - WINDOW - 1, NOW, WINDOW)).toBe(false);
	});

	it('isInUpstreamConvergenceWindow: unknown or skewed records sit outside', () => {
		expect(isInUpstreamConvergenceWindow(null, NOW, WINDOW)).toBe(false);
		expect(isInUpstreamConvergenceWindow(undefined, NOW, WINDOW)).toBe(false);
		expect(isInUpstreamConvergenceWindow(Number.NaN, NOW, WINDOW)).toBe(false);
		// A record dated in the future is garbage, not grace.
		expect(isInUpstreamConvergenceWindow(NOW + 1, NOW, WINDOW)).toBe(false);
	});

	it('isNewerUpstreamForBuild: suppressed commit drift is not an update', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.8.0',
				latestCommit: FULL_SHA,
				localVersion: '21.8.0',
				localCommit: OTHER_SHA,
				localBranch: 'main',
				suppressCommitMismatch: true
			})
		).toBe(false);
	});

	it('isNewerUpstreamForBuild: a strictly newer version cuts through the suppression', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '22.0.0',
				latestCommit: FULL_SHA,
				localVersion: '21.8.0',
				localCommit: FULL_SHA,
				localBranch: 'main',
				suppressCommitMismatch: true
			})
		).toBe(true);
	});

	it('noteUpdateApplied records the moment it was given', () => {
		localStorage.removeItem('bmi.updateAppliedAt');
		noteUpdateApplied(1_700_000_000_000);
		expect(localStorage.getItem('bmi.updateAppliedAt')).toBe('1700000000000');
	});
});

// ── hard fresh cache purge (night-cafe-10) ──

// The update tap must wipe every CacheStorage bucket before the
// reload: a stuck or missing waiting worker can no longer pin the
// previous release in the precache, and a failed clean still lets the
// update proceed (degrade, never block). The waiting worker's own
// build buckets are spared when it answers the version question -
// its install-built precache must survive into the reloaded session.

describe('hard fresh cache purge (night-cafe-10)', () => {
	it('purgeAppCaches deletes every bucket and reports the count', async () => {
		const deleted: string[] = [];
		vi.stubGlobal('caches', {
			keys: async () => ['cache-v1', 'runtime-v1'],
			delete: async (key: string) => {
				deleted.push(key);
				return true;
			}
		});
		expect(await purgeAppCaches()).toBe(2);
		expect(deleted.sort()).toEqual(['cache-v1', 'runtime-v1']);
	});

	it('purgeAppCaches is a no-op without CacheStorage', async () => {
		vi.stubGlobal('caches', undefined);
		expect(await purgeAppCaches()).toBe(0);
	});

	it('applyPwaUpdate purges caches before the fallback reload', async () => {
		const order: string[] = [];
		vi.stubGlobal('caches', {
			keys: async () => ['cache-v1'],
			delete: async (key: string) => {
				order.push(`purge:${key}`);
				return true;
			}
		});
		// jsdom pins window.location, so swap the whole property.
		const originalLocation = window.location;
		const reloadSpy = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { reload: reloadSpy }
		});

		// No waiting worker: the function must purge first, then reload.
		await applyPwaUpdate();

		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation
		});
		expect(order).toEqual(['purge:cache-v1']);
		expect(reloadSpy).toHaveBeenCalledTimes(1);
	});

	it('applyPwaUpdate still reloads when the purge fails', async () => {
		vi.stubGlobal('caches', {
			keys: async () => {
				throw new Error('storage unavailable');
			},
			delete: async () => true
		});
		const originalLocation = window.location;
		const reloadSpy = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { reload: reloadSpy }
		});

		await applyPwaUpdate();

		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation
		});
		expect(reloadSpy).toHaveBeenCalledTimes(1);
	});

	it('purgeAppCaches spares the excluded buckets', async () => {
		const deleted: string[] = [];
		vi.stubGlobal('caches', {
			keys: async () => ['cache-v1', 'runtime-v1', 'cache-v2'],
			delete: async (key: string) => {
				deleted.push(key);
				return true;
			}
		});
		expect(await purgeAppCaches(['cache-v2'])).toBe(2);
		expect(deleted.sort()).toEqual(['cache-v1', 'runtime-v1']);
	});

	it('applyPwaUpdate raises the applying flag even when the purge fails', async () => {
		vi.stubGlobal('caches', {
			keys: async () => {
				throw new Error('storage unavailable');
			},
			delete: async () => true
		});
		const originalLocation = window.location;
		const reloadSpy = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { reload: reloadSpy }
		});
		let snapshot: { applying?: boolean } = {};
		const unsubscribe = pwaUpdateState.subscribe((s) => (snapshot = s));
		await applyPwaUpdate();
		unsubscribe();
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation
		});
		expect(snapshot.applying).toBe(true);
		expect(reloadSpy).toHaveBeenCalledTimes(1);
	});

	it('applyPwaUpdate spares the waiting worker buckets when it answers', async () => {
		vi.useFakeTimers();
		const deleted: string[] = [];
		vi.stubGlobal('caches', {
			keys: async () => ['cache-v1', 'runtime-v1', 'cache-v2', 'runtime-v2'],
			delete: async (key: string) => {
				deleted.push(key);
				return true;
			}
		});
		let messageListener: ((event: { data?: { type?: string; version?: string } }) => void) | null =
			null;
		const swContainer = {
			addEventListener: (_type: string, cb: (event: never) => void) => {
				messageListener = cb as (event: { data?: { type?: string; version?: string } }) => void;
			},
			removeEventListener: () => {}
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			configurable: true,
			value: swContainer
		});
		const waiting = {
			postMessage: (data: { type?: string }) => {
				if (data.type === 'GET_VERSION') {
					messageListener?.({ data: { type: 'VERSION', version: 'v2' } });
				}
			}
		} as unknown as ServiceWorker;
		bindPwaUpdateRegistration({
			waiting,
			addEventListener: () => {}
		} as unknown as ServiceWorkerRegistration);
		const originalLocation = window.location;
		const reloadSpy = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { reload: reloadSpy }
		});
		const done = applyPwaUpdate();
		await done;
		await vi.advanceTimersByTimeAsync(1600);
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation
		});
		delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
		vi.useRealTimers();
		expect(deleted.sort()).toEqual(['cache-v1', 'runtime-v1']);
		expect(reloadSpy).toHaveBeenCalledTimes(1);
	});

	it('applyPwaUpdate purges everything when the waiting worker stays silent', async () => {
		vi.useFakeTimers();
		const deleted: string[] = [];
		vi.stubGlobal('caches', {
			keys: async () => ['cache-v1', 'cache-v2'],
			delete: async (key: string) => {
				deleted.push(key);
				return true;
			}
		});
		const swContainer = {
			addEventListener: () => {},
			removeEventListener: () => {}
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			configurable: true,
			value: swContainer
		});
		const waiting = { postMessage: () => {} } as unknown as ServiceWorker;
		bindPwaUpdateRegistration({
			waiting,
			addEventListener: () => {}
		} as unknown as ServiceWorkerRegistration);
		const originalLocation = window.location;
		const reloadSpy = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: { reload: reloadSpy }
		});
		const done = applyPwaUpdate();
		await vi.advanceTimersByTimeAsync(400);
		await done;
		await vi.advanceTimersByTimeAsync(1600);
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation
		});
		delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
		vi.useRealTimers();
		expect(deleted.sort()).toEqual(['cache-v1', 'cache-v2']);
		expect(reloadSpy).toHaveBeenCalledTimes(1);
	});
});

// ── offline behavior ──

describe('checkForPwaUpdate offline path', () => {
	it('returns offline status without any network fetch', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

		const result = await checkForPwaUpdate('manual');

		expect(result.status).toBe('offline');
		expect(result.error).toBe('offline');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('records the offline attempt in the store', async () => {
		vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		await checkForPwaUpdate('auto');
		let snapshot: {
			checked?: boolean;
			checking?: boolean;
			error?: string | null;
			updateAvailable?: boolean;
		} = {};
		pwaUpdateState.subscribe((s) => (snapshot = s))();
		expect(snapshot.checked).toBe(true);
		expect(snapshot.checking).toBe(false);
		expect(snapshot.error).toBe('offline');
		expect(snapshot.updateAvailable).toBe(false);
	});
});
