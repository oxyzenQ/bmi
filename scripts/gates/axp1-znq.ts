// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

//
// THE AXP1-ZNQ SOLID-DEFENSE VERDICT ENGINE (night-solid-defense-1).
//
// AXP1-ZnQ is the scheduled supply-chain defense bot behind the Sunday
// guardian anchor. maintenance.yml refreshes the lockfile every Sunday
// 10:00 WIB and commits whatever survives validation; this engine rides
// right after it and answers the one question the raw audit gates never
// ask: of the dangerous advisories in the tree, which ones CAN the
// automated lane still fix, and which ones it NEVER will - so the owner
// only wakes up for the second kind.
//
// The classification is ground truth, not semver guessing. The engine
// replays the exact remediation the maintenance lane runs (a maximal
// `bun update --lockfile-only` inside an isolated scratch tree), then
// re-audits the refreshed scratch lock against the same advisory DB:
//
//   accepted    - covered by an unexpired, matching allowlist entry
//                 (scripts/audit-allowlist.json). Reported, no verdict.
//   note        - low severity. Reported, never blocks.
//   updatable   - the scratch refresh clears the advisory. Verdict
//                 UPDATE-SOON, exit 0 with loud warnings: the fix is one
//                 compatible bump away - run the maintenance lane now or
//                 merge its Sunday commit before this rides another week.
//   persistent  - survives the refresh. Verdict CALL-OWNER, exit 1: no
//                 fixed release exists inside the pinned ranges, so the
//                 fix is an override bump or a major upgrade - an owner
//                 decision the robot refuses to make.
//   regression  - absent before the refresh, present after it (the
//                 arrayref class: a newly republished vulnerable release
//                 rode a semver-compatible range). CALL-OWNER, exit 1.
//   escalated   - a stale allowlist entry (expired, package/severity
//                 mismatch) or an unknown severity string - the same
//                 fail-closed law audit-deps.ts enforces. CALL-OWNER, 1.
//
// Verdicts: CLEAN (exit 0), UPDATE-SOON (exit 0, annotated), CALL-OWNER
// (exit 1, hard). Anything the engine cannot verify fails closed: a
// failed remediation replay or an unreadable audit is a CALL-OWNER tree.
//
// `bun run audit:axp1-znq --selftest` replays every class from
// scripts/gates/fixtures/axp1-znq/scenarios.json with a frozen clock and
// asserts the verdict plus exit code - no network. The engine proves
// itself before the network gets a vote.

import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

type AdvisoryClass =
	| 'accepted'
	| 'note'
	| 'updatable'
	| 'persistent'
	| 'regression'
	| 'escalated-allowlist'
	| 'escalated-unknown-severity';

type BotVerdict = 'CLEAN' | 'UPDATE-SOON' | 'CALL-OWNER';

interface ClassifiedAdvisory {
	advisory: Advisory;
	class: AdvisoryClass;
	detail: string;
}

interface VerdictReport {
	verdict: BotVerdict;
	exitCode: 0 | 1;
	accepted: ClassifiedAdvisory[];
	notes: ClassifiedAdvisory[];
	updatable: ClassifiedAdvisory[];
	escalations: ClassifiedAdvisory[];
}

interface ScenarioFixture {
	name: string;
	baselineAdvisories: Advisory[];
	survivingAdvisories: Advisory[];
	allowlist: AllowlistEntry[];
	expectedVerdict: BotVerdict;
	expectedExitCode: number;
}

const ALLOWLIST_PATH = 'scripts/audit-allowlist.json';
const FIXTURES_PATH = 'scripts/gates/fixtures/axp1-znq/scenarios.json';
const KNOWN_SEVERITIES = new Set(['critical', 'high', 'moderate', 'low']);
// The self-test replays the fixtures against a frozen clock so the
// expired-entry scenario stays expired and the valid ones stay valid,
// forever. Real runs use the wall clock.
const SELFTEST_FROZEN_NOW = '2026-06-01T00:00:00Z';
const UPDATE_TIMEOUT_MS = 180_000;
const AUDIT_TIMEOUT_MS = 120_000;

