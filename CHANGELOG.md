# Changelog

All notable changes to **BMI Stellar** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) principles, adapted to the project's `feat / fix / chore / docs / refactor / style` commit conventions. Versions are synchronized from `package.json` via `scripts/bmi-update-version.ts`. Release tags follow `Stellar-v<major>.<minor>`.

For the full architectural context behind any release, see [`docs/furthermore.md`](docs/furthermore.md). For dormant-maintenance guidance, see [`DORMANT.md`](DORMANT.md).

---

## [Unreleased]

### Fixed

- **CI audit failures** — `bun audit` reported 17 vulnerabilities in transitive deps after a dormant period. Bumped `overrides` (undici ^7.29.0, tar ^7.5.22, postcss ^8.5.25, brace-expansion ^5.0.9) and dev-dep `@sveltejs/kit` 2.60.1 → 2.70.2. Result: 0 vulnerabilities. _(eff8369)_
- **Missing local gatekeeper** — added `scripts/build.sh` (5 modes: `check-all`, `quick`, `audit`, `test`, `build`) that mirrors `.github/workflows/ci.yml` step-by-step. _(eff8369)_

### Changed

- **Documentation sync** — corrected 11 discrepancies across README.md, DORMANT.md, BRANDING.md, and docs/furthermore.md (test counts, CSS cascade count, storage keys, lazy-load registry, CI/CD workflow inventory, accent color hex values, release-process gate). _(e29e94b)_

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
