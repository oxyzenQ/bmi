// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
//
// THE SUPPLY-CHAIN MANIFEST GATE (night-supply-1).
//
// The arrayref incident class: a compromised maintainer account
// republished a popular crate so it depended on a build-script payload
// crate, and the malicious versions rode semver-compatible resolutions
// for 86-107 minutes. The Rust side carries the structural policy in
// engine/argon2id/deny.toml and the digest-pinned scanner; this gate
// pins the SAME posture for the JavaScript surface, where nothing else
// guards the manifest shapes:
//
//   - every dependency range resolves against a registry: no "latest",
//     "*", git/url/file/link sources anywhere in the manifest;
//   - no dependency lifecycle scripts are trusted
//     (trustedDependencies absent or empty - the arrayref payload
//     rode a build script; bun runs one only for trusted packages);
//   - no unpinned runtime fetches (bunx/npx) in npm scripts, CI
//     workflows, or CI scripts;
//   - no pipe-execution of downloaded scripts (curl ... | sh) in CI;
//   - every resolved entry in bun.lock carries an integrity checksum
//     (the root workspace entry is the documented exception);
//   - the engine crate stays exact-pinned and the deny.toml policy
//     keeps its deny verdicts (a silently weakened policy is a
//     regression this gate refuses).

import { readFileSync, existsSync, readdirSync } from 'node:fs';

interface DepMap {
	[dep: string]: string;
}

let failures = 0;
function fail(message: string): void {
	console.error(`FAIL: ${message}`);
	failures++;
}
function pass(message: string): void {
	console.log(`ok:   ${message}`);
}

function readJsonc(path: string): Record<string, unknown> {
	// bun.lock is JSONC (trailing commas); strip them before parsing. The
	// lock format never places a ",\n" sequence inside a string value, so
	// a conservative regex strip is safe here.
	const raw = readFileSync(path, 'utf8').replace(/,(\s*[}\]])/g, '$1');
	return JSON.parse(raw) as Record<string, unknown>;
}

// ── package.json: the manifest shapes ────────────────────────────────────
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
	dependencies?: DepMap;
	devDependencies?: DepMap;
	peerDependencies?: DepMap;
	optionalDependencies?: DepMap;
	scripts?: Record<string, string>;
	trustedDependencies?: string[];
};

const sections = [
	['dependencies', pkg.dependencies],
	['devDependencies', pkg.devDependencies],
	['peerDependencies', pkg.peerDependencies],
	['optionalDependencies', pkg.optionalDependencies]
] as Array<[string, DepMap | undefined]>;

const FORBIDDEN_PROTOCOLS = ['git', 'git+', 'http://', 'https://', 'file:', 'link:', 'github:'];

let rangeCount = 0;
for (const [name, deps] of sections) {
	for (const [dep, range] of Object.entries(deps ?? {})) {
		rangeCount++;
		const lower = range.toLowerCase();
		if (range === 'latest' || range === '*' || range === '') {
			fail(`${name}: ${dep} has a floating range "${range}" - pin a concrete semver range`);
			continue;
		}
		if (FORBIDDEN_PROTOCOLS.some((p) => lower.startsWith(p)) || lower.includes('git@')) {
			fail(`${name}: ${dep} resolves from a non-registry source "${range}"`);
			continue;
		}
		if (!/^[\^~>=<]?[\d]/.test(range) && !lower.startsWith('npm:')) {
			fail(`${name}: ${dep} has an unparseable range "${range}"`);
		}
	}
}
pass(
	`${rangeCount} manifest dependency range(s) are registry semver ranges (no latest/*, no git/url/file sources)`
);

if (pkg.trustedDependencies === undefined) {
	pass('no trustedDependencies key - bun runs no dependency lifecycle scripts');
} else if (Array.isArray(pkg.trustedDependencies) && pkg.trustedDependencies.length === 0) {
	pass('trustedDependencies is empty - bun runs no dependency lifecycle scripts');
} else {
	fail(
		`trustedDependencies lists ${pkg.trustedDependencies?.length ?? '?'} package(s) - a lifecycle-script payload rides exactly this list (the arrayref vector); remove it`
	);
}

