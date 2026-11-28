<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# BMI Stellar — Engineering & LTS Consolidated Audit (November 2026)

**Consolidation date:** 2026-11-28
**Consolidates:** the exacting honesty pass (2026-11-03), the infra /
zelynic discipline sync (2026-11-04), the LTS readiness audit
(2026-11-04), the engineering legs of the depth hardening audit
(2026-11-19), and the architecture depth audit (2026-11-26) — previously
`docs/AUDIT-2026-11.md`, `docs/AUDIT-INFRA-2026-11.md`,
`docs/AUDIT-LTS-2026-11.md`, `docs/AUDIT-DEPTH-2026-11.md`, and
`docs/AUDIT-ARC-2026-11.md`.
**Rule of the consolidation:** every fact, commit anchor, verdict, and
skip keeps its original date — nothing was re-audited here, only
gathered, deduplicated, and cross-linked. The security legs of the same
rounds live in `AUDIT-SEC-2026-11.md`. The originals remain retrievable
verbatim from git history at or before the consolidation commit.

---

## 1. Resolution timeline (merged, one row per commit)

| Date       | Commit                        | Domain                  | Change                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ----------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-03 | `7041519`                     | Licensing               | Total license upgrade GPL-3.0-only → AGPL-3.0-only (LICENSE, all SPDX headers, manifest, docs, badge)                                                                                                                                                                                                                                                      |
| 2026-11-03 | `89154ed`                     | Stability (core chain)  | Import gate: non-finite / out-of-bounds / far-future records rejected; single classification source for CSV                                                                                                                                                                                                                                                |
| 2026-11-03 | `c6cdea5`                     | LTS (infrastructure)    | Explicit job timeouts on the 4 jobs that lacked them; PWA manifest cache-buster refreshed                                                                                                                                                                                                                                                                  |
| 2026-11-03 | `3cff019`                     | Stability (read parity) | Validated `readBmiHistory()` shared by all four read consumers; self-healing saves purge poison                                                                                                                                                                                                                                                            |
| 2026-11-03 | `007156f`                     | Hygiene                 | Zombie `svelte.config.static.js` + `@sveltejs/adapter-static` dependency removed; dead workflow references cleaned                                                                                                                                                                                                                                         |
| 2026-11-03 | `6c7c8d4`                     | Optimization            | 1.0 MB unreferenced brand master removed from deploy payload and offline precache                                                                                                                                                                                                                                                                          |
| 2026-11-04 | `6e74332`                     | CLI parity              | `build.sh -q` / `--quiet` essentials mode closed (per-step verdict lines, failed steps print the log tail, extra positional arguments fail loud)                                                                                                                                                                                                           |
| 2026-11-19 | `0164159`                     | Security + Hygiene      | See AUDIT-SEC-2026-11 (the M1/M2 burn bounds); plus one `bytesToHex` home (`hex.ts`) replacing seven hand-rolled copies, the duplicated import pre-guard merged into `importPlaintextOrFail`, 3 dead test hooks, 5 unneeded exports, 1 stale eslint-disable, 28 dead translation keys × 4 locales deleted; ratchets moved DOWN (760→751, 676→640, 631→601) |
| 2026-11-19 | (same)                        | Infra (Z1)              | `rust-validate` and `rust-engine-audit` obey the ten-minute CI law (15→10); security-audit's Rust toolchain pins 1.100.0; build.sh interpolates the bun pin                                                                                                                                                                                                |
| 2026-11-23 | `87af298`/`9c28752`/`ca9b107` | Provenance              | The D3 publisher binding, artifact gate, and lint hygiene — see AUDIT-SEC-2026-11                                                                                                                                                                                                                                                                          |

Suite state after the 2026-11-03 pass: 464/464 tests, header audit,
typecheck, lint, format, branding, PWA offline shell — all green via
`./scripts/build.sh check-all`.

## 2. The exacting honesty pass (2026-11-03)

### 2.1 The read-parity gap (the round's real finding)

The import hardening (`89154ed`) stopped new poison at the front door,
but the cross-check revealed a **parity gap**: four consumers still
trusted raw storage contents on read.

| Consumer                          | Poison vector before fix                                         |
| --------------------------------- | ---------------------------------------------------------------- |
| `BmiHistorySparkline.loadHistory` | Manual `JSON.parse` — NaN/Infinity scaling, silently blank chart |
| `BmiSnapshot.refreshBestBmi`      | Best-BMI reduce over raw records — Infinity "best BMI" badge     |
| `BmiForm.handleExportClick`       | Raw record count in the export summary                           |
| `saveBmiToHistory` write-back     | Re-persisted poison indefinitely                                 |

Records can predate the import hardening or enter via
`restoreLatestBackup`, which restores raw snapshot values from IndexedDB
without record validation.

