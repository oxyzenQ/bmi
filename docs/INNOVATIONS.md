<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

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

Honest limits, stated plainly: health values seal at rest only when
written during a passphrase-verified session — values from sessions that
never present the passphrase stay plaintext (innovation 25); legacy
export checksums (v0-v2) are forgeable by design and survive only so old
imports keep reading; the product is single-user, single-device by
construction, with no cloud to sign into. Since night-frontier-Z8 the
custody arc is complete: the passphrase bytes, the witness attestation
key, and the at-rest seal key all live in provable engine custody while
a session is unlocked (each with its honest fallback, each wipe
self-reporting all-zero from inside the sandbox).

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
(`bmi.history`, `bmi.unitSystem`, `bmi.wallpaperTheme`, `bmi.locale`,
`bmi.goal`, `bmi.goal.start`, `bmi.passphrase_hint`, plus the
encryption verifier in IndexedDB).
Night-frontier-Z5 sharpening: the escalator's queues were per-realm —
two tabs raced the same origin storage with no shared mutex. The
single-writer law (innovation 32) now holds the origin-wide ledger
lock across every legit write, and `src/lib/utils/storage-coherence.ts`
drops stale health-key cache entries the moment a foreign tab's
storage event names them, so no stale pre-state can feed a merge.

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

**4. The Rolling Auto-Backup Vault — three snapshots deep, plus the
flush() tier (night-frontier-Z4).**
`src/lib/utils/backup.ts` keeps the last three rolling backups in
IndexedDB, triggered on data change and before any import overwrite
(the oldest auto-deletes on each new backup). Every snapshot carries
its timestamp, the app version, and the record count; `getBackupStatus()`
drives the "last backup" indicator. Restore writes raw by design —
safe because every read path validates (innovation 2), so a per-key
schema guard would duplicate the chain's one guard. The vault tier
(innovation 30) is the second durable home for the latest snapshot.

**5. The Encrypted Envelope — `bmi-encrypted-v3`, now tier-aware.**
`src/lib/utils/crypto.ts`: AES-256-GCM authenticated encryption, a
random 12-byte IV per encryption, a 16-byte salt, and Argon2id key
derivation through the Rust wasm engine (innovation 28), with the
pure-JS `@noble/hashes/argon2.js` engine as the fallback — both pinned
byte-identical. Since night-frontier-Z4 the derivation rung comes from
the device-tier ladder (innovation 31) and RIDES THE ENVELOPE: the
`kdfParams` field stopped being decoration and drives decryption, so a
vault sealed at any rung opens on any device. Integrity rides the AES-GCM
auth tag plus a SHA-256
ciphertext checksum in `meta.checksum`. KDF auto-detection reads the
`kdf` field: `'argon2id'` for current files, absent for legacy PBKDF2
(600,000 iterations) imports. Legacy `bmi-encrypted-v1` envelopes stay
readable. Verification honesty: the crypto suite runs in the Node
test environment because jsdom's `crypto.subtle` is non-functional —
a documented constraint, not a hidden one.

**6. The Off-Main-Thread Key Forge — the UI never freezes during
derivation.** `src/lib/utils/kdf.worker.ts` +
`src/lib/utils/kdf-worker-client.ts`: the 64 MiB Argon2id blocks its
calling thread for real time on low-end devices, so the derivation
runs in a dedicated Web Worker — the wasm engine first (innovation 28),
the pure-JS engine as the in-worker fallback — with the same
parameters as the main-thread path; the UI awaits a promise while the
worker burns the memory. The client has its own suite
(`kdf-worker-client.test.ts`). Night-frontier-Z6 sharpening: the
engine-first ordering is pinned by the worker behavior battery
(`kdf.worker.test.ts` — the wasm engine derives first and
byte-identical; an unavailable or trapping engine falls back without
changing a byte), and the artifact chain that keeps the primary seat
real now rides the zelynic Dragon Guard maintenance lineage: the
weekly Cargo sweep with a dependency-only diff and staged bot commit,
formatting and strict clippy on every push beside the provenance
digest, the wasm parity gate refusing a sweep it cannot prove,
cargo-audit over the engine lockfile, and the three-surface
version-sync gate tying `rust-toolchain.toml`, the Cargo.toml MSRV,
and the maintenance workflow to one toolchain version.

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
Night-frontier-Z7 sharpening (B3, the cache-integrity-gated shell):
the offline promise gets a second gate — the precache itself. At
INSTALL every precached body is SHA-256-digested into an integrity
manifest stored beside the assets (`shell-integrity.ts`, a leaf
testable without SW globals); at ACTIVATE the manifest is re-verified
entry by entry, a mismatching entry is DELETED before anything else
can serve it and re-fetched with `cache: 'reload'` when the network
allows, and the old-cache cleanup waits for a gate with no unresolved
verdicts — a poisoned, unhealed cache keeps the previous buckets alive
as the fallback instead of inheriting their trust. Cache poisoning
cannot survive an update. Honest limits, stated plainly: workbox
precaching ships revision hashes (the primitive is prior art — the
rare part is the gate ADOPTION in a hand-written service worker); the
service worker is the root of trust (a compromised SW is outside this
model — the gate targets state that OUTLIVES it); verification runs on
the update path, not per fetch; only the precache is digested (the
runtime cache holds origin-served content); pre-Z7 caches carry no
manifest and read 'unverified' (the gate adopts forward, never
misfires backward). The battery drives the REAL module against a fake
Cache bucket: tamper→delete→refetch→heal byte-for-byte, offline
poison loses its seat and its manifest attestation, damaged manifests
read unverified, and the digests cross-check against noble.
Night-frontier-Z10 sharpening — the bounded window: the honest limit
above ("verification runs on the update path, not on every fetch")
left a poisoned entry able to serve until the NEXT update, which can
be weeks away — while the repo's own law says digesting per fetch
would cost the offline path real time for no threat-model gain. The
window closes without breaking that law: ONE manifest entry is
re-digested per NAVIGATION EVENT, round-robin, with the activate
sweep's delete/heal semantics verbatim (`verifyNextIntegrityEntry`) —
amortized to one match plus one SHA-256 of a single entry per
navigation, the whole precache re-verified every N navigations (N =
manifest size). The B3 claim upgrades: poisoning cannot survive a
BOUNDED number of navigations, not just an update. The required
second half was in the source: the service worker caches navigation
shells at runtime, so a fresh shell's manifest digest goes stale
after the first navigation and a runtime verify that hit it offline
would delete the only offline shell copy and fail to heal. The reseat
law applies — a legit runtime write re-seats its manifest digests at
the moment of the write (`noteShellWrite`, the ledger's reseat
discipline carried into the shell), so the gate's invariant is "the
manifest matches the cache after every legit write; any other
divergence is an out-of-band write" and a navigation-rewritten shell
can never false-heal on a later sweep. Manifest mutations (re-seat,
round-robin verdict, full sweep) share one per-realm serializer; the
absent-manifest degrade stays 'unverified', and a runtime note never
ARMS a pre-Z7 cache (its other entries were never digested — arming
would false-accuse them). The battery pins the cycle order, the
bounded detection of mid-cycle poison (at most N navigations, the
seat dropped, the cycle shrinking around it), the heal-through-network
carrying its new digest, the re-seat that prevents the false offline
heal, the upsert adoption of a runtime-written route, and the honest
degrades; the PWA offline-shell gate audits the wiring statically
(the SW cannot run in vitest — the semantics are proven live where
they live).

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
`scripts/gates/check-actions-pins.sh` — the contract's one automatic
seat: the pre-commit gate re-reads pin freshness on every commit
(advisory by default, a network fact never blocks a commit) and names
the heal command when a pin is behind. The server-side weekly lane is
retired together with its standing Workflows-write PAT; the heal is
on demand (`scripts/ci/actions-version-sweep.sh --dry-run` to read,
`--apply` to move), and the healed pins commit like any other change.
`maintenance.yml` refreshes the lockfile only (`bun update
--lockfile-only`) and pushes the result through the full quality gate —
dependency drift can never bypass the gates. The runtime-probe lane
is retired; proactive future-Node-major watching is accepted as the
price of carrying no standing push credential.
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
guardians (CodeQL, maintenance) live under the same
ceiling.