const ESCALATION_CLASSES: ReadonlySet<AdvisoryClass> = new Set([
	'persistent',
	'regression',
	'escalated-allowlist',
	'escalated-unknown-severity'
]);

function advisoryKey(advisory: Advisory): string {
	return `${advisory.ghsa}|${advisory.name}`;
}

function keySet(advisories: Advisory[]): Set<string> {
	return new Set(advisories.map(advisoryKey));
}

// The union of the two audits is what gets classified: an advisory only
// the refresh introduced (the regression class) never appeared in the
// baseline audit, and skipping the union would silently miss it.
function mergeAdvisories(baseline: Advisory[], surviving: Advisory[]): Advisory[] {
	const byKey = new Map<string, Advisory>();
	for (const advisory of baseline) {
		byKey.set(advisoryKey(advisory), advisory);
	}
	for (const advisory of surviving) {
		if (!byKey.has(advisoryKey(advisory))) {
			byKey.set(advisoryKey(advisory), advisory);
		}
	}
	return [...byKey.values()];
}

function loadAllowlist(): AllowlistEntry[] {
	const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as { entries?: AllowlistEntry[] };
	return Array.isArray(raw.entries) ? raw.entries : [];
}

function isExpired(expires: string, now: Date): boolean {
	// Expiry is date-only (UTC); an entry expires at 00:00 UTC on its date.
	return new Date(`${expires}T00:00:00Z`).getTime() <= now.getTime();
}

// Mirrors scripts/gates/audit-deps.ts: bun audit --json emits one object
// keyed by package name, each value an advisory record or an array of
// them. Verified empirically: a clean tree prints `{}` and exits 0; a
// tree with advisories prints the object and exits 1.
function parseBunAudit(output: string): Advisory[] {
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
			advisories.push({
				name: pkg,
				severity: typeof a.severity === 'string' ? a.severity : 'unknown',
				ghsa: url.split('/').pop() ?? '',
				title: typeof a.title === 'string' ? a.title : '',
				url,
				vulnerableVersions: typeof a.vulnerable_versions === 'string' ? a.vulnerable_versions : ''
			});
		}
	}
	return advisories;
}

function firstLine(text: string): string {
	return (
		text
			.split('\n')
			.find((line) => line.trim().length > 0)
			?.trim() ?? ''
	);
}

function runBunAudit(cwd: string): Advisory[] {
	const proc = Bun.spawnSync(['bun', 'audit', '--json'], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
		timeout: AUDIT_TIMEOUT_MS
	});
	const output = new TextDecoder().decode(proc.stdout);
	const start = output.indexOf('{');
	if (start < 0) {
		// Exit 0 with no JSON means a clean audit said so in prose; exit
		// non-zero with no JSON means the audit itself broke - that is
		// unverifiable, and unverifiable fails closed one level up.
		if (proc.exitCode !== 0) {
			throw new Error(
				`bun audit broke (exit ${proc.exitCode}): ${firstLine(new TextDecoder().decode(proc.stderr))}`
			);
		}
		return [];
	}
	return parseBunAudit(output.slice(start));
}