**Fix (`3cff019`):** exported the hardened `isValidRecord`/`toRecord`
pair from `history-io.ts` and added a single validated accessor
`readBmiHistory()` in `bmi-history.ts` (never throws; malformed JSON,
non-array payloads, and invalid records degrade to a shorter sorted
list). `saveBmiToHistory` is now self-healing: every save rewrites
storage with validated records only. `restoreLatestBackup` needs no
change — the read side neutralizes whatever the restore writes.

**Ultra-scale note:** extreme JSON numbers (`1e999` → `Infinity`) are
the primary poison vector and are now rejected on **every** path records
can take into the UI. Verified TDD-first with a raw `1e999` JSON literal
test that fails against the old read paths.

### 2.2 Dragon hunt — two dragons slain

- **Zombie static-deploy era (`007156f`):** `svelte.config.static.js`
  was referenced by no build, script, or doc — only tolerant workflow
  path filters and a `|| true` release-staging copy. Removed together
  with its `@sveltejs/adapter-static` devDependency and all dead
  references.
- **Duplicate parse/classification logic (`89154ed`, `3cff019`):** CSV
  export duplicated classification thresholds (now reuses
  `classifyBmi`/`getCategoryLabel`); three duplicate `JSON.parse` sites
  consolidated behind `readBmiHistory()`.

**Dependency scan:** 34 dependencies checked against actual imports and
configs — `prettier`, `prettier-plugin-svelte`, `svelte-check`
(build.sh scripts), `postcss`/`autoprefixer` (`postcss.config.js`),
`@types/bun` (TS types for Bun APIs) all verified in use. **Script
scan:** all 9 scripts referenced (the `audit-core-files.ts` collector
backs `check-loc.ts`/`check-headers.ts`). **TODO/FIXME/eval/dead-code
sweeps:** zero occurrences.

### 2.3 Payload win, rest at peak (skip justified)

- **Fixed (`6c7c8d4`):** the 1254×1254 brand master (1.0 MB) sat in
  `static/`, so the unfiltered service-worker precache downloaded and
  cached it on every install while nothing ever rendered it. Moved out
  of the shipping payload — still in-repo and in the release source
  archive (release.yml copies both `docs/` and `assets/`), gone from the
  shipping payload. Install icons stay pixel-identical because all
  web-facing derivatives (192–1024) are untouched. (Sync note,
  2026-11-17: the master has since relocated to
  `assets/bmi-original-logo-2026.png` at the repository root per
  BRANDING 3.1 and assets/signature-assets.md; the service-worker
  precache still covers `static/` only.)
- **Measured state:** 1.1 MB immutable client (raw; roughly a third over
  the wire), largest chunk 440 KB (minified app/vendor code — no
  accidental library pulls: zero lucide/i18n string markers in the
  vendor chunk), 93 KB CSS, ~1.5 MB static assets (down from ~2.5 MB).
- **Skip justification:** the BMI computation hot path is a single
  guarded division per keystroke with runes `$derived` wiring — nothing
  to profile; further chunk splitting or i18n lazy-loading would trade
  regression risk in a dormant project for marginal wire savings. The
  724 KB 1024 px manifest icon is the one remaining heavy asset, but it
  is functionally referenced (install visuals) and replacing it with the
  512 derivative could change launcher icon selection on some platforms
  — an owner decision, not an audit unilateral call.

### 2.4 Verified non-findings from that pass

- Listener/timer hygiene: every `addEventListener` and
  `setTimeout`/`setInterval` is paired with cleanup (re-verified against
  the August inventory).
- No circular imports; the new `bmi-history → history-io` edge keeps the
  graph acyclic.
- `restoreLatestBackup` writes unvalidated keys by design — safe now
  that every read validates; per-key schema validation there would
  duplicate the guard.
- `execCommand('copy')` fallback (L3) and module-level writable stores
  (L4) remain intentional, as documented in August; DebugPanel split
  (L5) stays deferred until that file next changes.
- Release tag validation, workflow least-privilege permissions,
  concurrency guards, tag-pinned actions — all verified in the
  infrastructure leg.

## 3. LTS readiness, end-to-end real usage (2026-11-04)

