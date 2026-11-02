// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
//
// Policy-gated dependency audit for CI and local runs.
//
// Replaces the raw `bun audit` gate, which failed whenever ANY advisory was
// published against a pinned transitive dependency, even when no fixed
// release existed within the pinned major. That turned main permanently red
// during dormant periods (the September-November 2026 incidents).
//
// Policy:
// - critical/high/moderate advisories FAIL unless an unexpired allowlist
//   entry covers them.
// - low advisories are reported as warnings and never fail the gate.
// - allowlist entries live in scripts/audit-allowlist.json and MUST carry a
//   reason plus an expiry date. Expired entries fail with a re-review
//   message so the list can never rot into a permanent silence switch.
// - a severity mismatch between the entry and the live advisory also fails,
//   forcing a re-review when an advisory is upgraded.

import { readFileSync } from 'node:fs';

interface Advisory {
	name: string;
	severity: string;
	ghsa: string;
	title: string;
	url: string;
	vulnerableVersions: string;
}

interface AllowlistEntry {
	id: string;
	package: string;
	severity: string;
	reason: string;
	expires: string;
}

const ALLOWLIST_PATH = 'scripts/audit-allowlist.json';
const BLOCKING_SEVERITIES = new Set(['critical', 'high', 'moderate']);
const KNOWN_SEVERITIES = new Set(['critical', 'high', 'moderate', 'low']);

function loadAllowlist(): AllowlistEntry[] {
	const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as { entries?: AllowlistEntry[] };
	return Array.isArray(raw.entries) ? raw.entries : [];
}

function parseAdvisories(output: string): Advisory[] {
	const start = output.indexOf('{');
	if (start < 0) {
		throw new Error('bun audit produced no JSON object');
	}
	const data = JSON.parse(output.slice(start)) as Record<string, unknown>;
	const advisories: Advisory[] = [];
	for (const [pkg, value] of Object.entries(data)) {
		const list = Array.isArray(value) ? value : [value];
		for (const item of list) {
			const a = item as Record<string, unknown>;
			const url = typeof a.url === 'string' ? a.url : '';
			const severity = typeof a.severity === 'string' ? a.severity : 'unknown';
			if (!KNOWN_SEVERITIES.has(severity)) {
				throw new Error(`unknown severity "${severity}" for ${pkg}; failing closed`);
			}
			advisories.push({
				name: pkg,
				severity,
				ghsa: url.split('/').pop() ?? '',
				title: typeof a.title === 'string' ? a.title : '',
				url,
				vulnerableVersions: typeof a.vulnerable_versions === 'string' ? a.vulnerable_versions : ''
			});
		}
	}
	return advisories;
}

function isExpired(expires: string, now: Date): boolean {
	// Expiry is date-only (UTC); an entry expires at 00:00 UTC on its date.
	return new Date(`${expires}T00:00:00Z`).getTime() <= now.getTime();
}

const now = new Date();
const allowlist = loadAllowlist();
const byId = new Map(allowlist.map((e) => [e.id, e]));

console.log(`Dependency audit policy (bun audit, ${now.toISOString().slice(0, 10)})`);

const proc = Bun.spawnSync(['bun', 'audit', '--json'], {
	stdout: 'pipe',
	stderr: 'pipe'
});
const advisories = parseAdvisories(new TextDecoder().decode(proc.stdout));

const blocked: Advisory[] = [];
const allowed: Array<{ advisory: Advisory; entry: AllowlistEntry }> = [];
const warnings: Advisory[] = [];

for (const advisory of advisories) {
	const entry = byId.get(advisory.ghsa);
	if (entry) {
		if (entry.package !== advisory.name) {
			console.error(
				`ALLOWLIST MISMATCH: entry ${entry.id} declares package ${entry.package} but the advisory targets ${advisory.name}. Re-review the entry.`
			);
			blocked.push(advisory);
		} else if (entry.severity !== advisory.severity) {
			console.error(
				`ALLOWLIST STALE: entry ${entry.id} declares severity ${entry.severity} but the advisory is now ${advisory.severity}. Re-review the entry.`
			);
			blocked.push(advisory);
		} else if (isExpired(entry.expires, now)) {
			console.error(
				`ALLOWLIST EXPIRED: entry ${entry.id} expired on ${entry.expires}. Re-review the advisory: either fix it via an override bump or extend the expiry with a fresh reason.`
			);
			blocked.push(advisory);
		} else {
			allowed.push({ advisory, entry });
		}
	} else if (BLOCKING_SEVERITIES.has(advisory.severity)) {
		blocked.push(advisory);
	} else {
		warnings.push(advisory);
	}
}

console.log(`\nAudit DB reports ${advisories.length} advisory record(s).`);

if (warnings.length > 0) {
	console.log(`\nWarnings (low severity, non-blocking):`);
	for (const w of warnings) {
		console.log(`  ${w.name} severity=${w.severity} ${w.ghsa} ${w.title}`);
	}
}

if (allowed.length > 0) {
	console.log(`\nAllowlisted (accepted with a reason and expiry):`);
	for (const { advisory, entry } of allowed) {
		console.log(
			`  ${advisory.name} ${entry.id} severity=${advisory.severity} expires=${entry.expires}: ${entry.reason}`
		);
	}
}

if (blocked.length > 0) {
	console.error(
		`\nBLOCKING advisories (${blocked.length}) — severity >= moderate and not accepted:`
	);
	for (const b of blocked) {
		console.error(
			`  ${b.name} severity=${b.severity} range=${b.vulnerableVersions} ${b.ghsa} ${b.title}`
		);
		console.error(`    ${b.url}`);
	}
	console.error(
		'\nRemediation: bump the relevant override in package.json (see DORMANT.md), or, if no fixed release exists within the pinned major, add a temporary allowlist entry with a reason and expiry in scripts/audit-allowlist.json.'
	);
	process.exit(1);
}

console.log('\nDependency audit policy passed.');
