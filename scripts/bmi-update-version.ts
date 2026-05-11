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
 *   - src/app.html        → 3 meta tags (title, og:title, twitter:title)
 *   - src/lib/i18n/locales/{en,id,ja,zh}.ts → meta.title + hero.edition
 *   - src/lib/utils/backup.ts → APP_VERSION constant
 *   - LICENSE.md           → title line
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

  if (currentVersion === newVersion && shortOld === short) {
    // Even when versions match, check for drifted version references in source files
    const driftFixed = fixVersionDrift(short);
    if (!driftFixed) {
      die(`Already at version ${newVersion}. Nothing to do.`);
    }
    // Drift was fixed — skip remaining updates since package.json is already correct
    console.log(`  \x1b[33m*\x1b[0m Version drift detected and fixed (package.json already at ${newVersion})`);
    console.log('');
    console.log(`\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
    console.log(`\x1b[32m  Done! Version drift fixed to Stellar v${short}\x1b[0m`);
    console.log(`\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
    console.log('');
    return;
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

  // ── 4. Update app.html meta tags ──
  console.log('  \x1b[33m→\x1b[0m src/app.html');
  updateAppHtml(shortOld, short);
  console.log('    \x1b[32m✓\x1b[0m 3 meta tags updated');

  // ── 5. Update i18n locale files ──
  const locales = ['en', 'id', 'ja', 'zh'];
  for (const locale of locales) {
    console.log(`  \x1b[33m→\x1b[0m src/lib/i18n/locales/${locale}.ts`);
    updateI18nLocale(locale, shortOld, short);
    console.log('    \x1b[32m✓\x1b[0m meta.title + hero.edition updated');
  }

  // ── 6. Update LICENSE.md ──
  console.log('  \x1b[33m→\x1b[0m LICENSE.md');
  updateLicense(shortOld, short);
  console.log('    \x1b[32m✓\x1b[0m title updated');

  // ── 7. Update backup.ts APP_VERSION ──
  console.log('  \x1b[33m→\x1b[0m src/lib/utils/backup.ts');
  updateBackupTs(newVersion);
  console.log('    \x1b[32m✓\x1b[0m APP_VERSION updated');

  // ── 8. Regenerate lock files ──
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

  // Match "Stellar-{oldShort}" (dash) or "Stellar v{oldShort}" (space+v)
  const dashPattern = new RegExp(`Stellar-${escapeRegex(oldShort)}(?=[\\s<}])`, 'g');
  const spaceVPattern = new RegExp(`Stellar v${escapeRegex(oldShort)}(?=[\\s<}])`, 'g');

  let updated = content.replace(dashPattern, `Stellar-${newShort}`);
  updated = updated.replace(spaceVPattern, `Stellar v${newShort}`);

  if (updated === content) {
    // Fallback: broader patterns
    updated = content.replace(/Stellar-\d+\.\d+(?=[\s<}])/g, `Stellar-${newShort}`);
    updated = updated.replace(/Stellar v\d+\.\d+(?=[\s<}])/g, `Stellar v${newShort}`);
    if (updated !== content) {
      writeFile('src/routes/+page.svelte', updated);
      return;
    }
    console.log('    \x1b[33m⚠ No version reference found — skipping\x1b[0m');
    return;
  }

  writeFile('src/routes/+page.svelte', updated);
}

function updateAppHtml(oldShort: string, newShort: string): void {
  let content = readFile('src/app.html');
  // Replace all occurrences of "Stellar v{oldShort}" in meta tags
  const pattern = new RegExp(`Stellar v${escapeRegex(oldShort)}`, 'g');
  content = content.replace(pattern, `Stellar v${newShort}`);

  // Fallback: catch version drift in meta tags
  if (oldShort !== newShort && new RegExp(`Stellar v(?!${escapeRegex(newShort)})\\d+\\.\\d+`).test(content)) {
    content = content.replace(/Stellar v\d+\.\d+/g, `Stellar v${newShort}`);
  }

  writeFile('src/app.html', content);
}

function updateI18nLocale(locale: string, oldShort: string, newShort: string): void {
  const filePath = `src/lib/i18n/locales/${locale}.ts`;
  let content = readFile(filePath);

  // Replace "Stellar v{oldShort}" in meta.title
  const vPattern = new RegExp(`Stellar v${escapeRegex(oldShort)}`, 'g');
  content = content.replace(vPattern, `Stellar v${newShort}`);

  // Replace locale-specific edition strings:
  // en: "Stellar Edition X.Y" → "Stellar v{newShort}"
  // id: "Edisi Stellar X.Y" → "Stellar v{newShort}"
  // ja/zh: "Stellar 版 X.Y" → "Stellar v{newShort}"
 content = content.replace(/Stellar Edition \d+\.\d+/g, `Stellar v${newShort}`);
  content = content.replace(/Edisi Stellar \d+\.\d+/g, `Stellar v${newShort}`);
  content = content.replace(/Stellar 版 \d+\.\d+/g, `Stellar v${newShort}`);

  // Fallback: catch any remaining "Stellar v{X.Y}" that didn't match (version drift)
  if (oldShort !== newShort && content.includes('Stellar v')) {
    const broadV = new RegExp(`Stellar v(?!${escapeRegex(newShort)}(?=\\.0))\\d+\\.\\d+`, 'g');
    if (broadV.test(content)) {
      content = content.replace(/Stellar v\d+\.\d+/g, `Stellar v${newShort}`);
    }
  }

  writeFile(filePath, content);
}

function updateLicense(oldShort: string, newShort: string): void {
  let content = readFile('LICENSE.md');
  content = content.replace(/Stellar v\d+\.\d+/g, `Stellar v${newShort}`);
  content = content.replace(/Stellar Edition \d+\.\d+/g, `Stellar v${newShort}`);
  writeFile('LICENSE.md', content);
}

function updateBackupTs(newVersion: string): void {
  const content = readFile('src/lib/utils/backup.ts');
  const updated = content.replace(
    /APP_VERSION\s*=\s*['"`]([^'"`]+)['"`]/,
    `APP_VERSION = '${newVersion}'`
  );
  if (updated === content) {
    console.log('    \x1b[33m⚠ APP_VERSION not found or unchanged — skipping\x1b[0m');
    return;
  }
  writeFile('src/lib/utils/backup.ts', updated);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect and fix version drift in source files when package.json
 * is already at the target version but source files reference older versions.
 * Returns true if any drift was fixed.
 */
function fixVersionDrift(currentShort: string): boolean {
  let fixed = false;

  // Check +page.svelte for any "Stellar v{X.Y}" where X.Y !== currentShort
  const pageContent = readFile('src/routes/+page.svelte');
  const broadVersionPattern = /Stellar v(\d+\.\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = broadVersionPattern.exec(pageContent)) !== null) {
    if (match[1] !== currentShort) {
      const drifted = match[0];
      const corrected = `Stellar v${currentShort}`;
      console.log(`  \\x1b[33m*\\x1b[0m Fixing drift in +page.svelte: "${drifted}" → "${corrected}"`);
      // Will be fixed by the updatePageSvelte fallback below
      fixed = true;
    }
  }
  if (fixed) {
    // Use the fallback broad patterns from updatePageSvelte
    const oldContent = readFile('src/routes/+page.svelte');
    let updated = oldContent.replace(/Stellar-\d+\.\d+(?=[\s<}])/g, `Stellar-${currentShort}`);
    updated = updated.replace(/Stellar v\d+\.\d+(?=[\s<}])/g, `Stellar v${currentShort}`);
    if (updated !== oldContent) writeFile('src/routes/+page.svelte', updated);
  }

  return fixed;
}

main();