function classifyAdvisories(
	advisories: Advisory[],
	allowlist: AllowlistEntry[],
	baselineKeys: Set<string>,
	survivingKeys: Set<string>,
	now: Date
): ClassifiedAdvisory[] {
	const byId = new Map(allowlist.map((entry) => [entry.id, entry]));
	const classified: ClassifiedAdvisory[] = [];
	for (const advisory of advisories) {
		const key = advisoryKey(advisory);
		const entry = byId.get(advisory.ghsa);
		if (entry) {
			if (entry.package !== advisory.name || entry.severity !== advisory.severity) {
				classified.push({
					advisory,
					class: 'escalated-allowlist',
					detail: `allowlist entry ${entry.id} declares ${entry.package}/${entry.severity} but the advisory is ${advisory.name}/${advisory.severity} - re-review`
				});
			} else if (isExpired(entry.expires, now)) {
				classified.push({
					advisory,
					class: 'escalated-allowlist',
					detail: `allowlist entry ${entry.id} expired on ${entry.expires} - re-review or fix via an override bump`
				});
			} else {
				classified.push({
					advisory,
					class: 'accepted',
					detail: `accepted until ${entry.expires}: ${entry.reason}`
				});
			}
			continue;
		}
		if (advisory.severity === 'low') {
			classified.push({
				advisory,
				class: 'note',
				detail: 'low severity is reported, never blocks'
			});
			continue;
		}
		if (!KNOWN_SEVERITIES.has(advisory.severity)) {
			classified.push({
				advisory,
				class: 'escalated-unknown-severity',
				detail: `unknown severity "${advisory.severity}" - failing closed`
			});
			continue;
		}
		if (!survivingKeys.has(key)) {
			classified.push({
				advisory,
				class: 'updatable',
				detail:
					'the remediation replay clears it - one compatible refresh away, run the maintenance lane'
			});
		} else if (!baselineKeys.has(key)) {
			classified.push({
				advisory,
				class: 'regression',
				detail:
					'the compatible refresh itself resolved a vulnerable release (the arrayref regression class)'
			});
		} else {
			classified.push({
				advisory,
				class: 'persistent',
				detail:
					'no fixed release inside the pinned ranges - the automated lane cannot fix it, an owner decision is required'
			});
		}
	}
	return classified;
}

function resolveVerdict(classified: ClassifiedAdvisory[]): VerdictReport {
	const accepted = classified.filter((c) => c.class === 'accepted');
	const notes = classified.filter((c) => c.class === 'note');
	const updatable = classified.filter((c) => c.class === 'updatable');
	const escalations = classified.filter((c) => ESCALATION_CLASSES.has(c.class));
	if (escalations.length > 0) {
		return { verdict: 'CALL-OWNER', exitCode: 1, accepted, notes, updatable, escalations };
	}
	if (updatable.length > 0) {
		return { verdict: 'UPDATE-SOON', exitCode: 0, accepted, notes, updatable, escalations };
	}
	return { verdict: 'CLEAN', exitCode: 0, accepted, notes, updatable, escalations };
}

function emitAnnotations(report: VerdictReport): void {
	for (const c of report.updatable) {
		console.log(
			`::warning title=AXP1-ZnQ UPDATE-SOON::${c.advisory.name} ${c.advisory.ghsa}: ${c.detail}`
		);
	}
	for (const c of report.escalations) {
		console.log(
			`::error title=AXP1-ZnQ CALL-OWNER::${c.advisory.name} ${c.advisory.ghsa}: ${c.detail}`
		);
	}
}

// A markdown table cell cannot carry raw backslashes, pipes, or line
// breaks: a pre-existing backslash would turn a later pipe escape into a
// literal pair (the incomplete-escaping class CodeQL flags), a pipe
// splits the row, a line break ends it. Written out as a per-character
// walk so the contract is the code: every special character is handled,
// nothing is left half-escaped. Advisory titles and allowlist reasons
// are registry-fed text, never trusted raw.
function mdCell(value: string): string {
	let cell = '';
	for (const ch of value) {
		if (ch === '\\') {
			cell += '\\\\';
		} else if (ch === '|') {
			cell += '\\|';
		} else if (ch === '\n' || ch === '\r') {
			cell += ' ';
		} else {
			cell += ch;
		}
	}
	return cell;
}

