// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getAppVersionRaw } from '$lib/utils/app-version';
import { warnDevOnce } from '$lib/utils/warn-dev';

const UPSTREAM_PACKAGE_URL = 'https://raw.githubusercontent.com/oxyzenQ/bmi/main/package.json';
const UPSTREAM_COMMIT_URL = 'https://api.github.com/repos/oxyzenQ/bmi/commits/main';

interface UpstreamPackage {
	version?: string;
}

interface UpstreamCommit {
	sha?: string;
}

type PwaUpdateCheckSource = 'manual' | 'auto';
type PwaUpdateCheckStatus = 'update-available' | 'up-to-date' | 'offline' | 'error';

/**
 * Minimum spacing between timer-driven automatic upstream update
 * checks (12 hours). The automatic check is a third-party GET: without
 * a floor it fires on every production load, maximizing the IP, user
 * agent, and timing exposure the README discloses and burning the
 * unauthenticated api.github.com per-IP pool on shared egress. Manual
 * checks (About) and service-worker-driven confirmations never
 * throttle. A failed or offline attempt is not recorded, so the next
 * load retries instead of blinding the check for the window.
 */
export const AUTO_UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * True when a timer-driven automatic check may run: nothing was ever
 * recorded, the record is not a finite number, or the previous check
 * is at least intervalMs old.
 */
export function shouldRunAutoUpdateCheck(
	lastCheckedAt: number | null | undefined,
	now: number,
	intervalMs: number = AUTO_UPDATE_CHECK_INTERVAL_MS
): boolean {
	if (typeof lastCheckedAt !== 'number' || !Number.isFinite(lastCheckedAt)) return true;
	return now - lastCheckedAt >= intervalMs;
}

/**
 * localStorage key recording when the user last applied an update
 * (applyPwaUpdate). The record powers the upstream convergence
 * window below.
 */
const UPDATE_APPLIED_AT_KEY = 'bmi.updateAppliedAt';

/**
 * Upstream convergence window after an applied update (5 minutes).
 *
 * Right after a release lands, the read-through mirrors in front of
 * the upstream sources can still serve the previous release for a
 * while - raw.githubusercontent.com sits behind a CDN with a 300s
 * max-age and api.github.com can disagree with it for minutes. A
 * freshly updated install compares against those mirrors and reads
 * "local is new, upstream is old", which is the mirror catching up,
 * not a new release. Inside this window a commit-mismatch-only
 * signal is therefore not treated as an update; a strictly newer
 * upstream version (a real second release) still cuts through.
 */
export const UPSTREAM_CONVERGENCE_WINDOW_MS = 5 * 60 * 1000;

/** Record the moment an update was applied - called before the reload. */
export function noteUpdateApplied(now: number = Date.now()): void {
	if (!browser) return;
	try {
		localStorage.setItem(UPDATE_APPLIED_AT_KEY, String(now));
	} catch {
		// Storage unavailable: the convergence window degrades to off
		// and commit-mismatch signals keep their old weight.
	}
}

/**
 * Pure window test: true while an applied update is still inside the
 * convergence window. A record dated in the future is garbage, not grace.
 */
export function isInUpstreamConvergenceWindow(
	appliedAt: number | null | undefined,
	now: number,
	windowMs: number = UPSTREAM_CONVERGENCE_WINDOW_MS
): boolean {
	if (typeof appliedAt !== 'number' || !Number.isFinite(appliedAt)) return false;
	const age = now - appliedAt;
	return age >= 0 && age < windowMs;
}

function readUpdateAppliedAt(): number | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(UPDATE_APPLIED_AT_KEY);
		if (raw === null) return null;
		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

interface PwaUpdateState {
	checked: boolean;
	checking: boolean;
	updateAvailable: boolean;
	swUpdateReady: boolean;
	/** True while the update tap is mid-handover (purge to
	 *  reload): the pager freezes section switching for the
	 *  window. */
	applying: boolean;
	latestVersion: string | null;
	latestCommit: string | null;
	lastCheckedAt: number | null;
	error: string | null;
	source: 'idle' | 'service-worker' | 'upstream' | 'manual' | 'auto';
}

export interface PwaUpdateCheckResult {
	status: PwaUpdateCheckStatus;
	latestVersion: string | null;
	latestCommit: string | null;
	error: string | null;
	source: PwaUpdateCheckSource;
}

