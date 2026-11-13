<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# The BMI Stellar Innovation Ledger

This document records, in one sitting, the innovations this repository
actually implements — for long-term support and for whoever has to
learn the engine in an hour instead of a month. It is written in the
fleet ledger style of the owner's reference repositories (zelynic,
zejtron): dense, declarative, every claim mapped to a mechanism you can
open in the source tree.

The law underneath everything here: **no account, no cloud, no
telemetry of health values.** The ledger never leaves the device.
Where a claim has an honest limit, the limit is written down in the
same breath as the claim.

Provenance: assembled night-docs-1, 2026-11-13, from the source tree
and the frozen audit records (`docs/AUDIT-2026-11.md`,
`docs/AUDIT-INFRA-2026-11.md`, `docs/AUDIT-LTS-2026-11.md`); audited
against the source and the test suites in night-audit-1. The source
code (`src/**/*.ts`, `src/**/*.svelte`) is the single source of truth;
this document describes it and can go stale — the closing disclaimer
says so on purpose.

## The engine, named

The product is **the validated ledger**: every measurement is
validated at one hardened guard, classified by one classification
source, stored on the device behind one storage abstraction, exported
encrypted and signed, and audited by a gatekeeper that mirrors CI
step-for-step. The engine is the data chain, not the UI — the pager,
the gauge, and the share cards exist to serve it.

Honest limits, stated plainly: local browser storage (localStorage and
the IndexedDB backup) is not encrypted at rest — the AES-256-GCM layer
protects exported files; legacy export checksums (v0-v2) are forgeable
by design and survive only so old imports keep reading; the product is
single-user, single-device by construction, with no cloud to sign
into.

## The innovations, in dependency order

**1. The Three-Tier Storage Escalator — memory cache, localStorage
mirror, IndexedDB truth.** `src/lib/utils/storage.ts` fronts all
persistence: an in-memory cache for instant reads, localStorage as the
synchronous write-through mirror, IndexedDB (via `src/lib/utils/db.ts`)
as the durable primary store with automatic migration. Two races are
defeated in writing: a per-key promise chain serializes the IndexedDB
writes so the final state always matches the latest `storageSet()`
call, and every IndexedDB write promise settles on transaction COMMIT,
not on request success — an abort after request success rejects and
leaves the previous value intact (atomic rollback). The durability
contract is pinned by `db-atomicity.test.ts`;
`SecurityError`, `QuotaExceededError`, and JSON parse failures degrade
gracefully with dev-only warnings — a poisoned or full store never
throws into the UI. The whole storage surface is named and minimal
(`bmi.history`, `bmi.goal`, `bmi.goal.start`, `bmi.unitSystem`,
`bmi.locale`, plus the encryption verifier in IndexedDB).

**2. One Guard on Every Door — the validated data chain.**
`src/lib/utils/history-io.ts` exports the hardened `isValidRecord` /
`toRecord` pair; `src/lib/utils/bmi-history.ts` wraps them in a single
validated accessor, `readBmiHistory()`, which never throws — malformed
JSON, non-array payloads, and invalid records degrade to a shorter
sorted list. `saveBmiToHistory()` is self-healing: every save rewrites
storage with validated records only, so poison purges itself on the
next write. Identical consecutive saves dedupe through
`buildHistorySignature()` — a repeated calculation of the same numbers
never bloats the history. Provenance: night-spark-lts-1, commits
`89154ed` (the import gate — non-finite, out-of-bounds, and far-future
records rejected) and `3cff019` (read parity — four consumers that
trusted raw `JSON.parse`, including the sparkline and the snapshot
best-BMI reduce, were routed behind the guard). Verification: the
vitest battery carries a raw `1e999` JSON literal test that failed
against the old read paths and passes against the current one, plus a
dedicated validated-read and self-heal suite in `bmi-history.test.ts`.

**3. The Exact-Constant Metrics Core — science, not folklore.**
`src/lib/utils/bmi-calculator.ts` carries the published constants
exactly: 2.54 cm per inch by definition and 0.45359237 kg per pound
(the 1959 international avoirdupois pound agreement), Mifflin-St Jeor
BMR with the male +5 / female −161 offsets, and the five published
TDEE activity factors. `src/lib/utils/bmi-category.ts` is the single
classification source — the CSV export reuses `classifyBmi` /
`getCategoryLabel` instead of duplicating thresholds. BMI Prime, ideal
weight range, and Deurenberg body fat ride the same guarded core.
Verification: the "paranoid masterclass" precision suite
(`math-precision.test.ts`) proves the constants are the exact
published values, that BMI stays finite and deterministic for
extreme-but-valid inputs at every boundary of `INPUT_LIMITS`, and that
BMR/TDEE produce exact scientific values across the full age span.

