/**
 * bmi-update-version.ts — update app version in canonical sources.
 *
 * Usage:
 *   bun run scripts/bmi-update-version.ts <new-version>
 *   bun run bmi-update-version <new-version>
 *   bun run bmi-update-version-to <new-version>
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

function replaceOrWarn(relPath: string, pattern: RegExp, replacement: string, label: string): void {
  const original = read(relPath);
  const updated = original.replace(pattern, replacement);
  if (updated === original) {
    console.log(`    \x1b[33m⚠ ${label} not found in ${relPath} — skipped\x1b[0m`);
    return;
  }
  write(relPath, updated);
  console.log(`    \x1b[32m✓\x1b[0m ${label} updated`);
}

function getCurrentVersion(): string {
  const pkg = JSON.parse(read('package.json')) as { version?: string };
  if (!pkg.version || !parseSemver(pkg.version)) {
    die(`Invalid package.json version: "${pkg.version ?? ''}"`);
  }
  return pkg.version;
}

function updatePackageJson(newVersion: string): void {
  const raw = read('package.json');
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  pkg.version = newVersion;
  write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('    \x1b[32m✓\x1b[0m package.json version updated');
}

function main(): void {
  const nextVersion = process.argv[2]?.trim();
  if (!nextVersion) {
    die(
      'Usage: bun run scripts/bmi-update-version.ts <new-version>\n' +
      'Example: bun run scripts/bmi-update-version.ts 20.1.0'
    );
  }

  if (!parseSemver(nextVersion)) {
    die(`Invalid semver "${nextVersion}". Expected MAJOR.MINOR.PATCH`);
  }

  const currentVersion = getCurrentVersion();
  const nextShort = shortVersion(nextVersion);

  console.log('');
  console.log('\x1b[36m  BMI Stellar — Version Updater\x1b[0m');
  console.log(`  Current: ${currentVersion}`);
  console.log(`  Target:  ${nextVersion}`);
  console.log('');

  if (currentVersion === nextVersion) {
    console.log('\x1b[33m  No changes: package.json already at target version.\x1b[0m');
    console.log('');
    return;
  }

  console.log('  \x1b[33m→\x1b[0m package.json');
  updatePackageJson(nextVersion);

  console.log('  \x1b[33m→\x1b[0m src/lib/utils/backup.ts');
  replaceOrWarn(
    'src/lib/utils/backup.ts',
    /APP_VERSION\s*=\s*['"`][^'"`]+['"`]/,
    `APP_VERSION = '${nextVersion}'`,
    'APP_VERSION'
  );

  console.log('  \x1b[33m→\x1b[0m README.md');
  replaceOrWarn(
    'README.md',
    /BMI Stellar v\d+\.\d+/g,
    `BMI Stellar v${nextShort}`,
    'README display version'
  );

  console.log('  \x1b[33m→\x1b[0m LICENSE.md');
  replaceOrWarn(
    'LICENSE.md',
    /BMI Stellar\s*[–-]\s*v\d+\.\d+/g,
    `BMI Stellar – v${nextShort}`,
    'LICENSE display version'
  );

  console.log('');
  console.log(`\x1b[32m  Done: ${currentVersion} → ${nextVersion}\x1b[0m`);
  console.log(`\x1b[32m  Display target: v${nextShort}\x1b[0m`);
  console.log('');
}

main();
