// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The Keep-a-Changelog section extractor: one release version in, its
 * recorded section out. Pure string work over the repository's
 * CHANGELOG.md - no network, no runtime file access. The vite config
 * serves the result as a virtual module at build time, so the bundle
 * carries only the current version's section and every build re-reads
 * the ledger: there is no generated artifact that can go stale, and
 * the "latest commit" churn never reaches the UI.
 */

export interface ChangelogEntry {
	/** The entry text, with the ledger's markdown bold markers stripped. */
	text: string;
	/** The commit digest suffix `_(abc1234)_` when the ledger records one. */
	sha: string | null;
}

export interface ChangelogGroup {
	/** The `### Heading` title; empty when bullets precede any heading. */
	title: string;
	entries: ChangelogEntry[];
}

export interface ChangelogSection {
	version: string;
	groups: ChangelogGroup[];
}

/** Split `entry text _(abc1234)_` into the text plus its digest. */
function parseEntry(raw: string): ChangelogEntry {
	const text = raw.replaceAll('**', '').trim();
	const shaMatch = text.match(/ _\(([0-9a-f]{7,40})\)_$/);
	if (!shaMatch) return { text, sha: null };
	return { text: text.slice(0, shaMatch.index).trim(), sha: shaMatch[1] };
}

/**
 * Extract the section the ledger records for `version` (a leading `v`
 * is accepted and dropped). Returns null when the ledger holds no such
 * section - the caller renders the honest empty state instead of
 * inventing content. The section ends at the next `## ` heading, so
 * Unreleased and other releases never bleed into it.
 */
export function extractChangelogSection(
	markdown: string,
	version: string
): ChangelogSection | null {
	const wanted = version.trim().replace(/^v/, '');
	if (!wanted) return null;
	const escaped = wanted.replaceAll('.', '\\.');
	const heading = new RegExp(`^## \\[${escaped}\\](?:\\s.*)?$`);
	const lines = markdown.split(/\r?\n/);
	let inSection = false;
	const groups: ChangelogGroup[] = [];
	let current: ChangelogGroup | null = null;
	for (const line of lines) {
		if (!inSection) {
			if (heading.test(line)) inSection = true;
			continue;
		}
		if (/^## /.test(line)) break;
		const groupMatch = line.match(/^### (.+)$/);
		if (groupMatch) {
			current = { title: groupMatch[1].trim(), entries: [] };
			groups.push(current);
			continue;
		}
		const bulletMatch = line.match(/^- (.+)$/);
		if (bulletMatch) {
			if (!current) {
				current = { title: '', entries: [] };
				groups.push(current);
			}
			current.entries.push(parseEntry(bulletMatch[1]));
		}
	}
	if (!inSection) return null;
	return { version: wanted, groups };
}
