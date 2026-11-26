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
 * The signature-verification ritual bullets the release tooling records
 * in the ledger (`- **** _(gpg: Signature made ...)_`): empty subjects,
 * the verification output riding in the reference slot. They are
 * provenance noise, not release content, and they carry the signer
 * identity - the one material the artifact provenance gate forbids in
 * any shipped payload (scripts/gates/check-artifact-provenance.ts,
 * identityNeedles: CI #719 shipped the signer contact inside the
 * version section the app bundles). The ledger keeps the ritual; every
 * consumer of this extractor - the virtual module and the UI it feeds -
 * ships without it.
 *
 * The shape is matched on the stable part, not on one paste: the
 * verification output always opens with the literal `(gpg:`, and the
 * markdown decoration in front of it is variance from the paste, not
 * content. Any run of bold markers, italic slots, and spaces before
 * that literal marks the bullet as ritual (`- **** _(gpg: ...)_`,
 * `- **_(gpg: ...)_**`, `- _**(gpg: ...)**_`, a bare or widened
 * reference slot) - the ritual output itself never starts a real
 * release entry, so the match cannot eat a genuine one.
 */
const GPG_RITUAL_BULLET = /^[*_ \t]*\(gpg:/;

/**
 * Extract the section the ledger records for `version` (a leading `v`
 * is accepted and dropped). Returns null when the ledger holds no such
 * section, and equally when the recorded section dissolves into ritual
 * bullets alone (the filter above empties every group) - both render
 * the honest empty state instead of inventing content or shipping a
 * shell. The section ends at the next `## ` heading, so Unreleased and
 * other releases never bleed into it.
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
			if (GPG_RITUAL_BULLET.test(bulletMatch[1])) continue;
			if (!current) {
				current = { title: '', entries: [] };
				groups.push(current);
			}
			current.entries.push(parseEntry(bulletMatch[1]));
		}
	}
	if (!inSection) return null;
	// The filter above can empty a group out (a heading followed only by
	// ritual bullets); the payload invariant is that a shipped group
	// carries at least one entry, so prune the shells. A section left
	// with no groups at all is no section: null, so the UI renders the
	// honest empty state instead of a version heading over a blank body.
	const filled = groups.filter((group) => group.entries.length > 0);
	if (filled.length === 0) return null;
	return { version: wanted, groups: filled };
}