Method: fresh production build (`bun run build`) served by
`vite preview`, exercised through a real Chrome session
(agent-browser/CDP) — welcome screen, section navigation, the full
calculator flow (metric and imperial), the auto-saved history, the
gauge/snapshot/trend/body-fat/goal cards, the celebration modal, reload
persistence, storage inventory, and a network-egress audit at the CDP
level (independent of the page's own resource buffer). Automated lanes:
`bun run test:ci` (515/515), `svelte-check` (0/0), eslint, prettier,
`audit:deps`, `audit:pwa-offline`, the 13-section gate-keepers lane, and
the full `build.sh check-all -q` gate.

| Surface               | Input                      | Expected                          | Rendered  | Verdict |
| --------------------- | -------------------------- | --------------------------------- | --------- | ------- |
| BMI (metric)          | 30y, 175 cm, 70 kg         | 70/1.75^2 = 22.86                 | 22.86     | exact   |
| BMI (imperial)        | 30y, 68.9 in, 154.3 lb     | exact-constant conversion = 22.85 | 22.85     | exact   |
| BMR (Mifflin-St Jeor) | male, 70 kg, 175 cm, 30y   | 1648.75 -> 1649                   | 1649      | exact   |
| TDEE (1.55x)          | BMR x 1.55                 | 2555.56 -> 2556                   | 2556      | exact   |
| Body fat (Deurenberg) | male, 30y, BMI 22.86       | 18.13 -> 18.1%                    | 18.1%     | exact   |
| Category + risk       | BMI 22.86                  | Normal Weight, LOW risk           | matches   | exact   |
| Goal tracker          | target 22.0, current 22.86 | 0.86 BMI points to lose           | matches   | exact   |
| Progressive unlock    | age → height → weight      | chained enablement                | matches   | pass    |
| History               | calculate                  | auto-saved entry                  | Entries:1 | pass    |
| Console / page errors | whole session              | none                              | 0 and 0   | pass    |

Storage inventory after the full journey: IndexedDB `bmi-calculator`;
localStorage `bmi.locale`, `bmi.history`, `bmi.unitSystem`, and (new)
`bmi.updateCheckAt`. Nothing else. The unit toggle clears the numeric
inputs by design (imperial and metric fields are different inputs); the
last calculated result legitimately persists until the next calculation
or Clear all data.

Findings of that session: F1 — the per-load automatic update check
(fixed, see AUDIT-SEC-2026-11 section 1.6); F2 — service-worker-served
staleness during verification is the standard prompt-based PWA update
model working as designed, not a caching bug (auditors verifying a fresh
build must unregister the worker or use a fresh profile); F3 — the
celebration modal honors `closeOnEscape` only when focus sits inside the
dialog, standard focus-dependent behavior, no change; F4 — the whole
client makes exactly two classes of outbound requests (Vercel
Analytics/Speed Insights on the hosted demo, deploy-dependent, no health
values; and the throttled update check), no third-party fonts, no CDN
scripts, no tracking pixels — fonts and icons ship self-hosted, CSP
allowlists exactly these hosts.

Brand palette verified against the original art (not just the docs): the
logo master plate is a dark plate (black-to-navy field with violet
accent detail), and the live design tokens resolve to the same family —
`--cosmic-purple: #8000ff`, `--cosmic-blue: #9a4dff`, violet accent
decomposition `rgba(139, 92, 246, ...)`, slate greys for surfaces and
secondary text, `--stellar-white: #ffffff` for primary text. BRANDING.md
section 4 documents exactly these resolved values and its note about the
rgba decomposition matches `src/styles/tokens.css` line for line. No
drift found.

Verdict: **LTS-ready** — every computed number matched its published
formula exactly under real usage, the whole 515-test battery green, the
storage surface minimal and named, and the one privacy-claim gap closed
with a tested, verified throttle plus an updated disclosure.

## 4. Dormancy toolchain audit (2026-11-04)

Question: is every dependency, tool, compiler, and runtime the project
touches actually fit for a 1-5 year dormant stretch — nothing EOLs under
a frozen pin, nothing rots silently, nothing needs a human before
`scripts/setup.sh` works again?

### 4.1 Runtime and toolchain pins (single sources of truth)

| Surface        | Pin                                    | Source of truth       |
| -------------- | -------------------------------------- | --------------------- |
| Bun            | `1.3.11` (latest published: `1.4.4`)   | `packageManager`      |
| Node range     | `>=22 <25`                             | `engines`             |
| Node in CI     | `24` (LTS, EOL 2028-04-30)             | `NODE_VERSION` env    |
| Vercel runtime | `nodejs24.x`                           | `VERCEL_NODE_RUNTIME` |
| Local asdf     | bun `1.3.11`, node `24.x`              | `.tool-versions`      |
| CI runners     | `ubuntu-24.04` (never `ubuntu-latest`) | all workflows         |
| CodeQL bundle  | `codeql-bundle-v2.27.4`, SHA-pinned    | `codeql.yml`          |

Bun is resolved in CI from `package.json#packageManager` itself (a local
`node -p` read, not a GitHub API call), `setup.sh` phase 1 enforces the
same pin, and `.tool-versions` was aligned `22.x -> 24.x` in that audit:
the file had no gate reading it, Node 22 maintenance ends 2027-04-30
while Node 24 (the CI major) is serviced to 2028-04-30, and the value
now agrees with `engines` and `NODE_VERSION`. Bun publishes no EOL
calendar; the wake-up order answers that by making Bun/Node upgrades
step 4 of `DORMANT.md`.

### 4.2 CI actions and gate-tool supply chain

Every `uses:` across the workflows is a 40-hex SHA with a version
comment (`checkout v7.0.1`, `setup-node v7.1.0`, `setup-bun v2.2.0`,
`cache v6.1.0`, `upload-artifact v7.0.2`, `download-artifact v8.0.2`,
`codeql-action` bundle `2.27.4`, `action-gh-release v3.0.3`), enforced
by the `check-actions-pins` gate. Weekly lanes keep the pins honest
without human input: `self-heal-actions` (Sun 10:00 WIB / 03:00 UTC)
heals them to latest releases, `maintenance` (Sun 10:00 WIB) validates a
deps-only `bun.lock` refresh through the full quality gate, `codeql`
(Sun 10:00 WIB) and `security-audit` (Sun 10:30 WIB, after the
maintenance commit) rescan, and `runtime-probe` (Sun 10:00 WIB) probes
`nodejs24.x/26.x/28.x` with the full gate and prepares the next Node
bump as a reviewed change. Gate tools install verifiable:
`yamllint==1.37.1` and `codespell==2.4.1` are exact pip pins, actionlint
`1.7.7` is checked against the publisher checksum file, b3sum `1.8.7`
is proven against the BLAKE3 known-answer vectors (it ships no checksum
asset), and shellcheck comes preinstalled on the pinned runner image.
None of the repo scripts call `api.github.com` or
`raw.githubusercontent.com`, so the rate-limit failure mode that the
hosted app had has no toolchain analog.

### 4.3 Dependency freshness against the live registry (2026-11-04)

`bun.lock` holds 460 packages; all 33 direct dependencies resolve, and
all 11 security overrides land at their intended floors (`undici
7.30.1`, `cookie 0.7.2`, `tar 7.5.22`, `devalue 5.9.4`,
`brace-expansion 5.0.12`, `source-map-js 1.2.2`,
`postcss-selector-parser 7.1.7`, `@humanfs/node 0.16.8`, plus the
`postcss`/`vite`/`esbuild` floors).

| Package                  | Resolved  | Registry latest | Standing                                    |
| ------------------------ | --------- | --------------- | ------------------------------------------- |
| vite                     | `8.3.5`   | `8.3.5`         | current                                     |
| eslint                   | `10.14.0` | `10.14.0`       | current                                     |
| prettier                 | `3.9.10`  | `3.9.10`        | current                                     |
| svelte-check             | `4.7.8`   | `4.7.8`         | current                                     |
| esbuild                  | `0.28.2`  | `0.28.2`        | current                                     |
| svelte                   | `5.55.9`  | `5.57.3`        | same major, minor behind                    |
| @noble/hashes            | `2.2.0`   | `2.4.0`         | same major; crypto, exact pin, no weakening |
| @sveltejs/kit            | `2.70.2`  | `3.1.1`         | next major exists; deliberate pin           |
| typescript               | `6.0.3`   | `7.0.2`         | next major exists; deliberate pin           |
| vitest                   | `4.1.12`  | `5.1.0`         | next major exists; deliberate pin           |
| @sveltejs/adapter-vercel | `6.3.4`   | `7.0.2`         | next major exists; deliberate pin           |

The five exact pins (kit, svelte, typescript, vitest, and the crypto
hash library) are the dormant-correct choice: majors (kit 3, TS 7,
vitest 5) are owner decisions, not maintenance bumps.

### 4.4 Advisory posture, live run (2026-11-04)

`bun run audit:deps`: 5 advisories, 0 blocking, all allowlisted with
concrete reasons and a common expiry of 2027-05-01 — `@sveltejs/kit`
low x2 (no 2.x fix; the fix is the 3.0.0 major), `deepmerge` low (no
fixed release upstream), `glob` and `minimatch` moderate (build/dev-time
only, via `@vercel/nft` tracing and the lint toolchain). Expired,
stale-severity, or mismatched entries fail closed and force re-review,
so the list cannot rot into a silence switch.

### 4.5 Watch items (none blocking)

1. A future `runtime-probe` Node 26 bump must raise the `engines` upper
   bound (`<25`) in the same change, or the manifest and CI disagree.
2. The two kit low GHSAs ride on 2.x until the 3.0.0 owner decision;
   the allowlist expiry forces the 2027-05-01 re-review.
3. shellcheck's version floats with the runner image (0.10.0 locally);
   it is skip-with-warning by design, so a future image change degrades
   gracefully rather than red.
4. Local gate-tool drift is cosmetic only (yamllint 1.38.0 vs CI
   1.37.1, codespell 2.4.3 vs 2.4.1); CI pins are authoritative.

Verdict: **suitable for dormant.** Every runtime and tool pinned to a
single source of truth, every action SHA-pinned with a weekly heal lane,
the advisory list policy-gated with a forced re-review date, no accepted
advisory or runtime EOL lands before 2027-05-01 (Node 24 runs to
2028-04-30), and the registry delta is entirely either current,
same-major, or a deliberately deferred major with the wake-up path
already written down in `DORMANT.md`.

## 5. The zelynic discipline sync (2026-11-04, night-improve-1..8)

Scope: the full infrastructure surface audited against the mature
reference implementation in the same owner's `zelynic` repository (a
Rust/eBPF CLI, v80.0.2, 12 workflows, 34,000+ lines of gate scripts).
The instruction was explicit: take what transfers, do not copy raw —
zelynic is a kernel-adjacent Rust binary, this is a SvelteKit web app.

