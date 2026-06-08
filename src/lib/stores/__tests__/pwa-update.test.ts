// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
	commitsMatch,
	hasNewerCommit,
	isNewerUpstreamForBuild,
	normalizeBranch,
	normalizeCommitId,
	shortCommitId,
	shouldUseCommitUpdateCheck
} from '../pwa-update';

/* ── Fake full-length SHAs for tests (40 hex chars each) ── */
const COMMIT_A = '5e88c13a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const COMMIT_B = 'abcdef0123456789abcdef0123456789abcdef01';

describe('pwa update commit comparison', () => {
	it('normalizes missing commit values safely', () => {
		expect(normalizeCommitId(undefined)).toBe('unknown');
		expect(normalizeCommitId(' 161A9D3 ')).toBe('161a9d3');
	});

	it('requires exact normalized commit equality to match', () => {
		// Full SHA must equal full SHA — prefix shortcuts are not allowed
		expect(commitsMatch(COMMIT_A, COMMIT_A)).toBe(true);
		// Different-length forms are NOT considered a match (prefix collision prevention)
		expect(commitsMatch(COMMIT_A, COMMIT_A.slice(0, 7))).toBe(false);
		// Distinct commits sharing a prefix must NOT match
		expect(commitsMatch('abc123', 'abc123def')).toBe(false);
		expect(commitsMatch('abc123def', 'abc123')).toBe(false);
	});

	it('reports a shorter SHA as different from a longer SHA for the same commit', () => {
		// When upstream has full SHA and local has short form, they are different
		// because we cannot safely assume the short form is a prefix of the same commit.
		expect(hasNewerCommit(COMMIT_A, COMMIT_A.slice(0, 7))).toBe(true);
	});

	it('does not report an update when local commit is unknown', () => {
		expect(hasNewerCommit(COMMIT_B, 'unknown')).toBe(false);
		expect(hasNewerCommit(COMMIT_B, null)).toBe(false);
	});

	it('reports a different upstream commit as newer when both are same length', () => {
		// Both full-length SHAs, different commits → update needed
		expect(hasNewerCommit(COMMIT_B, COMMIT_A)).toBe(true);
	});

	it('does NOT report an update when both full SHAs are identical', () => {
		// Both full-length SHAs, same commit → no update
		expect(hasNewerCommit(COMMIT_A, COMMIT_A)).toBe(false);
	});

	it('uses commit checks only on main builds', () => {
		expect(normalizeBranch(' Main ')).toBe('main');
		expect(shouldUseCommitUpdateCheck('main')).toBe(true);
		expect(shouldUseCommitUpdateCheck('dev')).toBe(false);
		expect(shouldUseCommitUpdateCheck('feature/navbar')).toBe(false);
	});

	it('does not treat preview branch commit differences from main as updates', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.1.0',
				latestCommit: COMMIT_B,
				localVersion: '21.1.0',
				localCommit: COMMIT_A,
				localBranch: 'dev'
			})
		).toBe(false);
	});

	it('still reports newer upstream versions on non-main builds', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.2.0',
				latestCommit: COMMIT_B,
				localVersion: '21.1.0',
				localCommit: COMMIT_A,
				localBranch: 'dev'
			})
		).toBe(true);
	});
});

describe('shortCommitId display utility', () => {
	it('truncates a full SHA to 7 chars', () => {
		expect(shortCommitId(COMMIT_A)).toBe('5e88c13');
		expect(shortCommitId(COMMIT_B)).toBe('abcdef0');
	});

	it('passes through short values unchanged', () => {
		expect(shortCommitId('5e88c13')).toBe('5e88c13');
		expect(shortCommitId('abc')).toBe('abc');
	});

	it('normalizes null/undefined to "unknown"', () => {
		expect(shortCommitId(null)).toBe('unknown');
		expect(shortCommitId(undefined)).toBe('unknown');
	});
});

describe('pwa update false-positive regression', () => {
	it('matching full SHAs on main with same version report no update', () => {
		// Regression: previously the app embedded a 7-char SHA while the
		// GitHub API returned 40 chars, causing every check to falsely report
		// an update.  With both sides using full SHAs, exact equality works.
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.5.0',
				latestCommit: COMMIT_A,
				localVersion: '21.5.0',
				localCommit: COMMIT_A,
				localBranch: 'main'
			})
		).toBe(false);
	});

	it('matching full SHAs with same version but different commit reports update', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.5.0',
				latestCommit: COMMIT_B,
				localVersion: '21.5.0',
				localCommit: COMMIT_A,
				localBranch: 'main'
			})
		).toBe(true);
	});

	it('matching commits with higher upstream version reports update', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.6.0',
				latestCommit: COMMIT_A,
				localVersion: '21.5.0',
				localCommit: COMMIT_A,
				localBranch: 'main'
			})
		).toBe(true);
	});

	it('unknown local commit never reports update regardless of upstream', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '99.0.0',
				latestCommit: COMMIT_B,
				localVersion: '1.0.0',
				localCommit: 'unknown',
				localBranch: 'main'
			})
		).toBe(true); // version is still higher
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.5.0',
				latestCommit: COMMIT_B,
				localVersion: '21.5.0',
				localCommit: 'unknown',
				localBranch: 'main'
			})
		).toBe(false); // same version, unknown commit → no update
	});
});
