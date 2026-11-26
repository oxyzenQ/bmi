// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

import { describe, expect, it } from 'vitest';
import { extractChangelogHistory, extractChangelogSection } from '../changelog';

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

	it('drops ritual bullets whatever decoration the paste carries', () => {
		// The boundary matches the stable reference slot, not one paste
		// shape: bold residue without the space, a bold-wrapped reference,
		// a bare reference slot, and a widened space run all ride out too.
		const ledger = [
			'## [80.5.6]',
			'',
			'### Changed',
			'- **_(gpg: Signature made Thu 26 Nov 2026 08:12:04 PM WIB)_**',
			'- _**(gpg: using EDDSA key 2B52187D2AB618A7591D45C9C7F8B07418899C4E)**_',
			'- _(gpg: Good signature from "rezky_nightky (oxyzenQ) <oxyzenQ@proton.me>" [ultimate])_',
			'- ****    _(gpg: aka "Rezky Cahya Sahputra <130107241+oxyzenQ@users.noreply.github.com>" [ultimate])_',
			'- **engrave the ux** _(e696f63)_',
			''
		].join('\n');
		const section = extractChangelogSection(ledger, '80.5.6');
		expect(section?.groups).toHaveLength(1);
		expect(section?.groups[0].entries).toHaveLength(1);
		expect(section?.groups[0].entries[0]).toEqual({ text: 'engrave the ux', sha: 'e696f63' });
		const flat = JSON.stringify(section);
		expect(flat).not.toContain('gpg:');
		expect(flat).not.toContain('oxyzenQ');
		expect(flat).not.toContain('noreply');
	});

	it('ships the honest empty state when a section dissolves to ritual bullets alone', () => {
		const ledger = [
			'## [80.5.5]',
			'',
			'### Changed',
			'- **** _(gpg: Signature made Thu 26 Nov 2026 08:12:04 PM WIB)_',
			''
		].join('\n');
		// No groups is no section: null, so the UI renders the honest
		// empty state instead of a version heading over a blank body.
		expect(extractChangelogSection(ledger, '80.5.5')).toBeNull();
	});
});

describe('extractChangelogHistory', () => {
	it('walks every recorded release section newest first', () => {
		const history = extractChangelogHistory(LEDGER);
		expect(history.map((section) => section.version)).toEqual(['80.5.4', '80.5.3']);
		expect(history[0].groups).toHaveLength(2);
		expect(history[0].groups[0].entries[0].text).toBe(
			'Internal research: the runtime-claim registry re-truthed'
		);
	});

	it('never ships the book headings or their bodies', () => {
		const ledger = [
			'# Changelog',
			'## [Released]',
			'',
			'v80.5.4',
			'v80.5.3',
			'',
			'## [80.5.4]',
			'',
			'### Changed',
			'- **a real entry** _(aaaaaaa)_',
			'',
			'## [Unreleased]',
			'',
			'### Added',
			'- **unreleased churn** _(bbbbbbb)_',
			'- **** _(gpg: Signature made Thu 26 Nov 2026 08:12:04 PM WIB)_',
			''
		].join('\n');
		const history = extractChangelogHistory(ledger);
		expect(history).toHaveLength(1);
		expect(history[0].version).toBe('80.5.4');
		const flat = JSON.stringify(history);
		expect(flat).not.toContain('unreleased churn');
		expect(flat).not.toContain('gpg:');
		// The bare version ledger lines are bookkeeping, not sections or
		// entries: nothing under the Released heading becomes a record.
		expect(flat).not.toContain('"80.5.3"');
	});

	it('drops ritual bullets and ritual-only sections across the whole history', () => {
		const ledger = [
			'## [80.5.6]',
			'',
			'### Changed',
			'- **_(gpg: Signature made Thu 26 Nov 2026 08:12:04 PM WIB)_**',
			'- **the newest entry** _(ccccccc)_',
			'',
			'## [80.5.5]',
			'',
			'### Changed',
			'- **** _(gpg: Good signature from "rezky_nightky (oxyzenQ) <oxyzenQ@proton.me>" [ultimate])_',
			''
		].join('\n');
		const history = extractChangelogHistory(ledger);
		expect(history.map((section) => section.version)).toEqual(['80.5.6']);
		expect(history[0].groups[0].entries).toHaveLength(1);
		const flat = JSON.stringify(history);
		expect(flat).not.toContain('gpg:');
		expect(flat).not.toContain('oxyzenQ');
		expect(flat).not.toContain('noreply');
	});

	it('keeps per-section untitled groups and suffix labels honest', () => {
		const ledger = [
			'## [80.5.4] — Stellar-v80.5.4',
			'- **loose bullet** _(abc1234)_',
			'',
			'### Changed',
			'- **grouped bullet**',
			''
		].join('\n');
		const history = extractChangelogHistory(ledger);
		expect(history).toHaveLength(1);
		expect(history[0].version).toBe('80.5.4');
		expect(history[0].groups[0].title).toBe('');
		expect(history[0].groups[0].entries[0]).toEqual({ text: 'loose bullet', sha: 'abc1234' });
		expect(history[0].groups[1].entries[0]).toEqual({ text: 'grouped bullet', sha: null });
	});

	it('handles ledger line endings across the whole walk', () => {
		const crlf = LEDGER.replaceAll('\n', '\r\n');
		expect(extractChangelogHistory(crlf).map((section) => section.version)).toEqual([
			'80.5.4',
			'80.5.3'
		]);
	});
});