### 5.1 What was ported and adapted

- **Workflow family:** Dragon Guard → Stellar Guard equivalents (CI,
  CodeQL, Gate-keepers, Security Audit, weekly dependency maintenance,
  Release adapted to tag build with no binaries, runtime probe adapted
  as the compatibility lane, docs CI as the codespell lane,
  self-heal-actions upgraded to the zelynic SHA-pin engine). N/A for
  honest reasons: Miri (no unsafe), fuzz (no cargo-fuzz targets; the
  vitest property-style suites cover the crypto/storage cores),
  crates.io publish (private npm package), KVM micro-VM sandbox,
  Supermassive kernel rigs, eBPF parity lanes.
- **Conventions brought in line:** actions pinned to full 40-hex SHAs
  with a version comment; `runs-on: ubuntu-24.04` for new lanes;
  `concurrency` on the new lane; `contents: read` least-privilege
  defaults; the commit-message convention (`Internal research: ...` +
  `Signed-off-by`) already matched the zelynic QA.md contract.
- **The one-per-file gate family:** scripts/{gates,dev,ci,lib}/ tree;
  LOC law as a ratchet (below); actions-pin shape + version sweep;
  version manager with changelog splice + version-sync gate; package
  metadata completeness; wholesale gate-keepers lane; commit-time hook
  shim; setup.sh bring-up; permission guard (the repo-wide 755 drift
  normalized: 219 files 644, 10 executables 755); CLI surface (-V,
  doctor); docs index; FUNDING.yml.