**4. The Rolling Auto-Backup Vault — three snapshots deep.**
`src/lib/utils/backup.ts` keeps the last three rolling backups in
IndexedDB, triggered on data change and before any import overwrite
(the oldest auto-deletes on each new backup). Every snapshot carries
its timestamp, the app version, and the record count; `getBackupStatus()`
drives the "last backup" indicator. Restore writes raw by design —
safe because every read path validates (innovation 2), so a per-key
schema guard would duplicate the chain's one guard.

**5. The Encrypted Envelope — `bmi-encrypted-v3`.**
`src/lib/utils/crypto.ts`: AES-256-GCM authenticated encryption, a
random 12-byte IV per encryption, a 16-byte salt, and Argon2id key
derivation (64 MiB memory, 3 iterations, parallelism 1 — the OWASP
2023 recommendation) via `@noble/hashes/argon2.js`, pure JavaScript
with no WASM. Integrity rides the AES-GCM auth tag plus a SHA-256
ciphertext checksum in `meta.checksum`. KDF auto-detection reads the
`kdf` field: `'argon2id'` for current files, absent for legacy PBKDF2
(600,000 iterations) imports. Legacy `bmi-encrypted-v1` envelopes stay
readable. Verification honesty: the crypto suite runs in the Node
test environment because jsdom's `crypto.subtle` is non-functional —
a documented constraint, not a hidden one.

**6. The Off-Main-Thread Key Forge — the UI never freezes during
derivation.** `src/lib/utils/kdf.worker.ts` +
`src/lib/utils/kdf-worker-client.ts`: the pure-JS Argon2id at 64 MiB
blocks its calling thread for real time on low-end devices, so the
derivation runs in a dedicated Web Worker with the same parameters as
the inline path; the UI awaits a promise while the worker burns the
memory. The client has its own suite (`kdf-worker-client.test.ts`).

**7. The Zero-Knowledge Verifier (v18.1).** When encryption is
enabled, `enableEncryption()` encrypts a known verifier string
(`BMI_STELLAR_VERIFIER_V1`) with the passphrase and stores only the
ciphertext in the IndexedDB `meta` store. `verifyPassphrase()` decrypts
it — a wrong passphrase trips the AES-GCM auth tag mismatch and
returns false. The passphrase is never stored, cached, or transmitted;
the verifier confirms a candidate without revealing the secret. Honest
limit: there is no recovery mechanism, by design — no backdoor exists.

**8. The Per-Export Salt Signature — same records, different
signatures.** The v3 export envelope in
`src/lib/utils/history-io.ts` carries an HMAC-SHA256 `signature`, an
`algorithm` field, and a per-export random `salt`: re-exporting
identical records produces a different signature every time, which
defeats correlating record sets across separately leaked files. The
header comment states the boundary honestly — the signature detects
accidental corruption and casual tampering, not a determined attacker
holding the bundle (the README Limitations section repeats it).

**9. The Legacy Import Ladder — retired, but kept readable.**
`src/lib/utils/legacy-hash.ts` exists solely so history exports from
the v0 (FNV-1a) and v1 (FNV-1a+DJB2) eras keep validating on import;
PBKDF2 (600,000 iterations, SHA-256) survives import-only. The file's
own header forbids new use: these are checksums, not security —
trivially forgeable, kept for backward compatibility and nothing else.
The import-side rejection tests cover the legacy v0 path explicitly.

**10. The Honest Strength Meter — entropy you can act on.**
`analyzeStrength()` in `src/lib/utils/crypto.ts` scores passphrases
with `@zxcvbn-ts/core` (+ `@zxcvbn-ts/language-common`), estimates
entropy, and falls back to length/character-class heuristics if
zxcvbn fails to load. `src/lib/utils/crack-time.ts` formats the
estimated crack time into localized singular/plural buckets —
centuries down to seconds, with 365.25-day years and 30.44-day months
— so the same estimation reads correctly in all four locales.