const initialState: PwaUpdateState = {
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
};

let registrationRef: ServiceWorkerRegistration | null = null;
let updateCheckInFlight: Promise<PwaUpdateCheckResult> | null = null;
const boundRegistrations = new WeakSet<ServiceWorkerRegistration>();
let controllerChangeHandler: (() => void) | null = null;

export const pwaUpdateState = writable<PwaUpdateState>(initialState);

function currentCommit(): string {
	return typeof __GIT_COMMIT_ID__ !== 'undefined'
		? normalizeCommitId(__GIT_COMMIT_ID__)
		: 'unknown';
}

function currentBranch(): string {
	return typeof __GIT_BRANCH__ !== 'undefined' ? normalizeBranch(__GIT_BRANCH__) : 'main';
}

/** Truncate a full SHA to a short display form (first 7 chars).
 *  Use only for UI display — never for commit comparison. */
export function shortCommitId(commit: string | null | undefined): string {
	const normalized = normalizeCommitId(commit);
	return normalized.length > 7 ? normalized.slice(0, 7) : normalized;
}

export function normalizeCommitId(commit: string | null | undefined): string {
	const normalized = typeof commit === 'string' ? commit.trim().toLowerCase() : '';
	return normalized || 'unknown';
}

export function normalizeBranch(branch: string | null | undefined): string {
	const normalized = typeof branch === 'string' ? branch.trim().toLowerCase() : '';
	return normalized || 'unknown';
}

export function shouldUseCommitUpdateCheck(branch: string | null | undefined): boolean {
	return normalizeBranch(branch) === 'main';
}

export function commitsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
	const aa = normalizeCommitId(a);
	const bb = normalizeCommitId(b);
	if (aa === 'unknown' || bb === 'unknown' || aa === 'dev' || bb === 'dev') return false;
	// Exact normalized equality only — prefix matching (startsWith) is unsafe
	// because distinct commits can share a prefix (e.g. abc123 vs abc123def).
	return aa === bb;
}

export function hasNewerCommit(
	latestCommit: string | null | undefined,
	localCommit: string | null | undefined
): boolean {
	const latest = normalizeCommitId(latestCommit);
	const local = normalizeCommitId(localCommit);
	if (latest === 'unknown' || local === 'unknown' || local === 'dev') return false;
	return !commitsMatch(latest, local);
}

function compareSemver(a: string, b: string): number {
	const aa = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
	const bb = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
	const len = Math.max(aa.length, bb.length);

	for (let i = 0; i < len; i += 1) {
		const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
		if (diff !== 0) return diff;
	}

	return 0;
}

export function isNewerUpstreamForBuild({
	latestVersion,
	latestCommit,
	localVersion,
	localCommit,
	localBranch,
	suppressCommitMismatch = false
}: {
	latestVersion: string | null;
	latestCommit: string | null;
	localVersion: string | null;
	localCommit: string | null;
	localBranch: string | null;
	/** True while upstream mirrors may still be converging after an
            applied update: commit-mismatch-only signals are not updates. */
	suppressCommitMismatch?: boolean;
}): boolean {
	// A strictly newer upstream version is trusted even inside the
	// convergence window - a real second release always bumps it.
	if (latestVersion && localVersion && compareSemver(latestVersion, localVersion) > 0) {
		return true;
	}

	if (suppressCommitMismatch) return false;
	if (!shouldUseCommitUpdateCheck(localBranch)) return false;
	if (commitsMatch(latestCommit, localCommit)) return false;
	return hasNewerCommit(latestCommit, localCommit);
}

function isNewerUpstream(latestVersion: string | null, latestCommit: string | null): boolean {
	return isNewerUpstreamForBuild({
		latestVersion,
		latestCommit,
		localVersion: getAppVersionRaw(),
		localCommit: currentCommit(),
		localBranch: currentBranch(),
		suppressCommitMismatch: isInUpstreamConvergenceWindow(readUpdateAppliedAt(), Date.now())
	});
}

function noteServiceWorkerUpdateReady(): void {
	// Record that a new service worker is waiting, but do NOT set the
	// user-facing updateAvailable flag here.  The subsequent
	// checkForPwaUpdate('auto') call will decide whether a real app
	// update exists (commit / version changed).  If the commit is
	// already current, swUpdateReady will be cleared and no prompt shown.
	pwaUpdateState.update((state) => ({
		...state,
		checked: true,
		swUpdateReady: false,
		updateAvailable: false,
		source: 'service-worker',
		error: null
	}));

	void checkForPwaUpdate('auto');
}