- **The LOC law, adapted honestly:** zelynic's 600-line Rust cap is
  enforced "no mercy" because the language splits cleanly into modules;
  this tree's legacy (14 files at 600-969 lines, including the i18n
  locale dictionaries where splitting is meaningless) cannot be split
  without a functional refactor, so the law landed as a ratchet: the 14
  legacy files are watermarked at their current size and may never grow;
  new files get the 600 cap outright; the debt ledger can only shrink.
  The scripts cap ports verbatim (1000 + `# LOC_EXEMPT:`).
- **Not ported, documented:** test placement stays collocated
  (`__tests__/`) against the vitest/SvelteKit idiom; src/ root layout is
  framework-mandated; the release checksum/signing pipeline was N/A
  while the app was web-only (since superseded by the signed release
  channel — see AUDIT-SEC-2026-11 section 4); the self-heal credential
  stays a weekly lane because `PAT_WORKFLOW` exists and the owner built
  the lane deliberately.

### 5.2 Defects found and fixed along the way

1. `codeql.yml` carried a malformed branch filter (`branches: ain, dev]`
   — the flow-sequence opening was eaten), so the filter silently
   degraded. Fixed in the consistency pass.
2. All 30 action pins were floating version tags, several 2-3 majors
   behind (checkout v5, cache v5, upload-artifact v5, download-artifact
   v6, setup-node v6). Healed to SHAs; the engine now crosses majors.
3. The whole tree was tracked at mode 755 (every file, LICENSE included)
   — a first-commit filesystem artifact. Normalized to 644/755-shebang
   parity under a new permission gate.
4. `README.md` alt texts used the lowercase two-word name (5 instances),
   outside the BRANDING 2.1 law. Fixed in the naming pass.

### 5.3 The consistency re-check (fresh clone, full toolchain)

Gate-keepers passed 12/12 with zero skipped sections; night-improve-1,
-2 (31 uses lines, all 40-hex SHAs), -3, -4, -5, -7 (600-line ratchet +
1000-line scripts cap) and -8 (name-case law, 232 files / 247 tokens,
zero violations) verified consistent with their recorded shape. The
release tag validator in `release.yml` was suspected broken: terminal
rendering of the inline `node -e` expression swallowed ANSI SGR bytes,
making the line LOOK like a syntax error in any pasted transcript —
byte-level inspection plus programmatic execution of the exact file
bytes proved the expression valid. No change was made to the workflow;
this note exists so the next auditor does not re-chase it.

### 5.4 Infra failure classes — the network-read audit

Every network read in the gate tooling audited against the failure
classes recorded in the owner's reference implementations (the shfmt
resolve death: an unauthenticated api.github.com read shares the 60
req/hour per-IP pool and a busy pool outlives any retry window).

- The actions version sweep already sends the run's ephemeral token as
  the Bearer header plus the dated X-GitHub-Api-Version header — the 403
  resolve class mitigated at the design level. Proven live from a
  shared-IP sandbox: unauthenticated, the sweep reported three pins as
  "unresolvable latest release"; the identical command with a token
  resolved all 31 pins (31 kept, 0 skipped). No standing secret added.