**23. Release Verification Without Artifacts.** `release.yml`
validates the tag against `package.json` before anything builds —
the tag must match the manifest exactly (`80.0.0` -> `v80.0.0`).
Source and build archives ship with SHA-512 sidecar checksums
(`sha512sum -c`); pre-release suffixes are flagged pre-release and
never marked latest. There are no binaries to sign because the npm
package is private and BMI Stellar ships as a Vercel-deployed web app
— the README tells that story once.

**24. The Provenance Depth Matrix — attribution that cannot silently
disappear (night-signature-1; night-signature-advanced-2 supersedes
its draft, mirroring the cosmostrix scheme).** The ownership claim is
embedded in `src/lib/utils/signature.ts` as three masked layers, so a
`strings(1)`, `rg`, or custom scan over the tree or the built bundle
finds nothing to strip. **D0**: the full Signature-line manifest
(`BMI Stellar — Official Build by … 2026`) chunked into little-endian
64-bit words and XOR-masked with a splitmix64 stream keyed by a
per-layer seed. **D1**: the Copyright-line authors string, masked the
same way under an independent seed — two independent encodings of the
same identity, so patching one still leaves the other reconstructing
the owner. **D2**: BLAKE3-256 digests over the clear bytes (via the
already-present `@noble/hashes`, cross-checked against the canonical
`b3sum` CLI by the generator), recomputed at runtime — `-V` reports
`status=verified` or `status=tampered` on its `Depth-matrix:` line.
The constants come from `scripts/release/generate-provenance-words.py`
— the committed truth source, which carries the identity in plaintext
by design exactly like TRADEMARK.md, self-checks its round-trip, and
pins the strings(1)-invisibility floor (no printable run of four or
more bytes survives masking). The runtime materializes both layers in
one unmask pass feeding display and digest alike (the single-pass
invariant), plus an identity binding: the authors string must start
with the core extracted from the manifest, so an incoherent
single-layer rebrand flips the status line. Every compiled surface
still prints the plain attribution: the About section renders the
signature row and a live `Depth-matrix:` row beside the license,
`src/app.html` carries the author meta as numeric character references
(rendered plain by every browser), the PWA and package manifests
record the masked authors words as a machine-readable hex field, the
offline shell footer signs itself from the materialized constant, and
`scripts/build.sh -V` runs the real decoder through bun — one
implementation, no shell mirror to drift. Enforcement is fail-closed
and value-blind: `scripts/gates/check-signature.ts` verifies the
runtime fold, recomputes unmask+fold independently, pins both D2
digests against recorded values, checks the binding and the field
parity, pins the invisibility floor mechanically, and probes all seven
surfaces; `signature.test.ts` carries the plaintext oracles (test
files are never bundled — the one legitimate plaintext carrier in the
module) and simulates a patched word to prove the digest binds its
data. The honest limit is written into the module's own header: this
is provenance marking and tamper evidence, not DRM and not resistance
to memory forensics — once materialized, the plaintext lives in
process memory; masking kills the casual grep-and-strip path, not a
determined reader, and stripping still requires editing the gate — a
visible diff — with the AGPL-3.0-only license plus TRADEMARK.md making
the legal cost real.

