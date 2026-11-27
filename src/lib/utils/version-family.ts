// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// The product-family version law (night-cafe-mclaren-1): package.json
// is the single version source of truth, and every Cargo.toml anywhere
// in the tree whose [package] name belongs to the product family must
// carry the same version - the manifest and its committed Cargo.lock
// alike. The engine crate used to sit outside the bump forever (it read
// 1.0.0 while the app moved on), the exact staleness this law removes.
//
// The family is the package.json name and its hyphenated descendants
// (bmi-stellar -> bmi-stellar-argon2id, bmi-stellar-whatever): the
// prefix is read live from the package, so the same law serves any
// project it sits in with no per-repo configuration. Discovery is
// dynamic - a walk that skips dot directories, node_modules, and cargo
// build dirs - so a crate added tomorrow in any directory joins the
// contract on its first bump and is policed by the version-sync gate on
// every commit after that. Nothing here reads or writes a list.
//
// Only the [package] section's version is read. Dependency version
// lines are never touched by the law: the supply-chain policy
// exact-pins those and only the owner's deliberate edit moves one, and
// rust-version (the MSRV floor) belongs to the toolchain gate
// (scripts/gates/check-rust-version-sync.sh), not to this one.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Directories the family walk never enters (build output, deps). */
const SKIP_DIRS = new Set(['node_modules', 'target']);

export interface ManifestPackage {
	name: string;
	version: string;
}

export interface FamilyAudit {
	/** The version package.json carries (empty when unreadable). */
	appVersion: string;
	/** The family prefix: the package.json name (empty when absent). */
	familyPrefix: string;
	/** Violations: a surface exists and disagrees - the tree is stale. */
	violations: string[];
	/** Notes: honest absences and non-family skips - nothing to fix. */
	notes: string[];
	/** The discovered family manifests (path, package name, version). */
	family: { path: string; name: string; version: string }[];
	/** Every other manifest discovered, skipped by the family rule. */
	nonFamily: string[];
}

/**
 * The [package] name and version of one Cargo.toml. Only the first
 * `[package]` section is read - a dependency's `version = "..."` line
 * (inline table or [dependencies] key) can never reach this, and a
 * manifest without a [package] section is not a crate manifest.
 */
export function manifestPackage(toml: string): ManifestPackage | null {
	const section = toml.match(/\[package\]([\s\S]*?)(\n\[|$)/);
	if (!section) return null;
	const name = section[1].match(/^name\s*=\s*"([^"]+)"/m)?.[1] ?? '';
	const version = section[1].match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? '';
	if (!name && !version) return null;
	return { name, version };
}

/**
 * Family membership: the package name itself or a hyphenated
 * descendant. `bmi-stellar` owns `bmi-stellar` and
 * `bmi-stellar-argon2id`; `not-my-crate` and `bmi-stellarish` stay out
 * (the hyphen is the boundary, never a prefix smear).
 */
export function isFamily(crateName: string, familyPrefix: string): boolean {
	return crateName === familyPrefix || crateName.startsWith(`${familyPrefix}-`);
}

async function walkManifests(dir: string, rel: string, out: string[]): Promise<void> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
		const relPath = rel ? `${rel}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			await walkManifests(join(dir, entry.name), relPath, out);
		} else if (entry.name === 'Cargo.toml') {
			out.push(relPath);
		}
	}
}

/**
 * Every Cargo.toml under root, sorted, as relative posix paths. The
 * walk is the contract: no hardcoded list, so a manifest added anywhere
 * tomorrow is discovered by the same code with zero edits.
 */
export async function discoverManifests(root: string): Promise<string[]> {
	const out: string[] = [];
	await walkManifests(root, '', out);
	return out.sort();
}

/**
 * The committed sibling lock's story for one crate: `exists=false` when
 * no Cargo.lock sits beside the manifest (cargo writes one on the next
 * build), `version=null` when the lock exists but carries no [[package]]
 * entry for the crate, else the recorded version the lock must carry.
 */
async function siblingLock(
	crateDir: string,
	crateName: string
): Promise<{ exists: boolean; version: string | null }> {
	let lock: string;
	try {
		lock = await readFile(join(crateDir, 'Cargo.lock'), 'utf8');
	} catch {
		return { exists: false, version: null };
	}
	const escaped = crateName.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const entry = lock.match(new RegExp(`name\\s*=\\s*"${escaped}"\\s*\\nversion\\s*=\\s*"([^"]+)"`));
	return { exists: true, version: entry?.[1] ?? null };
}

