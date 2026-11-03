// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
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
	checkForPwaUpdate,
	commitsMatch,
	hasNewerCommit,
	isNewerUpstreamForBuild,
	normalizeBranch,
	normalizeCommitId,
	pwaUpdateState,
	shouldUseCommitUpdateCheck,
	shortCommitId
} from '../../stores/pwa-update';

const FULL_SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_SHA = 'fedcba9876543210fedcba9876543210fedcba98';

beforeEach(() => {
	pwaUpdateState.set({
		checked: false,
		checking: false,
		updateAvailable: false,
		swUpdateReady: false,
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
