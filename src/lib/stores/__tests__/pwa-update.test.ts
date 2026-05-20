// Copyright (c) 2025 - 2026 rezky_nightky
import { describe, expect, it } from 'vitest';
import {
	commitsMatch,
	hasNewerCommit,
	isNewerUpstreamForBuild,
	normalizeBranch,
	normalizeCommitId,
	shouldUseCommitUpdateCheck
} from '../pwa-update';

describe('pwa update commit comparison', () => {
	it('normalizes missing commit values safely', () => {
		expect(normalizeCommitId(undefined)).toBe('unknown');
		expect(normalizeCommitId(' 161A9D3 ')).toBe('161a9d3');
	});

	it('treats full and short forms of the same commit as equal', () => {
		expect(commitsMatch('161a9d3f00ba47', '161a9d3')).toBe(true);
		expect(hasNewerCommit('161a9d3f00ba47', '161a9d3')).toBe(false);
	});

	it('does not report an update when local commit is unknown', () => {
		expect(hasNewerCommit('abcdef123456', 'unknown')).toBe(false);
		expect(hasNewerCommit('abcdef123456', null)).toBe(false);
	});

	it('reports a different reliable upstream commit as newer', () => {
		expect(hasNewerCommit('abcdef123456', '161a9d3')).toBe(true);
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
				latestCommit: 'abcdef123456',
				localVersion: '21.1.0',
				localCommit: '161a9d3',
				localBranch: 'dev'
			})
		).toBe(false);
	});

	it('still reports newer upstream versions on non-main builds', () => {
		expect(
			isNewerUpstreamForBuild({
				latestVersion: '21.2.0',
				latestCommit: 'abcdef123456',
				localVersion: '21.1.0',
				localCommit: '161a9d3',
				localBranch: 'dev'
			})
		).toBe(true);
	});
});
