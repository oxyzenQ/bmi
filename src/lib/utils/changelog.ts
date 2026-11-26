// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The Keep-a-Changelog ledger reader: pure string work over the
 * repository's CHANGELOG.md - no network, no runtime file access. The
 * vite config serves the result as a virtual module at build time, so
 * the bundle carries the recorded release history and every build
 * re-reads the ledger: there is no generated artifact that can go
 * stale, and the "latest commit" churn never reaches the UI.
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
 * The book headings that organize the ledger but record no release
 * content of their own. `## [Released]` holds the bare version ledger
 * (the newest-first list the release tooling maintains) and
 * `## [Unreleased]` holds the fresh anchor that starts empty after
 * every release - their bodies are bookkeeping, never shipped content.
 */
const LEDGER_BOOK_HEADINGS = new Set(['Unreleased', 'Released']);

const RELEASE_HEADING = /^## \[([^\]]+)\](?:\s.*)?$/;

/**
 * One release section under construction: the heading's version plus
 * the groups and bullets collected until the next `## ` heading.
 */
interface SectionBuilder {
	version: string;
	groups: ChangelogGroup[];
	current: ChangelogGroup | null;
}

/** Close a builder: prune group shells, keep only sections with content. */
function finalize(builder: SectionBuilder | null, sections: ChangelogSection[]): void {
	if (!builder) return;
	// The ritual filter can empty a group out (a heading followed only by
	// ritual bullets); the payload invariant is that a shipped group
	// carries at least one entry, so prune the shells. A section left
	// with no groups at all is no section: it never enters the history,
	// so the UI cannot render a version heading over a blank body.
	const filled = builder.groups.filter((group) => group.entries.length > 0);
	if (filled.length === 0) return;
	sections.push({ version: builder.version, groups: filled });
}

/**
 * Walk the whole ledger and return every recorded release section,
 * newest first (the file's own order). Book headings and their bodies
 * never ship, ritual bullets ride out of every section, and a section
 * that dissolves into ritual alone is dropped - the history carries
 * exactly what the ledger recorded, nothing invented, nothing hidden.
 */
export function extractChangelogHistory(markdown: string): ChangelogSection[] {
	const sections: ChangelogSection[] = [];
	let builder: SectionBuilder | null = null;
	let collecting = false;
	for (const line of markdown.split(/\r?\n/)) {
		const heading = line.match(RELEASE_HEADING);
		if (heading) {
			finalize(builder, sections);
			const version = heading[1].trim().replace(/^v/, '');
			// The book headings organize the ledger instead of recording a
			// release; only a real version heading opens a collecting block.
			collecting = version.length > 0 && !LEDGER_BOOK_HEADINGS.has(version);
			builder = collecting ? { version, groups: [], current: null } : null;
			continue;
		}
		if (/^## /.test(line)) {
			// A non-release `## ` heading closes whatever was collecting.
			finalize(builder, sections);
			collecting = false;
			builder = null;
			continue;
		}
		if (!collecting || !builder) continue;
		const groupMatch = line.match(/^### (.+)$/);
		if (groupMatch) {
			builder.current = { title: groupMatch[1].trim(), entries: [] };
			builder.groups.push(builder.current);
			continue;
		}
		const bulletMatch = line.match(/^- (.+)$/);
		if (bulletMatch) {
			if (GPG_RITUAL_BULLET.test(bulletMatch[1])) continue;
			if (!builder.current) {
				builder.current = { title: '', entries: [] };
				builder.groups.push(builder.current);
			}
			builder.current.entries.push(parseEntry(bulletMatch[1]));
		}
	}
	finalize(builder, sections);
	return sections;
}

/**
 * Extract the section the ledger records for `version` (a leading `v`
 * is accepted and dropped). Returns null when the ledger holds no such
 * section, and equally when the recorded section dissolves into ritual
 * bullets alone (the filter empties every group) - both render the
 * honest empty state instead of inventing content or shipping a shell.
 */
export function extractChangelogSection(
	markdown: string,
	version: string
): ChangelogSection | null {
	const wanted = version.trim().replace(/^v/, '');
	if (!wanted) return null;
	return extractChangelogHistory(markdown).find((section) => section.version === wanted) ?? null;
}