/**
 * The whole version-parity audit: the package.json source of truth, the
 * DORMANT.md and README.md display surfaces (the existing parity law),
 * then the family manifests and their committed locks. Every disagreeing
 * surface is a violation; every honest absence is a note.
 */
export async function auditVersionSurfaces(root: string): Promise<FamilyAudit> {
	const violations: string[] = [];
	const notes: string[] = [];

	// package.json - the source of truth. Unreadable or malformed, the
	// audit has nothing to compare against: one violation, stop here.
	let pkg: { name?: string; version?: string };
	try {
		pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
	} catch {
		return {
			appVersion: '',
			familyPrefix: '',
			violations: ['package.json: unreadable - the version source of truth is missing'],
			notes,
			family: [],
			nonFamily: []
		};
	}
	const appVersion = pkg.version ?? '';
	const familyPrefix = pkg.name ?? '';
	if (!/^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/.test(appVersion)) {
		violations.push(`package.json version "${appVersion}" is not MAJOR.MINOR.PATCH[-LABEL]`);
		return { appVersion, familyPrefix, violations, notes, family: [], nonFamily: [] };
	}

	// DORMANT.md - the maintenance capsule (the night-improve-3 law: a
	// capsule this gate policed that now disagrees FAILS).
	let dormant = '';
	try {
		dormant = await readFile(join(root, 'DORMANT.md'), 'utf8');
	} catch {
		// Absent file falls through as no capsule.
	}
	const dormantMatch = dormant.match(/Version: `(\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?)`/);
	if (!dormantMatch) {
		violations.push('DORMANT.md: no "Version: `X.Y.Z`" capsule line found');
	} else if (dormantMatch[1] !== appVersion) {
		violations.push(`DORMANT.md capsule version ${dormantMatch[1]} != package.json ${appVersion}`);
	}

	// README.md - the current-release surface (absent = honest note).
	let readme = '';
	try {
		readme = await readFile(join(root, 'README.md'), 'utf8');
	} catch {
		// Absent file falls through as no surface.
	}
	const releaseMatch = readme.match(/Current release: `v(\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.]+)?)`/);
	if (!releaseMatch) {
		notes.push('README.md carries no "Current release" surface - nothing to police there');
	} else if (releaseMatch[1] !== appVersion) {
		violations.push(
			`README.md current-release line v${releaseMatch[1]} != package.json ${appVersion}`
		);
	}

	// The family manifests - the adaptive law. Every Cargo.toml in the
	// tree is discovered, only family crates are policed.
	const family: { path: string; name: string; version: string }[] = [];
	const nonFamily: string[] = [];
	for (const rel of await discoverManifests(root)) {
		const manifest = await readFile(join(root, rel), 'utf8');
		const parsed = manifestPackage(manifest);
		if (!parsed || !parsed.name) {
			notes.push(`${rel}: no [package] name - not a family surface`);
			continue;
		}
		if (!isFamily(parsed.name, familyPrefix)) {
			nonFamily.push(rel);
			notes.push(`${rel}: ${parsed.name} is not family, skipped`);
			continue;
		}
		family.push({ path: rel, name: parsed.name, version: parsed.version });
		if (parsed.version !== appVersion) {
			violations.push(
				`${rel}: ${parsed.name} ${parsed.version || '(no version)'} != package.json ${appVersion}`
			);
		}
		const lock = await siblingLock(join(root, dirname(rel)), parsed.name);
		if (!lock.exists) {
			notes.push(`${rel}: no sibling Cargo.lock - cargo writes one on the next build`);
		} else if (lock.version !== appVersion) {
			violations.push(
				`${rel}: Cargo.lock ${lock.version ?? '(no entry)'} != package.json ${appVersion}`
			);
		}
	}

	return { appVersion, familyPrefix, violations, notes, family, nonFamily };
}