**25. The At-Rest Ledger Seal — health values encrypted at rest, not just
on export (night-frontier-Z1).** Closes the documented honest limit
("local browser storage is not encrypted at rest") without adding a new
UI surface: the session unlocks through the passphrase moments that
already exist, and every later write to a health key seals transparently
inside `storage.ts`. The engine is `src/lib/utils/at-rest.ts`; the
synchronous state leaf `at-rest-state.ts` carries the seal tag, the
health-key scope (exactly `bmi.history`, `bmi.goal`, `bmi.goal.start`,
pinned by a STORAGE_KEYS drift-guard test), and the mirror sequence
tokens; `crypto-primitives.ts` is the dependency leaf holding the KDF
and checksum surface moved verbatim out of `crypto.ts` (which shrank
below the 600-line ratchet and left the ledger). Semantics, stated
honestly: sealing is session-gated — the Argon2id session key derives
from the ledger passphrase against a per-device random salt
(`__at_rest_salt` in the IndexedDB meta store) and lives in volatile
memory only while unlocked; registration happens in `enableEncryption()`
and in verifier-anchored successful decrypts (`verifyPassphrase()`, and a
bounded five-second fire-and-forget check behind every successful file
decrypt that can never stall the caller — values written before it
completes stay plaintext until their next write). Sealed values are
`bmi-at-rest-v1:` + base64 JSON envelopes with a fresh 12-byte IV per
value, AES-GCM auth tag plus a SHA-256 ciphertext checksum. The cache
holds plaintext while unlocked; the localStorage mirror and IndexedDB
hold envelopes, ordered by the sequence tokens; `createBackup` snapshots
raw via `storageGetRaw`, so a locked ledger backs up sealed, and a
restore re-opens it once unlocked. Locked reads return null, and
`storageSet` refuses to overwrite a sealed value (the purge guard), so a
locked session can never destroy sealed data; `initStorage` skips sealed
values in the corruption-repair path; sealing failure falls back to
plaintext persistence with a dev-only warning. Verification: the
`at-rest-state.test.ts` leaf battery plus the `crypto-at-rest.test.ts`
node-env battery (28 integration tests: round-trips, tamper and corrupt
envelopes, salt persistence, purge guard, mirror ordering, fail-open,
restore round-trips, zero-change canaries), 555 tests green,
`svelte-check` clean. Honest limits: a cold load starts locked — sealed
values read as missing until the passphrase is presented through an
existing flow; re-enabling under a new passphrase locks seals made under
the old one (the same decrypt-first physics as the existing envelope);
coverage is progressive — plaintext values seal on their next write
during an unlocked session, not retroactively; the session key is a
volatile `CryptoKey` handle that is released on lock, not zeroed.
Night-frontier-Z3 sharpening: the session's start moment had been a dead
wire — `enableEncryption()` had no caller in any UI flow, so the
verifier never existed and the seal never activated live (real code,
real tests, unreachable product). The first passphrase-proven import
now establishes the verifier (`establishLedgerVerifier`), the import
path awaits the verifier-anchored unlock (30 s bounded budget) so the
ledger write never races the purge guard, and the production CSP gained
the narrow `wasm-unsafe-eval` token the KDF worker's Rust engine needs —
all three proven live by the P7/P8/P9 claims.
Night-frontier-Z6 sharpening: the session's Argon2id derivation now
yields BOTH keys in one pass (`deriveSessionKeys`) — the AES seal key
and the witness attestation material, an HKDF-SHA256 subkey
domain-separated over the SAME raw output. One 64 MiB burn, two
purposes, no extra cost, tier-stable through the verifier rung, and the
witness key installs (engine keystore first, wipeable-JS fallback) at
every passphrase-proven registration and wipes at every lock.

**26. The Runtime Proof Harness — a measurement, not a promise
(night-frontier-Z1).** The last gap between the static gates and the
truth was runtime behavior: the README said real-device behavior is
covered by the PWA audit and the runtime probe, "not by a device farm".
`scripts/proof/` closes it. A zero-dependency CDP client
(`cdp-client.ts`, Bun's native WebSocket — no automation dependency in
the tree) drives the production build served by `vite preview` inside a
pinned, SHA-verified `chrome-headless-shell`
(`download-chrome.sh` records the ZIP digest at adoption time and
verifies every install fail-closed, because Chrome for Testing ships no
per-build checksum). Sixteen fail-closed claims per run: the exact-value
matrix through the real UI (metric 22.86 / Normal Weight / Prime 0.91 /
BMR 1649 / TDEE 2556, the imperial round-trip 22.85, and the Deurenberg
18.1% card), the runtime egress inventory (every request inside the
disclosed allowlist, exactly one update-check request pair on a fresh
device), the storage inventory (exactly the named keys and stores), the
offline shell contract (the service worker serves the real app with the
network cut), Web Vitals budgets (LCP and CLS measured on the initial
load, before harness interactions can enlarge the LCP candidate), and
zero main-thread long tasks during the Argon2id export derivation (the
window opens after the strength meter's debounced zxcvbn work settles,
so the claim measures the derive/encrypt/deliver path), plus the
night-frontier-Z3 five: the at-rest seal live (the establish import
through the real UI, the verifier created, the write landing sealed),
the purge guard (a locked calculation cannot overwrite the sealed
ledger, raw envelope byte-identical), locked-read semantics (the export
preview reads 0 records while locked, the unlock restores
readability), the continuity witness riding real saves with the head
matching an independent in-page recomputation, and the witness freeze
(a device tamper leaves the witness untouched while the recomputed
chain diverges), plus the night-frontier-Z4 two: the OPFS vault tier
(the vault file exists in the origin's private file system, written
through the sync-access-handle flush worker, and is byte-equivalent to
the latest IndexedDB snapshot — the storage-inventory law moved in the
same commit and now enumerates the OPFS root) and the KDF ladder (the
production envelope carries the device's actual argon2id rung at or
above the OWASP floor). The harness exits non-zero if any claim fails; nothing is reported as proven that
was not measured. It rides its own lane —
`.github/workflows/runtime-proof.yml` on a weekly schedule and on
demand — so the ten-minute CI budget law stays intact for per-push CI.
Night-frontier-Z7 sharpening (B2, the Import Gauntlet, claim P15): the
harness drives N poisoned envelopes through the REAL import UI in the
pinned browser — garbage bytes, a truncated envelope, a flipped
ciphertext byte (AES-GCM auth tag refuses it), a wrong format field,
JSON without records, records that are not an array, invalid record
values, an invalid oversized array, an unknown version marker — every
one through the same file input and modal a user's file takes. The
claim is fail-closed in three directions: zero unhandled errors reach
the page (window.onerror + unhandledrejection taps), zero egress delta
(fetch/XHR taps outside the origin), and the witness head never moves
(no poison is a legit write, so the continuity witness and the ledger
must be byte-identical before and after). The probe sources live in
`page-sources.ts` (the file the claim set uses to keep `run-proof.ts`
under its cap); the header claim list is one line per claim.
Verification: PROVEN 16/16 since night-frontier-Z8 grew the claim set
to P16 (the seal-custody claim — one wasm engine instantiation, the v1
envelope law, the checksum recompute; the page-side probe sources moved
to `scripts/proof/page-sources.ts` to stay under
the 1000-line hard cap as the claim set grew), the measurement records
shipping as CI artifacts. Honest limit: the harness
proves the claims on one pinned browser and one emulated network
profile per run — it is a reproducible measurement, not a device farm.