function writeStepSummary(report: VerdictReport, now: Date): void {
	const summaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (!summaryPath) {
		return;
	}
	const rows = (list: ClassifiedAdvisory[]): string[] =>
		list.map(
			(c) =>
				`| ${mdCell(c.class)} | ${mdCell(c.advisory.name)} | ${mdCell(c.advisory.severity)} | ${mdCell(c.advisory.ghsa)} | ${mdCell(c.detail)} |`
		);
	const lines = [
		'## AXP1-ZnQ solid-defense verdict',
		'',
		`**Verdict: ${report.verdict}** (exit ${report.exitCode}) - ${now.toISOString()}`,
		'',
		`Accepted: ${report.accepted.length} | Notes: ${report.notes.length} | Update-soon: ${report.updatable.length} | Call-owner: ${report.escalations.length}`,
		'',
		'| class | package | severity | advisory | remediation |',
		'| --- | --- | --- | --- | --- |',
		...rows([...report.escalations, ...report.updatable, ...report.accepted, ...report.notes]),
		'',
		report.verdict === 'CALL-OWNER'
			? 'The automated lane cannot resolve every dangerous advisory: this needs an owner decision now.'
			: report.verdict === 'UPDATE-SOON'
				? 'Every dangerous advisory is one compatible refresh away from gone: run the maintenance lane, do not ignore it.'
				: 'No dangerous advisory needs the owner today. The dragon can keep sleeping.'
	];
	appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}

function printReport(report: VerdictReport, now: Date): void {
	console.log(`AXP1-ZnQ solid-defense verdict (${now.toISOString().slice(0, 10)})`);
	if (report.accepted.length > 0) {
		console.log('\nAccepted (allowlisted with a reason and expiry):');
		for (const c of report.accepted) {
			console.log(
				`  ${c.advisory.name} ${c.advisory.ghsa} severity=${c.advisory.severity}: ${c.detail}`
			);
		}
	}
	if (report.notes.length > 0) {
		console.log('\nNotes (low severity, non-blocking):');
		for (const c of report.notes) {
			console.log(`  ${c.advisory.name} ${c.advisory.ghsa} ${c.advisory.title}`);
		}
	}
	if (report.updatable.length > 0) {
		console.log(
			'\nUPDATE-SOON (a compatible refresh clears these - do not let them ride another week):'
		);
		for (const c of report.updatable) {
			console.log(
				`  ${c.advisory.name} severity=${c.advisory.severity} ${c.advisory.ghsa} ${c.advisory.title}`
			);
			console.log(`    ${c.detail}`);
			console.log(`    ${c.advisory.url}`);
		}
	}
	if (report.escalations.length > 0) {
		console.log('\nCALL-OWNER (the automated lane cannot fix these):');
		for (const c of report.escalations) {
			console.log(
				`  ${c.advisory.name} severity=${c.advisory.severity} ${c.advisory.ghsa} ${c.advisory.title}`
			);
			console.log(`    ${c.detail}`);
			console.log(`    ${c.advisory.url}`);
		}
	}
	console.log('');
	if (report.verdict === 'CALL-OWNER') {
		console.log(
			`Verdict: CALL-OWNER - ${report.escalations.length} dangerous advisory(ies) need an owner decision.`
		);
	} else if (report.verdict === 'UPDATE-SOON') {
		console.log(
			`Verdict: UPDATE-SOON - ${report.updatable.length} advisory(ies) must be refreshed soon; the maintenance lane fixes them.`
		);
	} else {
		console.log('Verdict: CLEAN - no dangerous advisory needs the owner today.');
	}
}

function copyTreeInputs(scratch: string): void {
	// The replay must see exactly what the maintenance lane sees: the
	// manifest (with its overrides), the lock it refreshes, and any
	// registry configuration the resolver honors.
	cpSync('package.json', join(scratch, 'package.json'));
	cpSync('bun.lock', join(scratch, 'bun.lock'));
	if (existsSync('.npmrc')) {
		cpSync('.npmrc', join(scratch, '.npmrc'));
	}
	if (existsSync('bunfig.toml')) {
		cpSync('bunfig.toml', join(scratch, 'bunfig.toml'));
	}
}

