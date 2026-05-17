/**
 * bmi-update-version.ts — update app version in canonical sources.
 *
 * Usage:
 *   bun run scripts/bmi-update-version.ts <new-version>
 *   bun run scripts/bmi-update-version.ts patch|minor|major
 *   bun run scripts/bmi-update-version.ts --dry-run <new-version>
 *   bun run bmi-update-version <new-version>
 *   bun run bmi-bump:patch
 *   bun run bmi-bump:minor
 *   bun run bmi-bump:major
 *
 * Canonical version sources after dynamic-version refactor:
 *   - package.json                    (version)
 *   - src/lib/utils/backup.ts         (APP_VERSION)
 *   - README.md                       (display title)
 *   - LICENSE.md                      (display title)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function parseSemver(v: string): { major: number; minor: number; patch: number } | null {
  const match = v.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function shortVersion(v: string): string {
  const parts = v.split('.');
  return `${parts[0]}.${parts[1]}`;
}

function bumpVersion(
  current: { major: number; minor: number; patch: number },
  type: 'patch' | 'minor' | 'major'
): string {
  if (type === 'patch') return `${current.major}.${current.minor}.${current.patch + 1}`;
  if (type === 'minor') return `${current.major}.${current.minor + 1}.0`;
  return `${current.major + 1}.0.0`;
}

function die(msg: string): never {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

function read(relPath: string): string {
  try {
    return readFileSync(resolve(ROOT, relPath), 'utf-8');
  } catch {
    die(`Cannot read file: ${relPath}`);
  }
}

function write(relPath: string, content: string): void {
  writeFileSync(resolve(ROOT, relPath), content, 'utf-8');
}

function replaceOrWarn(
  relPath: string,
  pattern: RegExp,
  replacement: string,
  label: string,
  dryRun: boolean
): void {
  const original = read(relPath);
  const updated = original.replace(pattern, replacement);
  if (updated === original) {
    console.log(`    \x1b[33m⚠ ${label} not found in ${relPath} — skipped\x1b[0m`);
    return;
  }
  if (!dryRun) write(relPath, updated);
  console.log(`    \x1b[32m✓\x1b[0m ${label} updated`);
}

function replaceOrFail(
  relPath: string,
  pattern: RegExp,
  replacement: string,
  label: string,
  dryRun: boolean
): void {
  const original = read(relPath);
  const updated = original.replace(pattern, replacement);
  if (updated === original) {
    die(`${label} not found in ${relPath}`);
  }
  if (!dryRun) write(relPath, updated);
  console.log(`    \x1b[32m✓\x1b[0m ${label} updated`);
}

function getCurrentVersion(): string {
  const pkg = JSON.parse(read('package.json')) as { version?: string };
  if (!pkg.version || !parseSemver(pkg.version)) {
    die(`Invalid package.json version: "${pkg.version ?? ''}"`);
  }
  return pkg.version;
}

function updatePackageJson(newVersion: string, dryRun: boolean): void {
  const raw = read('package.json');
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  pkg.version = newVersion;
  if (!dryRun) write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('    \x1b[32m✓\x1b[0m package.json version updated');
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter((arg) => arg !== '--dry-run');
  const target = filteredArgs[0]?.trim();
  if (!target) {
    die(
      'Usage: bun run scripts/bmi-update-version.ts [--dry-run] <new-version|patch|minor|major>\n' +
      'Example: bun run scripts/bmi-update-version.ts 20.1.0'
    );
  }
  const currentVersion = getCurrentVersion();
  const currentParsed = parseSemver(currentVersion);
  if (!currentParsed) {
    die(`Invalid current semver "${currentVersion}" in package.json`);
  }

  const isBumpType = target === 'patch' || target === 'minor' || target === 'major';
  const nextVersion = isBumpType
    ? bumpVersion(currentParsed, target)
    : target;

  if (!parseSemver(nextVersion)) {
    die(`Invalid semver "${nextVersion}". Expected MAJOR.MINOR.PATCH`);
  }
  const nextShort = shortVersion(nextVersion);

  console.log('');
  console.log('\x1b[36m  BMI Stellar — Version Updater\x1b[0m');
  console.log(`  Current: ${currentVersion}`);
  console.log(`  Target:  ${nextVersion}`);
  if (dryRun) {
    console.log('  Mode:    \x1b[33mDRY RUN\x1b[0m');
  }
  console.log('');

  if (currentVersion === nextVersion) {
    console.log('\x1b[33m  No changes: package.json already at target version.\x1b[0m');
    console.log('');
    return;
  }

  console.log('  \x1b[33m→\x1b[0m package.json');
  updatePackageJson(nextVersion, dryRun);

  console.log('  \x1b[33m→\x1b[0m src/lib/utils/backup.ts');
  replaceOrFail(
    'src/lib/utils/backup.ts',
    /APP_VERSION\s*=\s*['"`][^'"`]+['"`]/,
    `APP_VERSION = '${nextVersion}'`,
    'APP_VERSION',
    dryRun
  );

  console.log('  \x1b[33m→\x1b[0m README.md');
  replaceOrWarn(
    'README.md',
    /BMI Stellar v\d+\.\d+(?:\.\d+)?/g,
    `BMI Stellar v${nextShort}`,
    'README display version',
    dryRun
  );

  console.log('  \x1b[33m→\x1b[0m LICENSE.md');
  replaceOrWarn(
    'LICENSE.md',
    /BMI Stellar\s*[–-]\s*v\d+\.\d+(?:\.\d+)?/g,
    `BMI Stellar – v${nextShort}`,
    'LICENSE display version',
    dryRun
  );

  console.log('');
  console.log(`\x1b[32m  ${dryRun ? 'Preview' : 'Done'}: ${currentVersion} → ${nextVersion}\x1b[0m`);
  console.log(`\x1b[32m  Display target: v${nextShort}\x1b[0m`);
  console.log('');
}

main();
