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

export const pwaUpdateState = writable<PwaUpdateState>(initialState);

function currentCommit(): string {
  return typeof __GIT_COMMIT_ID__ !== 'undefined' ? __GIT_COMMIT_ID__ : 'unknown';
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
  const localVersion = getAppVersionRaw();
  if (latestVersion && localVersion && compareSemver(latestVersion, localVersion) > 0) return true;

  const localCommit = currentCommit();
  if (!latestCommit || localCommit === 'dev' || localCommit === 'unknown') return false;

  return !latestCommit.startsWith(localCommit);
}

function markUpdateAvailable(source: PwaUpdateState['source'], swUpdateReady = false): void {
  pwaUpdateState.update((state) => ({
    ...state,
    checked: true,
    updateAvailable: true,
    swUpdateReady: state.swUpdateReady || swUpdateReady,
    source,
    error: null
  }));
}

export function bindPwaUpdateRegistration(registration: ServiceWorkerRegistration): void {
  registrationRef = registration;

  if (registration.waiting) {
    markUpdateAvailable('service-worker', true);
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        markUpdateAvailable('service-worker', true);
      }
    });
  });
}

export async function checkForPwaUpdate(source: 'manual' | 'auto' = 'manual'): Promise<void> {
  if (!browser || !navigator.onLine) return;

  pwaUpdateState.update((state) => ({
    ...state,
    checked: true,
    checking: true,
    source,
    error: null
  }));

  try {
    const registration = registrationRef ?? await navigator.serviceWorker?.getRegistration?.();
    await registration?.update?.();

    const [pkgResponse, commitResponse] = await Promise.allSettled([
      fetch(UPSTREAM_PACKAGE_URL, { cache: 'no-store' }),
      fetch(UPSTREAM_COMMIT_URL, { cache: 'no-store' })
    ]);

    let latestVersion: string | null = null;
    let latestCommit: string | null = null;

    if (pkgResponse.status === 'fulfilled' && pkgResponse.value.ok) {
      const pkg = await pkgResponse.value.json() as UpstreamPackage;
      latestVersion = typeof pkg.version === 'string' ? pkg.version.trim() : null;
    }

    if (commitResponse.status === 'fulfilled' && commitResponse.value.ok) {
      const commit = await commitResponse.value.json() as UpstreamCommit;
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
  }
}

export function applyPwaUpdate(): void {
  if (!browser) return;

  const waiting = registrationRef?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  window.location.reload();
}