**27. The Micro-Tier — eviction resistance, strict durability, and key
zeroization (night-frontier-Z2).** Three sharpenings of the ledger's
foundations, each closing a gap the class treats as unfixable. (1)
Eviction resistance: the layout requests `navigator.storage.persist()`
once per session (`storage-persist.ts`, a dependency leaf) and the
result is surfaced through `__bmi_dev.storage()`/`env()` — a denial is
reported honestly and never swallowed, so "the ledger never lies" rests
on an explicit browser grant instead of an assumption about disk
pressure. (2) Strict durability: every IndexedDB write transaction in
`db.ts` opens with `durability: 'strict'` (`DURABLE_WRITE`), the hint
that Chromium relaxed away from the implicit default in Chrome 121 —
per spec the agent "may consider" a commit successful only after the
changes reach persistent storage, so `tx.oncomplete` now lands after an
OS-level flush on honoring engines. The support matrix is written down,
not invented: the option is Baseline 2024 (newly available May 2024
across major engines); engines outside that set may ignore it, and the
hint only costs on commit — readonly transactions stay on the default.
(3) Key zeroization: `importAesKey` is the single ownership point for
raw Argon2id output — the material is copied into a non-extractable
CryptoKey and the caller's array is wiped on return; the worker
transfers its hash buffer (detaches worker-side), and the PBKDF2 path
never exposes material in JavaScript at all. The compare-path audit
found both integrity compares already constant-time (the ciphertext
checksum via a XOR loop, the export signature via `crypto.subtle.verify`)
and pinned them. Verification: the `db-durability.test.ts`,
`storage-persist.test.ts`, and `crypto-zeroization.test.ts` batteries
(19 tests — hint propagation to all five write transactions, grant /
denial / failure / unsupported / idempotence paths, the wipe contract,
cross-derivation interoperability), full battery 574 green,
`svelte-check` clean. Honest limits: persistence is a request, not a
guarantee — installed PWAs and engaged origins are auto-granted, others
may be denied (surfaced, never hidden); strict durability trades commit
latency for crash resilience and is a hint, not a guarantee; JavaScript
passphrase strings cannot be wiped (WebCrypto never sees them raw
because the derivation input passes through the worker boundary —
documented physics, not solved).
Night-frontier-Z6 sharpening: the zeroization story gains a PROVABLE
seat. The witness attestation key (innovation 29's keyed law) installs
through one of two custody paths: the wasm engine's keystore (the
engine volatile-zeroizes its slot on lock and SELF-REPORTS all-zero
from inside the sandbox — an invariant a test can hold the artifact to,
impossible for any dropped-reference JS object) or the wipeable-JS-array
fallback (whose zeroization is proven through the surviving MAC
closure: after the wipe it computes exactly what a zero-key HMAC
computes). The one honest limit Z6 leaves standing: the AES session
key stays a volatile non-extractable CryptoKey handle released to GC on
lock — no WebCrypto API exists to zero it. That exact limit is what
night-frontier-Z8 retires.
Night-frontier-Z8 sharpening: the seal key JOINS the custody arc. The
at-rest session seat becomes a two-kind union in `at-rest-state.ts`: an
opaque AES-256-GCM slot inside the wasm engine (`seal-key.ts` — the
raw session material installs once, every seal and open is an in-engine
GCM operation, and the lock wipe is the engine's own volatile
zeroization with the self-reported all-zero proof, checked on every
lock and pinned by the `seal-key.test.ts` battery) or the documented
WebCrypto fallback (importAesKey, released to GC — the physics Z6
documented). The single-ownership law moves with it:
`deriveSessionKeys` returns the raw material UNCONSUMED and the install
consumes it exactly once on every path (the engine zeroizes its stage
copy; importAesKey wipes the fallback). The sealed format does not
move: `bmi-at-rest-v1` keeps its shape (version 1, 12-byte IV, AES-GCM
tag inside the data, the SHA-256 ciphertext checksum), both sides
implement the standard GCM, and the batteries pin byte-identity in BOTH
directions plus the full-keystore degrade. Honest limits, in the same
breath: wasm linear memory stays readable from the host by design (the
same boundary the witness key documents — custody means the wrapper
never handles the key per-operation and the zeroization is
deterministic and provable); the WebCrypto fallback keeps the old
physics; and a full keystore degrades honestly to the fallback seat
instead of handing out a seat that cannot work.

