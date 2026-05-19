// Copyright (c) 2025 - 2026 rezky_nightky
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
let updateCheckInFlight: Promise<void> | null = null;
const boundRegistrations = new WeakSet<ServiceWorkerRegistration>();

export const pwaUpdateState = writable<PwaUpdateState>(initialState);

function currentCommit(): string {
	return typeof __GIT_COMMIT_ID__ !== 'undefined'
		? normalizeCommitId(__GIT_COMMIT_ID__)
		: 'unknown';
}

export function normalizeCommitId(commit: string | null | undefined): string {
	const normalized = typeof commit === 'string' ? commit.trim().toLowerCase() : '';
	return normalized || 'unknown';
}

export function commitsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
	const aa = normalizeCommitId(a);
	const bb = normalizeCommitId(b);
	if (aa === 'unknown' || bb === 'unknown' || aa === 'dev' || bb === 'dev') return false;
	return aa.startsWith(bb) || bb.startsWith(aa);
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

function isNewerUpstream(latestVersion: string | null, latestCommit: string | null): boolean {
	const localCommit = currentCommit();
	if (commitsMatch(latestCommit, localCommit)) return false;
	if (hasNewerCommit(latestCommit, localCommit)) return true;

	const localVersion = getAppVersionRaw();
	if (latestVersion && localVersion && compareSemver(latestVersion, localVersion) > 0) return true;

	return false;
}

function noteServiceWorkerUpdateReady(): void {
	pwaUpdateState.update((state) => ({
		...state,
		checked: true,
		swUpdateReady: true,
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

export async function checkForPwaUpdate(source: 'manual' | 'auto' = 'manual'): Promise<void> {
	if (!browser || !navigator.onLine) return;
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

			const hasUpdate = isNewerUpstream(latestVersion, latestCommit);

			pwaUpdateState.update((state) => ({
				...state,
				checked: true,
				checking: false,
				updateAvailable: state.updateAvailable || hasUpdate,
				latestVersion,
				latestCommit,
				lastCheckedAt: Date.now(),
				source: hasUpdate ? source : state.source,
				error: null
			}));
		} catch (err) {
			warnDevOnce('pwa-update', 'checkForPwaUpdate', 'Failed to check upstream update', err);
			pwaUpdateState.update((state) => ({
				...state,
				checked: true,
				checking: false,
				lastCheckedAt: Date.now(),
				error: err instanceof Error ? err.message : 'Update check failed'
			}));
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
		/* Listen for the new SW taking control before reloading.
                   This avoids a race where reload fires before the new SW activates,
                   causing the page to load with stale code and requiring a second tap. */
		let controllerChanged = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			controllerChanged = true;
			window.location.reload();
		});

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