- The gap closed that day: tool downloads and API resolves carried no
  retry contract, so one transient 5xx / connection reset killed the
  step. The two gate-keepers actionlint downloads and the sweep's API
  reads now ride a bounded curl retry contract (3 attempts, 5 s delay,
  120 s total window). The API reads deliberately omit
  `--retry-all-errors`: a deterministic 404 must fail fast and record a
  skip, while curl's default transient set (408/429/5xx, connection
  errors) is exactly the retryable class; 429 additionally honors
  Retry-After. The version resolve stays the only api.github.com
  consumer in the repository; the pin-shape gate is offline by
  construction.

## 6. The depth hardening round (2026-11-19, engineering legs)

### 6.1 Determinism verified at peak (not assumed)

- The math core uses only IEEE-754 exact operations (`+ - * /`), no
  `Math.pow`, no transcendental functions, and a fixed `toFixed(2)`
  output precision; `lib.rs` (read in full, 779 lines) contains no
  `HashMap` iteration, no float formatting, static slot arrays only,
  and RustCrypto constructions whose output is deterministic by
  specification. The Mifflin-St Jeor BMR is pure arithmetic.
- The deterministic-build seat (innovation 28): the wasm artifact is
  pinned (`rust-toolchain.toml` channel 1.100.0 + `Cargo.lock` +
  recorded SHA-256 digest + the provenance CI lane). Kernel 5.15+: the
  wasm32-unknown-unknown target makes no syscalls, and the only native
  Rust execution surface is the CI provenance lane — there is no
  distro-sensitive code path to harden.
- **One real determinism finding, one deliberate skip:** `computeChainSync`
  sorts timestamp-only, so two records sharing one millisecond chain in
  stored-array order — a cross-realm merge could theoretically order
  them differently. Fixed head order would require a canonical tiebreak,
  which changes chain heads for any ledger containing duplicate-timestamp
  records and would false-positive the witness on upgrade. Skip
  (documented so it is re-litigable with evidence).

### 6.2 Guardian continuity (the hidden-failure-mode finding)

The scheduled runs visible in the Actions API (Aug–Oct, including the
Sept 7 → Oct 26 security-audit red streak) belong to the repository's
predecessor state: the current git history starts at `e43799d`
(2026-11-19 09:25), which created all ten workflow files fresh, with the
Sunday 03:00/03:30 crons. The Oct failures were stale signals — the
dependency audit they red on is now allowlisted with reasons and
expiries and passes locally. Both lanes were dispatched manually
post-fix to prove the current tree green instead of waiting; the first
scheduled firing of the recreated schedule was 2026-11-22.

### 6.3 Infrastructure fixes in the same round

The workflow inventory is otherwise exemplary: every job declares
`timeout-minutes`, every `uses:` is a 40-hex SHA pin, no `|| true`
swallows a real signal (each is documented and guarded), no stale path
references, scripts/ tree discipline fully compliant with RULES.md,
zero TODO/FIXME/HACK/XXX markers. Fixed: the two 15-minute jobs (a
direct RULES.md violation — measured runtime ~2 min, so the ceiling
holds with margin); the floating `@stable` toolchain inside a lane whose
own comment forbids float; the hardcoded `bun@1.3.11` error string that
drifts at the next bun bump. Noted, not fixed (observation-only posture
documented as intentional in the workflow): `continue-on-error: true` on
`rust-engine-audit` means an advisory finding can never redden the run —
an owner decision, in the queue.

### 6.4 Dragon hunt, optimization skip, five-area verdicts

- **Hygiene:** seven hex-encoder copies merged into one leaf home
  (`hex.ts`), the doubled import pre-guard merged (`importPlaintextOrFail`
  — which also fixes a misleading `wrong_passphrase` on the validate
  path for corrupted encrypted payloads), one shared
  `formatShareTimestamp`, the dead-code deletions and ratchet moves
  recorded in the timeline. Deliberate keep: `kdf-wasm-engine.ts`'s
  local base64/hex helpers — its documented dependency-leaf contract
  (imports nothing from the app) wins over dedup.
- **Optimization skip:** no profiling data exists in the tree (the perf
  claim surface is the runtime-proof CI lane, not a micro-benchmark
  harness), and every hot path the sweep inspected is already bounded by
  design. A micro-optimization without a measurement is superstition;
  none was performed.
- **Verdicts:** stability (the engine ABI validates every pointer/length
  pair, the seal/open seats zeroize on failure, panics abort the
  instance and the wrapper falls back to the byte-identical JS engine —
  a hostile input can lose the speedup, never the key); hygiene (above);
  optimization (skip); security (M1/M2 fixed — see AUDIT-SEC; IV/nonce
  hygiene, constant-time checksum compare, zeroization discipline,
  worker origin gates, CSP headers, supply-chain posture verified clean);
  LTS stability (guardian discontinuity resolved by evidence + dispatches;
  two CI-law violations fixed; two endurance burns fixed;
  deterministic-build and deterministic-math surfaces verified at peak).