**28. The Rust Key Forge Engine — one honest wasm seat, proven byte-level
(night-enhance-1).** The one real compute hotspot in the tree was the
Argon2id derivation itself; the calculator path is a single guarded
division with nothing to profile. So the engine swap was scoped to
exactly one seat: `engine/argon2id` (the only Rust crate in the tree)
implements standard Argon2id (RFC 9106, version 0x13) through the
RustCrypto `argon2` crate behind a plain C ABI
(`engine_alloc` / `engine_free` / `engine_argon2id` with optional
secret and associated-data regions, error codes, no wasm-bindgen
runtime), compiles to `wasm32-unknown-unknown` with simd128
(37,721 bytes), and ships embedded as base64 in the generated
`src/lib/utils/kdf-wasm-embedded.ts` — the worker stays inline, offline,
and fetch-free. The wrapper (`kdf-wasm-engine.ts`) is fail-closed in
both directions: the artifact is refused unless its SHA-256 matches the
recorded digest, and every engine refusal falls back to the pure-JS
engine — availability never trumps correctness, and a hostile input can
only lose the speedup, never produce a wrong key. Byte-identity is
proven, not claimed: the RFC 9106 section 5.3 known-answer vector
reproduces byte-for-byte in both engines, a deterministic 30-vector
cross-check matrix (passphrases incl. empty and unicode, salt lengths,
parameter combinations, output lengths) must agree byte-for-byte, one
test anchors the real 64 MiB / t=3 / p=1 production parameters, error
parity is pinned (what one engine rejects, both reject), and envelope
interop proves a wasm-derived key decrypts what the JS engine encrypted
and the reverse (`kdf-wasm-engine.test.ts`, `kdf.worker.test.ts`).
Provenance is a lane, not a hope: the build is byte-reproducible
(toolchain pinned in `rust-toolchain.toml`, absolute paths remapped to
constant virtual paths through RUSTFLAGS — verified by rebuilding at
two different machine paths), and the `wasm-provenance` CI job rebuilds
from the committed crate and demands fresh-build == recorded digest ==
embedded bytes on every push (`scripts/ci/wasm-provenance.sh`). The
measured speedup on the bench machine is 11.3x at production parameters
(2472 ms -> 219 ms, `scripts/dev/kdf-bench.ts`, interleaved rounds,
byte-identity gated before timing; one machine, re-measurable any
time). Honest limits: the bundle now carries both engines — the
embedded base64 adds roughly 50 KB raw before the inline-worker
encoding; the wasm-side zeroization of the passphrase and secret
regions is hygiene, not a security boundary; the app never uses the
secret/associated-data ABI inputs (they exist so the KAT exercises the
full core); and the JS engine stays loadable by design, so the fallback
path remains a working, byte-identical route.
Night-frontier-Z6 sharpening: the maintenance lane grows around the
artifact — the weekly dependency sweep
(`scripts/ci/sweep-rust-workspaces.sh`, the zelynic Dragon Guard port)
updates every committed Cargo workspace, proves the moved lane with
cargo fmt `--check` and clippy `-D warnings`, and refuses to ship
without the wasm parity gate (a dependency bump that changes the built
bytes fails loudly; the embedded artifact's one writer stays the
owner's deliberate `--refresh` flow). The toolchain version lives in
three synced surfaces (`rust-toolchain.toml` channel, the Cargo.toml
`rust-version` MSRV, the maintenance workflow's `RUST_VERSION`) tied by
`scripts/gates/check-rust-version-sync.sh` in gate-keepers section 13,
and cargo-audit scans the engine lockfile weekly (pinned scanner,
`--deny warnings`, observation-only). The night-supply-1 hardening
closes the arrayref incident class: the direct dependency is
exact-pinned (`=0.6.0` — a semver-compatible republish can never
resolve), `deny.toml` denies git sources, unknown registries, duplicate
versions, and yanked crates, the cargo-deny scanner installs through a
committed digest (computed once, double-checked against upstream,
verified on every run), the wasm artifact carries a 45,000-byte ceiling
so injected code cannot drift past the refresh flow silently, and the
JavaScript manifest, lockfile checksums, and CI fetch paths sit under
the same posture through `scripts/gates/check-supply-chain.ts` — which
caught and closed the one real unpinned-fetch hole the tree had on its
first run.
Night-frontier-Z6 sharpening — the keystore seat: the engine is no
longer only a key forge, it is also KEY CUSTODY. The witness
attestation key (innovation 29's keyed law) installs into fixed slots
inside the engine's linear memory and never travels back through the
ABI as raw bytes: every later use is an in-engine HMAC-SHA256
(`hmac` + `sha2`, the RustCrypto pair, exact-pinned, byte-identical to
the noble fallback), the lock wipe is the engine's own
volatile-zeroization, and the slot SELF-REPORTS all-zero
(`engine_keystore_is_zeroed`) — the invariant is provable, not
conventional. Handles are opaque tokens (slot + install generation), so
a stale closure from a replaced key can never reach the re-armed slot:
use after wipe and use after rotation are ABI refusals, not zero-key
computations. The honest boundary is written in the crate's own header:
wasm linear memory stays readable from the host by design, so custody
means the wrapper never handles the key per-operation and the
zeroization is deterministic and provable — not resistance to a
host-level reader. The artifact grew 37.7 KB -> 48.983 KB, and the
provenance ceiling moved with it as a deliberate, reviewable edit
(WASM_MAX_BYTES 45000 -> 50000, the growth documented in the diff —
the digest gate and the thin remaining headroom keep the tripwire
live); `cargo fmt --check` + `clippy -D warnings` + the
`wasm-provenance` three-way digest chain (fresh build == recorded ==
embedded) all pin the new bytes.
Night-frontier-Z8 sharpening — the seal seat: the keystore becomes a
TWO-KIND custody. New AES-256-GCM slots hold the at-rest session seal
key (innovation 27's Z8 law): `engine_seal_put` /
`engine_seal_seal` / `engine_seal_open` implement the standard GCM
construction (RustCrypto `aes-gcm`, exact-pinned `=0.10.3`, no_std, no
allocator and no RNG — the detached in-place APIs only) in the WebCrypto
layout (ciphertext ++ 16-byte tag), with the nonce pinned to 12 bytes,
the plaintext region zeroized on seal, and the output region zeroized
before an auth-failure refusal (`ERR_AUTH`, error code 5 — a failed
open never leaves readable garbage). The seat kinds are fail-closed
against each other: an HMAC slot refuses every seal call and a GCM slot
refuses every hmac call, so the witness key can never be an AES key and
the seal key can never sign. ABI version 1 -> 2, and the wrapper
refuses any other version before instantiation. The seal battery pins
the NIST GCM test case 13 vector through the real ABI, a WebCrypto
parity matrix across a generation boundary, bidirectional envelope
interop, failure parity on flipped bits, and the provable wipe. The
battery also caught a latent Z6 bug, fixed in the same change: a
keystore refusal returned `ERR_KEYSLOT` as the put's return value, and
4 collides with a valid gen-0 handle shape — both puts now honor their
own documented contract (0 on every refusal, mirroring `engine_alloc`),
pinned by an engine-level regression test. The artifact grew
48.983 KB -> 67.447 KB (software AES rounds plus the GHASH multiply;
the profile stays opt-level 3 because the benched Argon2id speedup is
not traded for size), and the provenance ceiling moved with it as a
deliberate, reviewable edit (WASM_MAX_BYTES 50000 -> 72000, the growth
documented in the diff, the headroom deliberately thin).

**29. The Ledger Continuity Chain — the sequence itself becomes
tamper-evident (night-frontier-Z3).** The physics gap: AES-GCM protects
per-value and the HMAC signature protects per-file, but nothing
protected the _sequence_ — a party with device access could truncate,
reorder, or rewrite the history and the absence would be invisible to
per-object AEAD. "The ledger never lies" was asserted; now it is
provable. `src/lib/utils/ledger-continuity.ts` (a dependency leaf)
builds a SHA-256 hash chain over the validated records in canonical
form (fixed key order, ascending stable order) and seals the chain head
as the witness `{ head, length }` in the IndexedDB meta store
(`__history_chain_head`, the `__at_rest_salt` precedent). The witness
advances only through legit writes — save, import, clear — and a save
that observes a pre-state which does not match the witness FREEZES it
instead of re-sealing: the evidence survives, and the ledger refuses to
bless what it did not verify. The export envelope moves to v4: the
chain head rides inside the HMAC payload and the import cross-checks
that it recomputes from the records it anchors, so the user's own
encrypted backup is the external witness — zero cloud witness, the
anchor lives in the user's hand. Backups carry the witness (a restore
re-installs it; a pre-Z3 snapshot tombstones it to honestly unanchored
instead of falsely accusing). The audit reads four states — ok /
violated / unanchored / sealed-opaque (a locked sealed ledger is not
misread as tampered). Verification: the `ledger-continuity.test.ts`
battery (chain math against an independent reference implementation, a
160-case two-directional tamper property battery — truncate front and
back and middle, adjacent swap, reorder, field edit, replay, foreign
insertion — witness semantics, audit states, the save-path freeze, the
backup witness travel) and the `history-io-continuity.test.ts` battery
(v4 anchor recomputation, six-class v4 tamper rejection, the
establish-on-import integration, verifier protection against
later-file passphrases, the v0/v1/v2 legacy ladder), plus the live P10
and P11 claims. Honest limits, stated in the same breath: a party who
can rewrite both the history and the meta store can re-seal — absence
of an external witness cannot be fixed on device, and the v4 export is
the witness for exactly that attacker; a pure reordering of
distinct-timestamp records is a logical no-op (every read sorts
ascending) and is not treated as tampering, while equal-timestamp swaps
stay visible through the stable sort; a failed seal degrades the
witness to unanchored (never a stale false accusation); the audit
result surfaces through the harness claims and the test batteries — a
user-facing continuity banner is the named next step.
Night-frontier-Z5 sharpening: the seal queue was per-realm, so two
tabs could interleave legit writes and freeze the witness against
honest use. Every legit write now holds the origin-wide ledger lock
(innovation 32) through the reseat/seal drain — the lock release and
the witness advance are one ordered step cross-tab — and the freeze
rule stands untouched for out-of-band writers (proven by the
two-realm tamper battery).
Night-frontier-Z6 sharpening — the keyed witness law: the honest limit
above was the last sentence standing between the ledger and a
compromised-device attacker. For a passphrase-protected ledger the
witness now seals as a KEYED chain: every record link runs under the
witness attestation key (`witness-key.ts`, an HKDF-SHA256 subkey over
the SAME raw Argon2id session output the at-rest seal derives — one
derivation, two purposes, no extra 64 MiB burn, tier-stable through the
verifier rung, rotating exactly when the passphrase does). The reseat
path recomputes the pre-state under the SEALED witness's mode, verifies
the public fingerprint binds the witness to the installed key, and a
keyed witness whose key is unavailable (locked edge, passphrase
rotation) steps aside to honestly unanchored — it can neither bless nor
accuse, and the audit gained the fifth state `witness-opaque` for
exactly that case. The re-seal sentence upgrades: rewriting both the
history and the meta store can re-seal only a PLAINTEXT ledger's
witness, because the next keyed link requires the key and the key
requires the passphrase. The export anchor stays plain on purpose —
portable, keyless, recomputable from the file alone on any device
forever. The keyed chain is proven against an independent WebCrypto
HMAC reference, the eight-class tamper battery reruns under the key
(every tamper still flips the head, every logical no-op still does
not), and the batteries pin the rotation tombstone, the plain-to-keyed
upgrade, the empty-ledger genesis invariance across modes, and the
attacker's plain recomputation never matching a keyed head. The keystone
test proves the zeroization invariant the JS path CAN prove: after the
wipe, the surviving MAC closure computes exactly what a zero-key HMAC
computes — a proof no dropped-reference JS object offers.
Night-frontier-Z9 sharpening — the rotation re-seal: the rotation
tombstone the batteries pinned was honest, but the SOURCE showed a
deeper cost. enableEncryption() cleared the session FIRST, so the
witness tombstoned only at the NEXT legit save — the window between
the rotation and that save was the one moment tampering could happen
unobserved (no installed key could verify anything) — and every value
sealed under the old key became permanent-opaque under the new one:
the rotation lockout. The deeper route runs when the rotation happens
in an ALREADY-UNLOCKED session, where the old key does not need to die
blind: `ledger-rotation.ts` holds ONE ledger-lock section that (1)
verifies the current ledger one last time UNDER THE OLD KEY (the
`witnessRotationVerdict` law — the reseat rules applied verbatim,
mode-aware, the Z7 vault veto included), (2) captures the plaintext of
every health key the unlocked refresh already opened, (3) swaps the
seats, (4) re-seals the captured values under the NEW seat (ordinary
storageSet: fresh IV per value), and (5) re-anchors the witness under
the NEW key. No blind window, no lockout — the first post-rotation
save rides a verified, keyed witness. A `frozen` verdict (old head
mismatch, unattestable old witness, or the vault veto) NEVER
re-anchors: the freeze rule is untouched and the witness stays as
evidence — while the values STILL re-seal, because persistence is not
blessing and the user keeps access to their own data (the audit reads
that state witness-opaque, never violated). A rotation while LOCKED
keeps the honest route byte-identical: the tombstone stays what a
rotation that cannot verify anything deserves. The battery pins all
four: no lockout, the in-section re-anchor, the freeze with values
re-sealed, and the locked route.
Night-frontier-Z6 sharpening (the chain checkpoint law): the hunting
finding under the chain was physics, not semantics — every link waited
on one `crypto.subtle.digest` round-trip, twice per save, so a ledger at
the LTS horizon paid thousands of awaited round-trips per legit write.
The chain math moved to `ledger-chain.ts`: fully synchronous (noble
SHA-256 and the keyed HMAC in a tight loop, zero async round-trips,
byte-identical construction) with a SOUND checkpoint cache — per
(mode, key fingerprint) the engine remembers verification digests and
stride-stride chain links, re-verifies EVERY record's digest on every
compute, and rechaining starts only from the proven divergence point.
The cache can never bless records it has not re-verified: a middle
edit, a truncation, a replay, or ANY change diverges the prefix and the
head is recomputed from the actual records — soundness is why the cache
deduplicates work instead of skipping it. Measured on the bench
machine (`scripts/dev/chain-bench.ts`, interleaved rounds, byte-identity
gated before timing, 2000 records): the plain chain 53.1 ms legacy vs
18.7 ms sync-cold (2.8x) vs 4.6 ms warm (11.6x), appends 10x per save;
the keyed chain's warm path runs 4.5x (3x per save), while its cold
path honestly pays ~13% for the verification pass — the price of never
trusting the cache blindly. Correctness never depends on the cache:
two realms hold two caches and must agree (the two-realm battery), and
the chain battery proves warm heads equal cold heads equal an
independent reference across every tamper class, append sequence, and
stride boundary.
Night-frontier-Z7 sharpening (the tri-home witness): the freeze rule's
one escape hatch was deleting the witness itself — rewrite the history
at the same record length, tombstone the meta entry, and the next legit
save saw no witness and re-anchored over the rewritten records. The
OPFS vault (innovation 30) already carries the witness inside the
flush-mirrored backup snapshot; Z7 makes that copy CONSUMED: before any
unanchored re-anchor, the reseat path consults the vault witness
(ledger-vault-anchor.ts, mode-aware through the same attestation-key
law). A same-length disagreement vetoes the re-anchor — blessing would
destroy the vault's evidence, and recovery stays the documented one
(import your own v4 backup or clear the ledger). A stale copy
(different length) is silence, never evidence: the ledger may have
legitimately grown since the backup. A keyed vault witness compares
only under its own attestation key, else 'unknown' — neither bless nor
accuse. The audit surfaces the second home's verdict as vaultEvidence
on the unanchored path, so the tombstone-escape signature (unanchored +
disagreeing vault) is visible to the surface and the harness, and the
witness parse + reseat + audit batteries prove the veto, the proven
re-anchor, the staleness silence, and the fail-closed parse rules
against the REAL vault-backup parse path (the OPFS platform boundary is
stubbed, nothing else). Honest limit, named: a same-length disagreement
cannot by itself separate tamper from the rare honest edge (a
seal-failure tombstone plus an in-place edit between backup and save) —
the freeze preserves the evidence and the user re-anchors deliberately,
exactly like the Z3 rule it extends.
Night-frontier-Z9 sharpening — typed tombstones: that honest edge was
invisible because a seal failure and a deliberate wipe both wrote the
empty string — "I failed to witness" read identically to "I am not
here". A seal failure now writes the typed marker
(`SEAL_FAILED_WITNESS`, `{"t":"seal-failed"}`) while a deliberate
tombstone stays the empty string, and the difference is nameable: the
continuity audit carries `sealDegraded` next to its `unanchored` state
(a stable field, false whenever a live witness exists), and the
vault-veto warning says which state it is looking at when a
same-length disagreement freezes the re-anchor — a degraded seal plus
a changed ledger is exactly the suspicious edge, now said in plain
words. Fail-closed by construction: the marker carries no head and no
length, so every witness consumer reads it as NO WITNESS (unanchored,
never violated) — pre-Z9 data and unknown shapes keep the exact same
behavior, compat is free, and the marker never blocks recovery (the
next legit save re-anchors through it, the vault consult still
guarding).

**30. The OPFS flush() Vault Tier — a second durable home with a real
fsync (night-frontier-Z4).** `durability: 'strict'` on IndexedDB
commits is a hint the user agent may ignore — Chrome 121 quietly
relaxed the implicit default — while
`FileSystemSyncAccessHandle.flush()` is the fsync-shaped primitive the
platform actually offers: it blocks until the bytes reach the storage
backend. `vault-opfs.ts` holds the primitive (truncate, write, FLUSH,
close — the ordering is structural and testable against a handle spy),
`vault.worker.ts` is the worker shim (the sync handle is
worker-only), and `vault-backup.ts` mirrors every rolling snapshot
into the origin's private file system — single-flight, fire-and-forget,
never failing the backup that produced it. The vault holds exactly the
latest snapshot as the fallback home: when the IndexedDB rotation is
empty or unreadable, the restore path falls back to the flushed copy
(allowlist still enforced). The storage-inventory law moved in the same
commit: the P3 runtime claim now enumerates the OPFS root
(`vault-backup.json` and nothing else) beside the localStorage keys
and the IndexedDB stores. Verification: the `vault-opfs.test.ts`
battery (flush ordering, byte counts incl. multibyte UTF-8,
close-on-failure, overwrite after truncate, honest nulls, the
no-worker degrade) and the `backup-vault.test.ts` integration battery
(exact-byte mirroring, fire-and-forget, the vault fallback restore
with the witness, the allowlist), plus the live P3 and P12 claims.
Honest limits: sync access handles are Chromium-only — engines without
them degrade to the IndexedDB-only vault, reported honestly by the
status; the vault holds the latest snapshot, not a rotation; flush()
proving end-to-end fsync semantics is beyond what software can
observe — what is proven is that the call returned and the bytes read
back byte-identical.

**31. The Device-Tier Argon2id Ladder — adaptive cost, fixed floor
(night-frontier-Z4).** One fixed derivation cost taxes the extremes:
64 MiB / 3 iterations is seconds of burn on a low-end phone and
milliseconds on a desktop. `kdf-ladder.ts` scales the rung from the
capability engine that already exists (getPerformanceTier:
hardwareConcurrency + deviceMemory + connection): high 64 MiB / t3,
medium 32 MiB / t3, low 19 MiB / t2 — with the OWASP Argon2id floor
(m ≥ 19456 KiB, t ≥ 2, p ≥ 1) clamped under every rung, and read-side
caps (256 MiB / t8 / p4, the night-depth-hardening-5 burn ceiling —
see 33) that refuse absurd parameters fail-closed.
The discovery that makes tier variance safe: the envelope's
`kdfParams` field had always been RECORDED but never USED — decrypt
derived with the bundle's fixed options, making the recorded rung
decoration. Night-frontier-Z4 makes decrypt HONOR the envelope's
parameters (the writer's rung — the cross-device contract: a vault
sealed at any rung opens on any device), and the at-rest session
anchors its derivation on the stored verifier's recorded rung, so a
tier change between sessions never re-derives a different key from
the sealed ledger. Verification: the `kdf-ladder.test.ts` battery
(the floor under every tier, the exact rung mapping, cross-rung
decrypts in both directions, the legacy no-parameters contract via
the fixed legacy defaults, eleven tampered-parameter refusals, the
identity probe, the tier-stability integration), plus the live P13
claim (the production envelope's rung at or above the floor, pinned
to a real ladder value). Honest limits: the tier is a heuristic
(self-reported hardware signals); below-floor parameters can still be
READ within the caps — the floor governs what this app produces, not
what it refuses to open, because the passphrase is the gate;
test-mode parameters stay CI-friendly and below the floor by design,
excluded from every production path; prior art exists in password
managers — the novelty here is the envelope-driven cross-device
contract and the verifier-anchored session stability.

**32. The Single-Writer Law — the origin-wide ledger lock
(night-frontier-Z5).** The physics gap: every serialization primitive
the ledger had — the per-key IndexedDB write queue (innovation 1), the
witness seal queue (innovation 29) — lives inside one JavaScript realm,
while two tabs of the same app are two realms racing on the same origin
storage. A stale cross-tab read-modify-write could silently drop a
foreign record (the union became the last writer's view) and leave the
continuity witness frozen as a false accusation: the ledger lied about
honest use, the exact failure the freeze rule exists to prevent,
triggered by no attacker at all. The Web Locks API is the browser's
own origin-scoped mutex; `src/lib/utils/ledger-lock.ts` holds
`bmi-ledger-write` in exclusive mode across every legit ledger write
critical section — save, the import commit (`commitImportedRecords`,
delegated from history-io through a dynamic import so the dependency
arrow stays one-way), backup restore, and clear — each section ordered
as freshness refresh, validated read, merge, mirror write, and the
witness reseat/seal drain, so the lock release and the witness advance
are one ordered step cross-tab. Two doors close the stale-cache gap
beside it (`src/lib/utils/storage-coherence.ts`): foreign-tab storage
events drop health-key cache entries (`installForeignTabCoherence`,
wired in the page beside the unit-system listener it never touches),
and `refreshHealthKeysFromMirror()` is the deterministic door every
locked section calls first — sealed mirrors re-open into an unlocked
realm's cache; locked realms keep locked-read semantics. Clear also
drops the same-realm cache entry, fixing a pre-Z5 false-freeze of its
own: a cleared ledger read as stale records in the realm that cleared
it, so the next legit save merged over a stale pre-state and froze the
genesis witness. Threat model, stated honestly: the lock is advisory —
an out-of-band writer bypasses it and remains exactly the business of
the freeze rule, which the law must never weaken (proven, not assumed:
the two-realm tamper test freezes the witness while every legit write
holds the lock). Engines without `navigator.locks` degrade to a
per-realm promise queue reported once per realm — pre-Z5 behavior, not
an invention. Verification: the `ledger-lock.test.ts` battery (pinned
name, exclusive mode, request-order serialization, reentrancy without
deadlock, honest fallback, failure hygiene — a rejecting section
propagates and releases), the `storage-coherence.test.ts` battery
(foreign invalidation, presentation-key scope, null-key clear,
sealed-stays-sealed, deterministic refresh, unsubscribe), and the
`ledger-single-writer.test.ts` two-realm battery — two module graphs
as two tabs over shared origin storage and one shared exclusive
manager: the Z5 race ends with the union intact and the audit ok,
overlapping saves serialize, the freeze still fires lock-free, and a
cross-tab clear blesses the follow-up save instead of freezing it.
Honest limits: the Web Locks API is Baseline widely available
(Chrome 69+, Firefox 96+, Safari 15.4+), but it is a request, not a
guarantee — the fallback lane is real on engines without it, and the
lock orders legit writers only; the save's ledger write now completes
asynchronously under the lock (the synchronous signature return keeps
the caller's dedupe contract unchanged — the record lands one lock-wait
later, invisible outside a contended tab).

**33. The Burn Bounds (night-depth-hardening-5).** Endurance is a
security surface: two attacker-controlled inputs could degrade the app
forever without ever "failing" once. The envelope KDF read-side caps
tightened from 1 GiB / t 64 / p 8 to 256 MiB / t 8 / p 4 — the old
ceiling let one hostile encrypted-backup file burn the KDF worker to an
OOM per passphrase attempt, while the highest rung the app itself ever
writes is 64 MiB / t 3 / p 1, so the caps hold a 4x headroom and bound
the burn to seconds (`kdf-ladder.ts`, pinned by an explicit battery
assertion). The import record cap (`MAX_IMPORT_RECORDS = 10,000`,
`history-io.ts`) refuses before any integrity work, because the
ledger's save floor is O(N) sync hashes and one uncapped hostile file
was a durable per-save tax; 10,000 records is roughly 27 years of
daily entries. In the same pass the duplicated import pre-guard merged
into `importPlaintextOrFail` (a corrupted encrypted payload now answers
`corrupted_file` on the validate path too), one `bytesToHex` leaf
replaced seven hand-rolled copies, the deterministic surfaces were
verified at peak (pure IEEE arithmetic in the metrics core, no
iteration-order dependence in the engine, the artifact digest pinned by
construction), and the deterministic tiebreak for same-millisecond
records was considered and rejected: re-ordering an existing hash chain
false-positives the witness on upgrade for affected ledgers — the
migration cost exceeds the edge. Verification: `history-io-caps.test.ts`
(the cap refuses before integrity, the i18n mapping holds),
`kdf-ladder.test.ts` (the caps pin + the tampered-parameter matrix),
and the depth audit rides as `docs/AUDIT-DEPTH-2026-11.md`.

## The never-be charter

The innovation ledger above could grow forever unless something bounds
it — so the boundary is written down as a contract in
[README.md](../README.md) under `### never-be`: bmi will never be a
daemon, never sound, never a game, never an account, never a server,
never a data collector, never a medical device, never cloud inference,
never an app-store binary, never ads, and never a holder of an
unverifiable dependency.

The charter is not aspiration; every line is the product-identity side
of an invariant the code already enforces on the technical side.
Local-first and zero-knowledge are why there is no server, no account,
and no collector — the ledger's durable homes are on the device
(innovation 30) and sealed at rest. The byte-identical dual-engine rule
(innovation 28) is why there is no cloud inference: computation stays
local and inspectable. The offline static PWA shape, enforced by the
offline-shell gate, is why there is no daemon and no app-store binary.
The supply-chain policy (night-supply-1) is why no unverifiable
dependency rides in. And dormancy discipline is why there is no sound
and no game: the cheapest way to keep a tool maintainable while
dormant is to refuse the features that make software loud.

The gates enforce the technical subset; the charter covers the product
subset. Changing the charter is a product-identity decision — the
heaviest kind of change this repository admits — and a proposal that
crosses a line is not a feature request; it is a different product.

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