export function bindPwaUpdateRegistration(registration: ServiceWorkerRegistration): void {
	registrationRef = registration;

	if (registration.waiting && navigator.serviceWorker.controller) {
		noteServiceWorkerUpdateReady();
	}

	if (boundRegistrations.has(registration)) return;
	boundRegistrations.add(registration);

	registration.addEventListener('updatefound', () => {
		const installing = registration.installing;
		if (!installing) return;

		installing.addEventListener('statechange', () => {
			if (installing.state === 'installed' && navigator.serviceWorker.controller) {
				noteServiceWorkerUpdateReady();
			}
		});
	});
}

export async function checkForPwaUpdate(
	source: PwaUpdateCheckSource = 'manual'
): Promise<PwaUpdateCheckResult> {
	const offlineResult: PwaUpdateCheckResult = {
		status: 'offline',
		latestVersion: null,
		latestCommit: null,
		error: 'offline',
		source
	};

	if (!browser) return offlineResult;
	if (!navigator.onLine) {
		pwaUpdateState.update((state) => ({
			...state,
			checked: true,
			checking: false,
			lastCheckedAt: Date.now(),
			error: 'offline'
		}));
		return offlineResult;
	}
	if (updateCheckInFlight) return updateCheckInFlight;

	updateCheckInFlight = (async () => {
		pwaUpdateState.update((state) => ({
			...state,
			checked: true,
			checking: true,
			source,
			error: null
		}));

		try {
			const registration = registrationRef ?? (await navigator.serviceWorker?.getRegistration?.());
			await registration?.update?.();

			const [pkgResponse, commitResponse] = await Promise.allSettled([
				fetch(UPSTREAM_PACKAGE_URL, { cache: 'no-store' }),
				fetch(UPSTREAM_COMMIT_URL, { cache: 'no-store' })
			]);

			let latestVersion: string | null = null;
			let latestCommit: string | null = null;

			if (pkgResponse.status === 'fulfilled' && pkgResponse.value.ok) {
				const pkg = (await pkgResponse.value.json()) as UpstreamPackage;
				latestVersion = typeof pkg.version === 'string' ? pkg.version.trim() : null;
			}

			if (commitResponse.status === 'fulfilled' && commitResponse.value.ok) {
				const commit = (await commitResponse.value.json()) as UpstreamCommit;
				latestCommit = typeof commit.sha === 'string' ? commit.sha.trim() : null;
			}

			if (!latestVersion && !latestCommit) {
				throw new Error('Update check failed');
			}

			const hasUpdate = isNewerUpstream(latestVersion, latestCommit);
			const result: PwaUpdateCheckResult = {
				status: hasUpdate ? 'update-available' : 'up-to-date',
				latestVersion,
				latestCommit,
				error: null,
				source
			};

			pwaUpdateState.update((state) => ({
				...state,
				checked: true,
				checking: false,
				updateAvailable: hasUpdate,
				swUpdateReady: hasUpdate ? state.swUpdateReady : false,
				latestVersion,
				latestCommit,
				lastCheckedAt: Date.now(),
				source: hasUpdate ? source : 'upstream',
				error: null
			}));

			return result;
		} catch (err) {
			warnDevOnce('pwa-update', 'checkForPwaUpdate', 'Failed to check upstream update', err);
			const message = err instanceof Error ? err.message : 'Update check failed';
			pwaUpdateState.update((state) => ({
				...state,
				checked: true,
				checking: false,
				updateAvailable: false,
				lastCheckedAt: Date.now(),
				error: message
			}));
			return {
				status: 'error',
				latestVersion: null,
				latestCommit: null,
				error: message,
				source
			};
		} finally {
			updateCheckInFlight = null;
		}
	})();

	return updateCheckInFlight;
}