**11. The Throttled Update Check — the privacy posture applied to
itself.** `src/lib/stores/pwa-update.ts` (`AUTO_UPDATE_CHECK_INTERVAL_MS`
= 12 hours) and `src/routes/+layout.svelte`: the automatic update
check (two unauthenticated GitHub GETs, no payload, no health data)
runs at most once every 12 hours per device via
`shouldRunAutoUpdateCheck` and the `bmi.updateCheckAt` key in
localStorage. A failed or offline attempt is not recorded, so the next
load retries instead of blinding the check; manual checks in About and
service-worker confirmations never throttle. Commit comparison is
exact normalized equality only — `commitsMatch()` refuses prefix
matching because distinct commits can share a prefix (`abc123` vs
`abc123def`), a subtlety the suite pins with the short-SHA collision
test. Provenance: the LTS audit finding F1 (2026-11-04) — the check
fired on every production load, maximizing the exact
IP/user-agent/timing surface the privacy posture promises to minimize;
the fix landed with three unit tests and an updated README disclosure.

**12. The PWA Offline Shell Contract — a gate, not a hope.**
`src/service-worker.ts` precaches the app shell, serves an offline
fallback page that tells the user to reconnect and refresh, and
validates the shell before adoption: `isUsableAppShell()` gates the
new cache, the previous shell is kept as fallback, and old caches are
cleaned only after this version has a usable shell. The install
prompt is captured via `beforeinstallprompt` only when a real user
gesture can call `prompt()`. The contract is enforced by a gate —
`scripts/gates/check-pwa-offline-shell.ts` audits the source-level
shell contract in CI, so the offline promise cannot silently rot.

**13. The i18n Engine and the Universal Unit Law.**
`src/lib/i18n/index.ts` + `src/lib/i18n/locales/`: flat dot-notation
dictionaries with `{param}` interpolation, a fallback chain
(`dicts[locale]` -> `dicts['en']` -> raw key), English static and
Indonesian/Japanese/Chinese dynamically imported, `<html lang>` set
dynamically (`zh` maps to `zh-CN`), and the switcher portaled to
`document.body` so strict containers cannot clip it. The law: compact
numeric contexts use universal unit symbols (kg, cm, lb, in, kcal) in
every locale — only human-readable labels translate — so the share
card and result panels stay consistent across languages.

**14. The Capability Tier Engine — motion matched to hardware.**
`src/lib/utils/animation-config.ts` classifies the device at runtime:
high (cores >= 8 AND memory >= 8 GiB AND connection 4g or offline),
medium (cores >= 4 AND memory >= 4 GiB), low (everything else), with
medium as the default under SSR or missing hardware APIs. Every
constant is `as const` with cross-constant invariants enforced by
tests (for example `WHEEL_RECENT_SCROLL_BLOCK_MS < WHEEL_COOLDOWN`).
`src/styles/nav.css` applies GPU containment (`contain: layout style
paint`) on high-tier devices and disables `backdrop-filter` on low;
`src/styles/responsive-mobile-perf.css` strips expensive paint work on
`(hover: none) and (pointer: coarse)` devices.

**15. Strict Touch Intent Detection — diagonal swipes never hijack
the page.** The touch criteria live in the `SCROLL` block of
`src/lib/utils/animation-config.ts` and are applied in
`src/lib/utils/touch-pager.ts`: horizontal-dominant angle ratio 2.05,
minimum swipe distance 96px, maximum gesture duration 420ms,
post-navigation cooldown 520ms, a 16px vertical intent threshold with
a 28px cancellation threshold, excluded targets (buttons, links,
inputs, labels, `[role="button"]`), and a 5ms haptic on success
(`HAPTIC.NAV`). The touch-mode idle delay (480ms) keeps vertical
scrolling native — horizontal navigation commits only when the
gesture is unambiguous, and the invariants (angle ratio > 2, positive
thresholds) are pinned in `animation-config.test.ts`.

**16. The Safe Premium Spring — overshoot without glitch.**
`src/lib/utils/pager-spring.ts`: section transitions enter with
`backOut` (scale 0.98 overshooting to about 1.01 and settling at 1.0)
and exit with `cubicOut` reversed in time — ending exactly at the base
CSS state, so a WAAPI cancel before DOM removal produces no visual
flash. The anti-glitch rules were discovered through seven fix
iterations and are written down in the file; the exit shape is proven
in commit `11a717f`.

