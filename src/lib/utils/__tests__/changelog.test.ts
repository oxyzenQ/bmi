// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

import { describe, expect, it } from 'vitest';
import { extractChangelogSection } from '../changelog';

const LEDGER = [
	'# Changelog',
	'## [Unreleased]',
	'',
	'### Added',
	'- **Unreleased work** _(ffffffff)_',
	'',
	'## [80.5.4]',
	'',
	'### Changed',
	'- **Internal research: the runtime-claim registry re-truthed** _(978adb1)_',
	'- **Internal research: the proof-tier LTS boundary** _(d11ddc5)_',
	'',
	'### Chore',
	'- **maintenance deps weekly** _(4994235)_',
	'',
	'## [80.5.3]',
	'',
	'### Changed',
	'- **an earlier release** _(aaaaaaa)_',
	''
].join('\n');

describe('extractChangelogSection', () => {
	it('extracts exactly the requested release section', () => {
		const section = extractChangelogSection(LEDGER, '80.5.4');
		expect(section).not.toBeNull();
		expect(section?.version).toBe('80.5.4');
		expect(section?.groups).toHaveLength(2);
		expect(section?.groups[0].title).toBe('Changed');
		expect(section?.groups[0].entries).toHaveLength(2);
		expect(section?.groups[0].entries[0]).toEqual({
			text: 'Internal research: the runtime-claim registry re-truthed',
			sha: '978adb1'
		});
		expect(section?.groups[1].title).toBe('Chore');
		expect(section?.groups[1].entries[0]).toEqual({
			text: 'maintenance deps weekly',
			sha: '4994235'
		});
	});

	it('never bleeds neighboring releases or Unreleased into the section', () => {
		const section = extractChangelogSection(LEDGER, '80.5.4');
		const flat = JSON.stringify(section);
		expect(flat).not.toContain('Unreleased work');
		expect(flat).not.toContain('an earlier release');
	});

	it('accepts the display form with the v prefix', () => {
		expect(extractChangelogSection(LEDGER, 'v80.5.4')?.version).toBe('80.5.4');
	});

	it('matches release headings that carry a suffix label', () => {
		const withSuffix = LEDGER.replace('## [80.5.4]', '## [80.5.4] — Stellar-v80.5.4');
		const section = extractChangelogSection(withSuffix, '80.5.4');
		expect(section?.groups).toHaveLength(2);
	});

	it('returns null for a version the ledger does not record', () => {
		expect(extractChangelogSection(LEDGER, '9.9.9')).toBeNull();
		expect(extractChangelogSection(LEDGER, '')).toBeNull();
	});

	it('keeps bullets that carry no digest and no bold markers intact', () => {
		const ledger = LEDGER.replace(
			'- **maintenance deps weekly** _(4994235)_',
			'- plain entry without decoration'
		);
		const section = extractChangelogSection(ledger, '80.5.4');
		expect(section?.groups[1].entries[0]).toEqual({
			text: 'plain entry without decoration',
			sha: null
		});
	});

	it('groups bullets that precede any heading under an empty title', () => {
		const ledger = [
			'## [80.5.4]',
			'- **loose bullet** _(abc1234)_',
			'',
			'### Changed',
			'- **grouped bullet**'
		].join('\n');
		const section = extractChangelogSection(ledger, '80.5.4');
		expect(section?.groups[0]).toEqual({
			title: '',
			entries: [{ text: 'loose bullet', sha: 'abc1234' }]
		});
		expect(section?.groups[1].entries[0]).toEqual({ text: 'grouped bullet', sha: null });
	});

	it('handles ledger line endings and suffix whitespace', () => {
		const crlf = LEDGER.replaceAll('\n', '\r\n');
		expect(extractChangelogSection(crlf, '80.5.4')?.groups).toHaveLength(2);
	});

	it('drops the gpg signature-ritual bullets from the shipped section', () => {
		// The release tooling records gpg verification output as ritual
		// bullets in the ledger. The shipped payload must never carry them:
		// the verification lines embed the signer identity, the exact
		// material the artifact provenance gate forbids in the bundle
		// (CI #719 - the signer contact rode the v80.5.5 section out).
		const ledger = [
			'## [80.5.5]',
			'',
			'### Changed',
			'- **** _(gpg: Signature made Thu 26 Nov 2026 08:12:04 PM WIB)_',
			'- **** _(gpg:                using EDDSA key 2B52187D2AB618A7591D45C9C7F8B07418899C4E)_',
			'- **** _(gpg: Good signature from "rezky_nightky (oxyzenQ) <oxyzenQ@proton.me>" [ultimate])_',
			'- **engrave the ux** _(e696f63)_',
			''
		].join('\n');
		const section = extractChangelogSection(ledger, '80.5.5');
		expect(section?.groups).toHaveLength(1);
		expect(section?.groups[0].entries).toHaveLength(1);
		expect(section?.groups[0].entries[0]).toEqual({ text: 'engrave the ux', sha: 'e696f63' });
		const flat = JSON.stringify(section);
		expect(flat).not.toContain('gpg:');
		expect(flat).not.toContain('oxyzenQ');
	});

	it('prunes a group emptied out by the ritual filter', () => {
		const ledger = [
			'## [80.5.5]',
			'',
			'### Changed',
			'- **** _(gpg: Signature made Thu 26 Nov 2026 08:12:04 PM WIB)_',
			''
		].join('\n');
		const section = extractChangelogSection(ledger, '80.5.5');
		expect(section?.groups).toHaveLength(0);
	});
});