/**
 * Hard cache clean for the update path (night-cafe-10): delete every
 * CacheStorage bucket this origin holds - precache and runtime, old
 * and current - except the buckets named in `exclude`. The reload
 * that follows lands on a cold cache, so the shell and its hashed
 * chunks come back from the network instead of a stale precache, and
 * a stuck or never-installed waiting worker can no longer pin the
 * previous release after the user taps Update. The exclusion lets
 * the caller spare the waiting worker's own buckets (its
 * install-built precache), keeping the post-reload session
 * offline-capable; stale entries inside the spared buckets are
 * still re-verified by the activate integrity gate. An offline tap
 * degrades to the bounded offline shell, never a hang. Returns the
 * number of purged buckets (0 when CacheStorage is unavailable or
 * the purge fails - a failed clean never blocks the update itself).
 */
export async function purgeAppCaches(exclude: readonly string[] = []): Promise<number> {
	if (!browser) return 0;
	try {
		if (typeof caches === 'undefined') return 0;
		const skip = new Set(exclude);
		const keys = await caches.keys();
		const doomed = keys.filter((key) => !skip.has(key));
		await Promise.all(doomed.map((key) => caches.delete(key)));
		return doomed.length;
	} catch (err) {
		warnDevOnce('pwa-update', 'purgeAppCaches', 'Cache purge failed', err);
		return 0;
	}
}

/**
 * Ask the waiting worker which build it carries (GET_VERSION) and
 * race the answer against a short timeout. The answer names the
 * buckets the worker precached at install - the purge spares them
 * so the session that comes back after the reload keeps a full
 * offline shell (an install never reruns for the same worker). A
 * silent worker - deployed builds predate the question, or the
 * channel is unavailable - resolves null and the purge stays
 * total: degrade, never wait.
 */
function requestWaitingVersion(
	waiting: ServiceWorker,
	timeoutMs: number = 300
): Promise<string | null> {
	const channel = navigator.serviceWorker;
	if (!channel?.addEventListener) return Promise.resolve(null);
	return new Promise((resolve) => {
		let settled = false;
		function finish(version: string | null): void {
			if (settled) return;
			settled = true;
			channel.removeEventListener('message', onMessage);
			clearTimeout(timer);
			resolve(version);
		}
		function onMessage(event: MessageEvent): void {
			if (event.data?.type === 'VERSION' && typeof event.data.version === 'string') {
				finish(event.data.version);
			}
		}
		const timer = setTimeout(() => finish(null), timeoutMs);
		channel.addEventListener('message', onMessage);
		try {
			waiting.postMessage({ type: 'GET_VERSION' });
		} catch {
			finish(null);
		}
	});
}

export async function applyPwaUpdate(): Promise<void> {
	if (!browser) return;

	// Record the apply BEFORE any reload: the page that comes back
	// must know the shell just moved and the upstream mirrors may
	// still serve the previous release for the convergence window.
	// This kills the ghost prompt that re-fired seconds after the
	// post-update reload and made the user tap Update twice.
	noteUpdateApplied();

	// Freeze the session now: the flag gates every pager section
	// switch, so no swipe can enter the handover window - between
	// the cache purge and the reload - where a lazy route chunk, a
	// font or an image cannot be served and the next section hangs
	// on its skeletons until a manual hard refresh.
	pwaUpdateState.update((state) => ({ ...state, applying: true }));

	const waiting = registrationRef?.waiting;

	// Hard fresh (night-cafe-10): wipe every cache bucket before the
	// reload so no stale version survives the update tap. The
	// waiting worker's own buckets are spared (see
	// requestWaitingVersion); the activate integrity gate still
	// re-verifies every entry they hold, so no stale asset can ride
	// them into the new session.
	const spare = waiting ? await requestWaitingVersion(waiting) : null;
	await purgeAppCaches(spare ? [`cache-${spare}`, `runtime-${spare}`] : []);

	if (waiting) {
		/* Remove any previous controllerchange listener to prevent
                   double-reload from accumulated handlers on repeated calls. */
		if (controllerChangeHandler) {
			navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
		}

		/* Listen for the new SW taking control before reloading.
                   This avoids a race where reload fires before the new SW activates,
                   causing the page to load with stale code and requiring a second tap. */
		let controllerChanged = false;
		controllerChangeHandler = () => {
			controllerChanged = true;
			window.location.reload();
		};
		navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);

		waiting.postMessage({ type: 'SKIP_WAITING' });

		/* Fallback: if controllerchange never fires (e.g. SW already active
                   or browser quirk), reload after a short grace period. */
		setTimeout(() => {
			if (!controllerChanged) {
				window.location.reload();
			}
		}, 1500);
	} else {
		window.location.reload();
	}
}