### 6.5 Skipped by verdict (the over-engineering guard, stated plainly)

- **Ledger timestamp tiebreak** — the migration cost exceeds the
  edge-case benefit (section 6.1).
- **`kdf-wasm-engine` base64/hex dedup** — the dependency-leaf contract
  is an invariant with its own value. Kept.
- **~28 type-only un-exports** — public-surface churn across every
  module for zero behavior change. Noise exceeds value.
- **Constant-time chain-head compares** — the compared values are
  public/derived (not secrets); the timing oracle is theoretical. The
  existing XOR compare stays for checksums where it matters.
- **Seal-failure plaintext fallback indicator** — UX/product decision,
  queued (AUDIT-SEC section 6).
- **Passphrase hint plaintext / CSP `unsafe-inline` / legacy v0–v2
  forgeable checksums** — each a documented, deliberate design boundary
  (the zero-knowledge verifier design, the SvelteKit CSP limitation,
  integrity-only legacy imports). Owner decisions, queued.

## 7. The architecture verdict (2026-11-26, night-arc-gems-1)

Scope: the whole-tree architecture at the smoothbore bar — hot-path
latency, determinism (math proof plus build determinism), safety
(injection, storage, supply chain), honesty (claims versus mechanisms),
and LTS investment value. Method: static read of the hot paths (storage,
ledger chain, KDF engine order, render loops, HTML sinks), live gate
runs on the working tree (proof census, scripts LOC, headers, branding,
version sync, format), a production build under the warning-equals-
failed law, and symbol-level cross-checks of every claim against
`src/**` — no claim kept that could not point at its mechanism.

**Verdict: no code change required.** The architecture holds in every
audited dimension; the honest limits are observations with no action
recommended — investing in them now would be over-engineering.

- **Smoothbore:** the KDF never blocks the UI by design (production
  rides the KDF worker — the Rust wasm engine first, digest-verified
  before use, `@noble/hashes` as its in-worker fallback; the
  main-thread path exists only for tests, non-browser contexts, and
  worker failure, and logs the degradation); ledger append is amortized
  O(1) via cached checkpoints (`CACHE_MAX_ENTRIES = 4`); render loops
  are bounded and rAF-batched (sparkline `MAX_POINTS = 20`; DnaHelix
  ticks at 25 ms but writes to the DOM only on slot change and browsers
  throttle hidden tabs); every data boundary carries a numeric bound
  (import 10,000 records / 5 MB, 24-hour timestamp-skew tolerance,
  `MAX_BACKUPS = 3`, a 200-entry logger ring, a 512-entry warn-dev dedup
  table); the single-writer law is real and tested (an origin-wide Web
  Lock serializes ledger writes across tabs, with dedicated suites); the
  LOC law holds at the file level (largest source file 957 of the
  1000-line cap; `check-loc` and `check-scripts-loc` both pass).
- **Determinism and math proof:** the proof census guard passes — 7
  property-proof harnesses on disk (`clamp-display-for-all`,
  `next-after` float determinism, `classifier-for-all`,
  `bytes-hex-for-all`, `kdf-ladder-floor`, `envelope-kdf-gate`,
  `crack-time-ladder`), every law exported and exercised; the runtime
  proof harness proves eighteen fail-closed claims live in a pinned
  browser (`scripts/proof/run-proof.ts`) on its own CI lane; the
  service worker gates its precache on digest integrity and re-verifies
  round-robin per navigation — poisoning cannot survive a bounded number
  of navigations; the audit window added the depth-strict build law:
  **warning = failed** at every build-adjacent lane (svelte-check
  `--fail-on-warnings`, eslint `--max-warnings 0`, a bundler `onwarn`
  law turning any warning including the 700 KB chunk cap into a hard
  build error).
- **Safety:** the HTML injection surface is static by construction — all
  12 `{@html}` sinks render developer-owned locale strings from
  `src/lib/i18n/locales/*.ts` shipped inside the bundle, no sink
  interpolates user data, no dynamic key reaches `t()`; security headers
  ship from `src/hooks.server.ts` (CSP with an explicit `img-src`
  allowlist minus the flagged wildcard, HSTS, COOP/COEP,
  Permissions-Policy); the at-rest seal keeps its honest failure modes
  (night-frontier-Z6-Z9 symbols verified on disk: `ledger-vault-anchor.ts`,
  `ledger-continuity.ts`, `vault-opfs.ts`); the supply-chain policy
  holds on the tree (registry-only ranges, an empty lifecycle-script
  trust list, exact-pinned engine dependencies, digest-pinned scanners,
  `audit:supply-chain` green).