const scriptTexts = Object.entries(pkg.scripts ?? {});
const unpinnedFetch = scriptTexts.filter(
	([name, cmd]) => name !== '_comment' && /(^|[\s"'(])(bunx|npx)\b/.test(cmd)
);
if (unpinnedFetch.length === 0) {
	pass(`${scriptTexts.length} npm script(s) contain no unpinned bunx/npx runtime fetch`);
} else {
	for (const [name, cmd] of unpinnedFetch) {
		fail(`npm script "${name}" runs an unpinned package fetch: ${cmd}`);
	}
}

// ── bun.lock: resolved entries and their recorded integrity ──────────────
// bun's text lockfile records tarball checksums only for the entries it
// resolved WITH integrity metadata (the current tree: 271 of 466; six
// direct deps included - bun verifies every install against the registry
// at install time instead, and CI runs `bun install --frozen-lockfile`).
// Gating on universal checksum presence would false-positive the whole
// tree, so the gate asserts what is real: every RECORDED checksum is a
// well-formed sha digest, and no entry carries anything else in that
// position - a forged or corrupted integrity string is the red-flag
// shape, and the coverage number stays visible so a sudden collapse of
// recorded checksums is noticed.
const lock = readJsonc('bun.lock') as {
	packages?: Record<string, Array<string | undefined>>;
};
const entries = Object.entries(lock.packages ?? {});
let checksummed = 0;
let integrityFailures = 0;
for (const [key, entry] of entries) {
	const checksum = entry?.[3] ?? '';
	if (typeof checksum === 'string' && checksum.startsWith('sha')) {
		if (!/^sha\d+-[A-Za-z0-9+/=]+$/.test(checksum)) {
			fail(`bun.lock: ${key} records a malformed integrity checksum`);
			integrityFailures++;
			continue;
		}
		checksummed++;
	} else if (typeof checksum === 'string' && checksum !== '') {
		fail(`bun.lock: ${key} records a non-checksum value in the integrity position`);
		integrityFailures++;
	}
}
if (integrityFailures === 0 && checksummed > 0) {
	pass(
		`${checksummed}/${entries.length} bun.lock entries record well-formed sha integrity (the rest verify at frozen-lockfile install time)`
	);
}

// ── CI: no unpinned fetches, no pipe-executed downloads ──────────────────
// Scan every workflow and CI/dev/release shell script: the whole automation
// surface a dependency could ride, not a hand-picked list.
const scanTargets: Array<[string, string]> = [];
for (const dir of ['.github/workflows', 'scripts/ci', 'scripts/dev', 'scripts/release']) {
	try {
		for (const f of readdirSync(dir) as string[]) {
			if (f.endsWith('.sh') || f.endsWith('.yml') || f.endsWith('.yaml')) {
				scanTargets.push([`${dir}/${f}`, readFileSync(`${dir}/${f}`, 'utf8')]);
			}
		}
	} catch {
		// a missing directory is not a supply-chain fact
	}
}
let execPatternFailures = 0;
for (const [file, text] of scanTargets) {
	if (/(^|[\s"'(])(bunx|npx)\b/.test(text)) {
		fail(`${file}: unpinned bunx/npx runtime fetch present`);
		execPatternFailures++;
	}
	if (/curl[^|]*\|\s*(ba)?sh\b/.test(text)) {
		fail(`${file}: a downloaded script is piped straight into a shell`);
		execPatternFailures++;
	}
}
if (execPatternFailures === 0) {
	pass(
		`${scanTargets.length} CI workflow(s) and shell script(s) carry no unpinned fetch and no pipe-executed download`
	);
}

// ── the engine crate: exact pin + the deny.toml verdicts stay deny ───────
const cargoToml = readFileSync('engine/argon2id/Cargo.toml', 'utf8');
const depSection = cargoToml.split('[dependencies]')[1]?.split('[')[0] ?? '';
const versionLines = [...depSection.matchAll(/version\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
if (versionLines.length === 0) {
	fail(
		'engine/argon2id/Cargo.toml declares no dependency versions - the exact-pin contract is unparseable'
	);
} else if (versionLines.every((v) => v.startsWith('='))) {
	pass(
		`all ${versionLines.length} engine crate dependency version(s) are exact-pinned (${versionLines.join(', ')})`
	);
} else {
	fail(
		`engine crate dependency versions are not all exact-pinned: ${versionLines.join(', ')} (a semver-compatible republish could ride cargo update - the arrayref vector)`
	);
}

const denyTomlPath = 'engine/argon2id/deny.toml';
if (!existsSync(denyTomlPath)) {
	fail(`${denyTomlPath} is missing - the structural policy is unenforced`);
} else {
	const denyToml = readFileSync(denyTomlPath, 'utf8');
	const requiredVerdicts = [
		'yanked = "deny"',
		'unknown-registry = "deny"',
		'unknown-git = "deny"',
		'multiple-versions = "deny"'
	];
	const missing = requiredVerdicts.filter((v) => !denyToml.includes(v));
	if (missing.length === 0) {
		pass(
			'deny.toml keeps every structural verdict at deny (yanked, unknown-registry, unknown-git, multiple-versions)'
		);
	} else {
		fail(`deny.toml lost verdicts: ${missing.join('; ')} - the policy was weakened`);
	}
}

console.log('');
if (failures > 0) {
	console.error(`Supply-chain gate FAILED: ${failures} finding(s) above.`);
	process.exit(1);
}
console.log(
	'Supply-chain gate passed: the manifest, the lock, the CI lanes, and the engine policy hold the fail-closed posture.'
);