**17. The Lazy Section Registry — fast first paint.**
`src/lib/utils/lazy-load.ts` loads heavy components on demand through
an IntersectionObserver with a small root margin (preloading slightly
before visibility). The registry in `src/routes/+page.svelte` pairs
the calculator loader (form + results) and covers gauge, health risk,
snapshot, body fat, and goal tracker; the Reference table preloads
eagerly as its section index approaches. `DebugPanel` stays statically
imported but renders only in development.

**18. The Share Card Forge — premium pixels, locale-safe.**
`src/lib/utils/share-image.ts` renders a 1080 x 1080 Canvas PNG:
gradient frame with inner sheen and radial aura, brand title, 150px
category-colored BMI numeral, mini gauge across the 12-42 band,
category pill, stat cells, segmented scale bar with marker, insight
box, and locale-aware footer. `localeToUpper()` applies `.toUpperCase()`
only to Latin text — CJK ideographs, Kana, and Hangul ranges are a
no-op by code-point range, so no locale produces mojibake. Delivery:
Web Share API when `navigator.share` + `canShare({files})` agree, else
a programmatic `<a download>`; filename `bmi-stellar-{bmi}.png`.

**19. The Trace ID Observability (v16.0) — correlation without
leakage.** `src/lib/utils/trace.ts` generates session trace IDs with
child spans and auto-incrementing counters so log entries correlate
across modules and async operations; `src/lib/utils/logger.ts` carries
the structured log lane; `warnDevOnce()` (`src/lib/utils/warn-dev.ts`)
de-duplicates developer warnings. `src/lib/utils/dev-diagnostics.ts`
exposes `window.__bmi_dev` (storage, encryption, backup, environment
inspection) in development mode only and is completely eliminated from
production builds. The platform lane rides beside it: the B-1 Web
Vitals observer in `src/routes/+layout.svelte` watches LCP, CLS, and
(INP where the browser supports it) through `PerformanceObserver`,
silently and capability-gated, with every observer disconnected on
teardown. The operational rule stands over all of it: never log
passphrases, derived keys, verifier plaintext, backup payloads, or raw
health history.

**20. The Gatekeeper Fleet — governance as a product.**
`scripts/build.sh check-all` mirrors the `ci.yml` workflow
step-for-step — the local verdict and the CI verdict are the same
verdict — with `doctor` diagnostics and a `-q` essentials mode whose
failed steps still print the log tail. The gates live one concern per
file under `scripts/gates/`: the three-tier LOC law (1000 hard cap,
the 600-line ratchet ledger `scripts/loc-ratchet.json` that can only
shrink, 1000 for scripts with the honest `# LOC_EXEMPT:` IOU), the
permission law (644 files, 755 with shebang parity), the name-case law
(`scripts/gates/check-name-case.py` over every tracked file with
`file:line:token` output), the repo-wide emoji sweep with a
frozen-history skip set, and the version triangle (package.json /
DORMANT.md / README.md) synced only through
`scripts/dev/version-to.*`. The commit-time hook shim
(`.githooks/pre-commit` -> `scripts/gates/check-commit-gate.sh`) runs
the cheap gates fail-closed so an uncommittable tree cannot sneak
past `git commit`. Provenance: night-improve-1..8, the zelynic
discipline sync recorded in `docs/AUDIT-INFRA-2026-11.md`.

**21. The Self-Healing Supply Chain.** Every workflow `uses:` pin is
a 40-hex SHA with a version comment, enforced strict by
`scripts/gates/check-actions-pins.sh`. `self-heal-actions.yml` heals
tag pins to SHAs weekly, crossing majors, fetching and rebasing
between push attempts behind a fail-closed write guard.
`maintenance.yml` refreshes the lockfile only (`bun update
--lockfile-only`) and pushes the result through the full quality gate —
dependency drift can never bypass the gates. `runtime-probe.yml`
probes future Node majors and prepares the bump as a reviewed change.
`audit:deps` is fail-closed against an expiring allowlist: every entry
carries a reason and an expiry, an expired entry fails the gate, and
the list cannot rot into a silence switch. The network reads in the
gate tooling ride a bounded curl retry contract (3 attempts, 5s delay,
120s window, 429 honoring Retry-After) — the api.github.com
60-requests-per-hour lesson written into the scripts themselves.

**22. The Ten-Minute CI Budget.** Every workflow job declares
`timeout-minutes` and no job sets it above 10 — verified across all
nine workflows. `RULES.md` states the law: a CI lane that cannot
finish inside ten minutes is a design defect, not a runner problem —
split the lane, cache the install, or shrink the work. Scheduled
guardians (CodeQL, maintenance, runtime probe) live under the same
ceiling.

