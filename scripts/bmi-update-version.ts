/**
 * bmi-update-version.ts — Auto-update BMI app version across all project files.
 *
 * Usage:
 *   bun run scripts/bmi-update-version.ts <new-version>
 *   bun run bmi-update-version-to <new-version>
 *
 * Example:
 *   bun run scripts/bmi-update-version.ts 10.8.0
 *   bun run bmi-update-version-to 10.8.0
 *
 * Files updated:
 *   - package.json        → top-level "version" field
 *   - README.md           → title "Stellar v{major}.{minor}" + version line
 *   - src/routes/+page.svelte → about section "Stellar-{major}.{minor}"
 *   - bun.lock            → regenerated via `bun install`
 *   - package-lock.json   → regenerated via `bun install`
 *
 * Safety: Only the BMI app version is touched. Dependency versions
 * (e.g. autoprefixer@^10.5.0, glob@^10.5.0) are never modified.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// ── Helpers ──

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/** Parse "10.5.0" → { major: 10, minor: 5, patch: 0 } */
function parseSemver(v: string): { major: number; minor: number; patch: number } | null {
  const match = v.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/** "10.8.0" → "10.8" */
function shortVersion(v: string): string {
  const p = v.split('.');
  return `${p[0]}.${p[1]}`;
}

/** Exit with error message */
function die(msg: string): never {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

/** Read file as string, exit on failure */
function readFile(relPath: string): string {
  const full = resolve(ROOT, relPath);
  try {
    return readFileSync(full, 'utf-8');
  } catch {
    die(`Cannot read file: ${relPath}`);
  }
}

/** Write string to file */
function writeFile(relPath: string, content: string): void {
  const full = resolve(ROOT, relPath);
  writeFileSync(full, content, 'utf-8');
}

// ── Main ──

function main(): void {
  const newVersion = process.argv[2];
  if (!newVersion) {
    die(
      'Usage: bun run scripts/bmi-update-version.ts <new-version>\n' +
      '  Example: bun run scripts/bmi-update-version.ts 10.8.0'
    );
  }

  const parsed = parseSemver(newVersion);
  if (!parsed) {
    die(`Invalid semver format: "${newVersion}". Expected: MAJOR.MINOR.PATCH (e.g. 10.8.0)`);
  }

  const short = shortVersion(newVersion);
  const currentVersion = getCurrentVersion();
  const shortOld = shortVersion(currentVersion);

  console.log('');
  console.log('\x1b[36m╔══════════════════════════════════════════╗');
  console.log('║  BMI Logigo — Version Updater               ║');
  console.log('╚══════════════════════════════════════════╝\x1b[0m');
  console.log('');
  console.log(`  Current: \x1b[90m${currentVersion}\x1b[0m`);
  console.log(`  Target:  \x1b[1m${newVersion}\x1b[0m\n`);

  if (currentVersion === newVersion) {
    die(`Already at version ${newVersion}. Nothing to do.`);
  }

  // ── 1. Update package.json ──
  console.log('  \x1b[33m→\x1b[0m package.json');
  updatePackageJson(newVersion);
  console.log('    \x1b[32m✓\x1b[0m "version" updated');

  // ── 2. Update README.md ──
  console.log('  \x1b[33m→\x1b[0m README.md');
  updateReadme(newVersion, short);
  console.log('    \x1b[32m✓\x1b[0m title + version line updated');

  // ── 3. Update +page.svelte about section ──
  console.log('  \x1b[33m→\x1b[0m src/routes/+page.svelte');
  updatePageSvelte(shortOld, short);
  console.log('    \x1b[32m✓\x1b[0m about section updated');

  // ── 4. Regenerate lock files ──
  console.log('  \x1b[33m→\x1b[0m Regenerating lock files');
  try {
    execSync('bun install', { cwd: ROOT, stdio: 'pipe' });
    console.log('    \x1b[32m✓\x1b[0m bun.lock + package-lock.json');
  } catch {
    console.log('    \x1b[33m⚠ bun install skipped\x1b[0m');
  }

  // ── Summary ──
  console.log('');
  console.log('\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log(`\x1b[32m  Done! Version \x1b[1m${currentVersion}\x1b[0m \x1b[32m→\x1b[0m \x1b[1m\x1b[32m${newVersion}\x1b[0m`);
  console.log(`\x1b[32m  Display: Stellar v${short}\x1b[0m`);
  console.log('\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('');
}

function getCurrentVersion(): string {
  const pkg = JSON.parse(readFile('package.json'));
  const v: string = pkg.version;
  if (!v || !parseSemver(v)) {
    die(`Invalid or missing "version" in package.json: "${v}"`);
  }
  return v;
}

// ── File-specific updaters ──

function updatePackageJson(newVersion: string): void {
  const raw = readFile('package.json');
  const pkg = JSON.parse(raw);
  pkg.version = newVersion;
  writeFile('package.json', JSON.stringify(pkg, null, 2) + '\n');
}

function updateReadme(newVersion: string, short: string): void {
  let content = readFile('README.md');

  // Title: "# BMI Calculator — Stellar v10.5"
  content = content.replace(
    /^# BMI Calculator — Stellar v\d+\.\d+/m,
    `# BMI Calculator — Stellar v${short}`
  );

  // Version line: "- **Version**: 10.5.0 (Stellar Edition)"
  content = content.replace(
    /- \*\*Version\*\*: \d+\.\d+\.\d+ \(Stellar Edition\)/,
    `- **Version**: ${newVersion} (Stellar Edition)`
  );

  writeFile('README.md', content);
}

function updatePageSvelte(oldShort: string, newShort: string): void {
  const content = readFile('src/routes/+page.svelte');

  // Precise match: "Stellar-10.5" followed by space, <, or }
  const pattern = new RegExp(`Stellar-${escapeRegex(oldShort)}(?=[\\s<}])`, 'g');
  const updated = content.replace(pattern, `Stellar-${newShort}`);

  if (updated === content) {
    // Fallback: broader pattern
    const broad = content.replace(/Stellar-\d+\.\d+(?=[\s<}])/g, `Stellar-${newShort}`);
    if (broad !== content) {
      writeFile('src/routes/+page.svelte', broad);
      return;
    }
    console.log('    \x1b[33m⚠ No version reference found — skipping\x1b[0m');
    return;
  }

  writeFile('src/routes/+page.svelte', updated);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();
