// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
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

interface PwaUpdateState {
	checked: boolean;
	checking: boolean;
	updateAvailable: boolean;
	swUpdateReady: boolean;
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
	localBranch
}: {
	latestVersion: string | null;
	latestCommit: string | null;
	localVersion: string | null;
	localCommit: string | null;
	localBranch: string | null;
}): boolean {
	if (latestVersion && localVersion && compareSemver(latestVersion, localVersion) > 0) {
		return true;
	}

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
		localBranch: currentBranch()
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

export function applyPwaUpdate(): void {
	if (!browser) return;

	const waiting = registrationRef?.waiting;
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