**23. Release Verification Without Artifacts.** `release.yml`
validates the tag against `package.json` before anything builds —
the tag must match the manifest exactly (`80.0.0` -> `v80.0.0`).
Source and build archives ship with SHA-512 sidecar checksums
(`sha512sum -c`); pre-release suffixes are flagged pre-release and
never marked latest. There are no binaries to sign because the npm
package is private and BMI Stellar ships as a Vercel-deployed web app
— the README tells that story once.

**24. The Depth Signature Matrix — attribution that cannot silently
disappear (night-signature-1; masked in night-signature-advanced-2).**
One canonical attribution string lives in `src/lib/utils/signature.ts`
and is embedded at every recorded depth of the project — since the
advanced-2 upgrade only as an XOR-masked hex payload, so grepping the
tree for the wording finds nothing: a bulk find-and-replace rebrand
cannot strip what it cannot see. The decoder reconstructs the string
at runtime and every compiled surface still prints it: the About
section renders it as a UI row beside the license, `src/app.html`
carries it in the author meta as numeric character references
(rendered plain by every browser), the PWA manifest
(`static/manifest.json`) and the package manifest (`package.json`)
record the masked payload as a machine-readable field, the offline
shell footer signs itself from the decoded constant, and
`scripts/build.sh` decodes the same payload in shell and prints it on
`-V`/`--version` and in the doctor tree. The enforcement stays
fail-closed and value-blind: `scripts/gates/check-signature.ts`
imports the decoder, pins the decode against a SHA-256 digest
recorded there — the plain wording exists nowhere in the tracked
tree, not even in the gate — and probes every recorded surface for
the masked form; the commit gate runs it cheap, and
`signature.test.ts` pins the same digest without spelling the value,
cross-checking the decode against the plain package author field as
an independent oracle. TRADEMARK.md stays deliberately plain: the
loud legal layer and the silent runtime layer are different tools —
the notice proclaims ownership in public, the payload survives bulk
rebranding. The honest limit is written into the constant's own
header: the decoder is readable by design; masking kills the casual
grep-and-strip path, not a determined reader, and stripping still
requires editing the gate — a visible diff — with the AGPL-3.0-only
license plus TRADEMARK.md making the legal cost real.

## Retired by verdict

The rejected ideas stay recorded so nobody re-litigates them blind:

- **PBKDF2 as the primary KDF.** Replaced by Argon2id for all new
  encryptions; kept readable for legacy imports only (innovation 9).
- **Non-cryptographic export checksums (FNV-1a, v0-v2).** Forgeable
  by design; superseded by the v3 HMAC-SHA256 salt signature. Kept
  import-only in `src/lib/utils/legacy-hash.ts`.
- **The per-load update check.** Maximized the exposed
  IP/user-agent/timing surface; replaced by the 12-hour throttle
  (innovation 11), proven live at the CDP level in the LTS audit.
- **Raw storage reads.** Four consumers trusted `JSON.parse`
  directly (sparkline scaling, snapshot best-BMI, export summary,
  write-back); all routed behind `readBmiHistory()` in commit
  `3cff019`.
- **The static-deploy era.** The zombie `svelte.config.static.js` and
  its `@sveltejs/adapter-static` dependency referenced by no build,
  script, or doc were removed in commit `007156f`.
- **The unreferenced brand master in the shipping payload.** The
  1.0 MB master image sat in `static/`, precached on every install
  while nothing rendered it; it left the shipping payload in commit
  `6c7c8d4` and the web-facing derivatives (192-1024 px) stay in
  `static/assets/` under the retired-asset guard
  (`scripts/gates/check-branding.ts`).

## Reading order for a new maintainer

`AI_AGENTS_READ_THIS.md` -> `README.md` -> `docs/furthermore.md` ->
`src/lib/utils/storage.ts` -> `src/lib/utils/bmi-calculator.ts` ->
`src/lib/utils/history-io.ts` -> `src/lib/utils/bmi-history.ts` ->
`src/lib/utils/crypto.ts` -> `src/lib/utils/kdf.worker.ts` ->
`src/service-worker.ts` -> `src/routes/+layout.svelte` ->
`scripts/build.sh` -> `scripts/gate-keepers.sh` -> `RULES.md` ->
`DORMANT.md`.

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