function runReal(now: Date): number {
	console.log(`AXP1-ZnQ solid-defense scan (${now.toISOString()})`);
	if (!existsSync('bun.lock')) {
		console.error('FAIL: bun.lock not found - run from the repository root');
		return 1;
	}

	console.log('Replaying the maintenance remediation inside an isolated scratch tree...');
	const scratch = mkdtempSync(join(tmpdir(), 'axp1-znq-'));
	let classified: ClassifiedAdvisory[];
	try {
		const baseline = runBunAudit(process.cwd());
		console.log(`Baseline audit: ${baseline.length} advisory record(s).`);
		copyTreeInputs(scratch);
		const update = Bun.spawnSync(['bun', 'update', '--lockfile-only'], {
			cwd: scratch,
			stdout: 'pipe',
			stderr: 'pipe',
			timeout: UPDATE_TIMEOUT_MS
		});
		if (update.exitCode !== 0) {
			const stderr = firstLine(new TextDecoder().decode(update.stderr));
			console.error(
				`FAIL: the remediation replay could not refresh the scratch lockfile (exit ${update.exitCode}).`
			);
			if (stderr) {
				console.error(`  ${stderr.slice(0, 2000)}`);
			}
			console.error('Failing closed: an unverifiable replay is a CALL-OWNER tree.');
			return 1;
		}
		const surviving = runBunAudit(scratch);
		console.log(`Post-refresh audit: ${surviving.length} advisory record(s).`);
		classified = classifyAdvisories(
			mergeAdvisories(baseline, surviving),
			loadAllowlist(),
			keySet(baseline),
			keySet(surviving),
			now
		);
	} catch (error) {
		console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
		console.error('Failing closed: an unreadable audit is a CALL-OWNER tree.');
		return 1;
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}

	const report = resolveVerdict(classified);
	printReport(report, now);
	emitAnnotations(report);
	writeStepSummary(report, now);
	return report.exitCode;
}

function runSelftest(): number {
	console.log('AXP1-ZnQ self-test (frozen clock, no network)');
	const raw = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8')) as { scenarios?: ScenarioFixture[] };
	const scenarios = Array.isArray(raw.scenarios) ? raw.scenarios : [];
	if (scenarios.length === 0) {
		console.error(`FAIL: no scenarios found in ${FIXTURES_PATH}`);
		return 1;
	}
	const now = new Date(SELFTEST_FROZEN_NOW);
	let failed = 0;
	for (const scenario of scenarios) {
		const baseline = scenario.baselineAdvisories ?? [];
		const surviving = scenario.survivingAdvisories ?? [];
		const classified = classifyAdvisories(
			mergeAdvisories(baseline, surviving),
			scenario.allowlist ?? [],
			keySet(baseline),
			keySet(surviving),
			now
		);
		const report = resolveVerdict(classified);
		if (
			report.verdict === scenario.expectedVerdict &&
			report.exitCode === scenario.expectedExitCode
		) {
			console.log(`ok:   ${scenario.name} -> ${report.verdict} (exit ${report.exitCode})`);
		} else {
			console.error(
				`FAIL: ${scenario.name} - expected ${scenario.expectedVerdict}/exit ${scenario.expectedExitCode}, got ${report.verdict}/exit ${report.exitCode}`
			);
			failed++;
		}
	}
	console.log('');
	if (failed > 0) {
		console.error(
			`Self-test FAILED: ${failed}/${scenarios.length} scenario(s) broke the contract.`
		);
		return 1;
	}
	console.log(
		`Self-test passed: ${scenarios.length}/${scenarios.length} scenarios hold the contract.`
	);
	return 0;
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) {
	process.exit(runSelftest());
}
process.exit(runReal(new Date()));