- **Honest limits (observations, not defects):** the live history
  carries no record cap (the realistic bound is the import cap and
  human cadence; a cap now would be a policy change, not a fix); the
  main-thread KDF fallback blocks the UI for the derivation window when
  the worker itself fails (intentional degradation with a logged
  warning, not a hot path); `__BUILD_TIME__` embeds wall-clock time so
  the web bundle is not byte-reproducible by design (display-only; the
  wasm engine lane is byte-reproducible and digest-verified, which is
  where reproducibility carries security weight); the DnaHelix 25 ms
  poll is an arithmetic slot comparison with a DOM write only on slot
  change — negligible on any targeted hardware.

## 8. The CSS fat measurement pass (2026-11-28, night-consolidation-1)

An external ecosystem-depth report claimed the 6.1k-line CSS estate
"still carries a little fat" and suggested a trim. This pass measured
that claim against the tree before touching anything — and the verdict
is skip: the claim was speculation, the estate is at peak on every axis
that can carry fat.

| Axis                                                                          | Measurement                                                               | Result                                                                                                                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class selectors (18 files, 6,127 lines)                                       | 331 extracted, checked against every `.svelte`/`.ts`/`.html` reference    | 331/331 referenced — zero dead classes                                                                                                                                           |
| Custom properties                                                             | 306 defined across the token estate                                       | 306/306 consumed via `var()` — zero dead tokens                                                                                                                                  |
| Pure duplicate blocks (same selector + identical body + same cascade context) | full-tree block census                                                    | 0                                                                                                                                                                                |
| Same-context same-selector repeats                                            | 3 in `responsive-mobile-perf.css` (`body`, `.pager-shell`, `.action-btn`) | all deliberate section-local overrides with disjoint properties, each bound to its explaining comment; ~9 mergeable lines (0.15%) bought at the cost of comment-to-rule locality |
| Dead declarations (property fully shadowed by a later same-context rule)      | pairwise body comparison of the 3 repeats                                 | 0                                                                                                                                                                                |
| Orphan `@keyframes`                                                           | 18 defined, usage-census via animation shorthands                         | 0 (the single scanner hit was a comment false-positive: "bounce/pulse removed" prose)                                                                                            |
| Unreferenced CSS files                                                        | import graph over `src/`                                                  | 18/18 imported                                                                                                                                                                   |

Skip justification: the only mechanical trim available merges three
disjoint-property override blocks for ~9 lines while unbinding them from
the comments that explain each override's why — the merge is
semantics-preserving but strictly negative on both size (0.15%) and
readability. A fat trim without a measurement is superstition; the
measurement says nothing to trim. The measurement scripts ride as
`scripts/dev/css-fat-hunt.py` and `scripts/dev/css-fat-deep.py` so the
next claim of the same shape can be settled by running them instead of
re-litigating.

## 9. Owner decision queue (engineering-facing, merged)

1. Manifest 1024 px icon (724 KB): swap to 512 to save payload,
   accepting possible launcher icon selection differences.
2. Allowlisted advisories expire **2027-05-01** — re-review forced by
   the policy gate; on wake-up per `DORMANT.md`.
3. The SvelteKit 2 → 3 migration (moving `svelte.config.js` into the
   `sveltekit(...)` Vite plugin options) is a dedicated planned task,
   never a bulk update. Context: on 2026-11-03 a local bulk
   `bun update --latest` pulled nine majors at once and SvelteKit 3's
   `config_file_unsupported` check rejected `svelte.config.js` during
   the `prepare` script. The repository is immune by design — no
   `--latest` in any workflow or script, weekly maintenance refreshes
   in-range via `bun update --lockfile-only`.
4. `continue-on-error: true` on `rust-engine-audit` — keep
   observation-only, or escalate a red advisory into an owner signal?
5. CLA.md / NOTICE: legal instruments that change contribution terms —
   an owner decision, not an agent's.
6. A markdownlint-cli2 lane: cheap but a new config surface; commit the
   config alongside if adopted.
7. A browser E2E lane (Playwright-class) for the install/offline/backup
   flows — the PWA offline shell has a source-level gate and unit
   tests but no real-browser battery.
8. Branch protection: the gates are advisory to a direct-push main;
   requiring `Stellar Guard - CI` and `Stellar Guard - Gate-keepers`
   checks on main would close the last gap — a repository-settings
   decision.

---

_Consolidated 2026-11-28 from the five source audits named in the
header; every claim above is reproducible from the cited file:line at the
commit recorded with it._

<!-- BMI-DISCLAIMER -->
<!--
  Documentation Disclaimer — read before relying on any data point.

  This document may contain stale data, hardcoded counts, or outdated
  file paths and symbol names. Maintainers update source code but may
  forget to sync every doc — perfect sync across every .md file is a
  known maintenance burden with diminishing returns.

  Source code (`src/**/*.ts`, `src/**/*.svelte`) is the single source
  of truth. Always cross-check against the actual source files before
  relying on any specific number (test count, record bound, key
  length), file path, function name, or config key.

  If you find a discrepancy, please open a PR — the doc is wrong, not
  the source.
-->
