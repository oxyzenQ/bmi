<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# BMI Stellar — Security & Provenance Consolidated Audit (November 2026)

**Consolidation date:** 2026-11-28
**Consolidates:** the privacy audit (2026-11-03), the security legs of the
depth hardening audit (2026-11-19), and the D3 publisher binding + release
channel audit (2026-11-23) — previously `docs/AUDIT-PRIVACY-2026-11.md`,
`docs/AUDIT-D3-2026-11.md`, and the security sections of
`docs/AUDIT-DEPTH-2026-11.md`.
**Rule of the consolidation:** every fact, commit anchor, and skip keeps its
original date and wording-level meaning — nothing was re-audited here, only
gathered, deduplicated, and cross-linked. The originals remain retrievable
verbatim from git history at or before the consolidation commit.

---

## 1. Privacy claims versus source (2026-11-03)

Scope of that pass: every privacy claim in the README tagline, the
"What makes bmi sharp" table, the "Limitations (honest)" section, and
SECURITY.md — verified against the actual source at that commit, not
against prior audit reports. Method: full-source scans for network
primitives (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`,
`EventSource`), server-endpoint enumeration, dependency inventory, and
line-level reads of the crypto, storage, backup, history-io,
service-worker, layout, and hook layers.

### 1.1 No server-side processing of health data — physically impossible

- The routes tree contains **zero `+server.ts` endpoints and zero form
  actions**; the SvelteKit server exists only to serve assets and set
  headers (`src/hooks.server.ts`). There is no server path that could
  receive a health value even if the client tried to send one.
- The only server-side logic is the security-header pipeline
  (`src/hooks.server.ts:6-151`) and cache-control — no request body is
  ever read, nothing is logged, nothing is forwarded.

### 1.2 The outbound call census — three call sites, all disclosed

An exhaustive scan of `src/` for network primitives finds exactly three
call sites:

| Call site                                                                         | Destination                                                        | Payload                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| `src/service-worker.ts:33,200,227`                                                | Same-origin only (cross-origin ignored at line 192)                | Asset caching                     |
| `src/lib/stores/pwa-update.ts:233-236`                                            | `raw.githubusercontent.com` + `api.github.com` (URLs at lines 8-9) | Bodyless unauthenticated GETs     |
| Vercel Analytics + Speed Insights injection (`src/routes/+layout.svelte:134-146`) | `vitals.vercel-insights.com`                                       | Page views / Web Vitals — see 1.3 |

The production CSP `connect-src` allowlist (`src/hooks.server.ts:63`)
matches this exactly: `'self' https://raw.githubusercontent.com
https://api.github.com https://vitals.vercel-insights.com`. No other
endpoint can be contacted even by injected code. Dev-mode CSP
(`hooks.server.ts:45`) is looser and never ships to production
(`hooks.server.ts:74-84` deletes all CSP headers in dev).

### 1.3 Analytics receives no health values — the data-flow proof

- Injection is double-gated: `import.meta.env.PROD &&
__IS_VERCEL_DEPLOYMENT__` (`+layout.svelte:134`; the define is built
  from `process.env.VERCEL === '1'` in `vite.config.ts:99-102`).
  Self-hosted and dev builds never load the SDKs.
- The calls are `injectAnalytics({ mode: 'production' })` and
  `injectSpeedInsights()` with **no data arguments**; a repo-wide scan
  finds **no `track()` calls** (the only `track` matches are Svelte's
  `untrack` reactivity helper). With no custom events, the SDKs'
  page-view/vitals collection has no app-supplied channel for BMI, TDEE,
  or body-fat values.
- Form-submission trace: `BmiForm` → calculator → `saveBmiToHistory` →
  `history-io.ts` → `storage.ts` → memory cache + `localStorage` +
  IndexedDB (`src/lib/utils/storage.ts:22-30,409-434`) and the local
  rolling backup (`src/lib/utils/backup.ts:55-80`, last 3 snapshots in
  IndexedDB). Every module in the chain is local; none imports `fetch`
  or any transport.

### 1.4 Storage and backup never leave the browser origin

- The fallback chain (memory → `localStorage` → IndexedDB) is implemented
  entirely in `src/lib/utils/storage.ts` and `src/lib/utils/db.ts`;
  `db.ts` contains no network primitives. IndexedDB and localStorage are
  origin-scoped browser APIs — there is no code path to anything else.
- **No hidden sync exists**: no sync/restore-from-remote code anywhere;
  clearing site data clears the ledger, exactly as the README states.
- The service worker caches same-origin assets only, ignores non-GET and
  cross-origin requests (`src/service-worker.ts:189,192`), and checks
  message origin before `SKIP_WAITING` (lines 113-122).

### 1.5 Passphrase handling matches SECURITY.md

- The passphrase is never stored: only an AES-GCM verifier ciphertext of
  a known plaintext (`BMI_STELLAR_VERIFIER_V1`) lands in IndexedDB
  (`crypto.ts:536-554`); `verifyPassphrase` decrypts it (lines 604-624).
  Wrong passphrase → auth-tag mismatch → false.
- UI hygiene: `autocomplete="new-password"` plus a honeypot username
  field keeps browsers/password managers from caching it
  (`PasswordFields.svelte:51,61,94`); the modal state is cleared on close
  and after operations (`EncryptionModal.svelte:66,145,277`).
- Production logging cannot leak it: `warnDev` is compiled out in
  production (`src/lib/utils/warn-dev.ts:30-32`), the structured logger
  is only called with trace IDs and error contexts, the DebugPanel is
  dev-only (`+layout.svelte:115-125`), and no direct `console.log` of
  values exists outside dev-only modules.
- Fonts, i18n dictionaries, and the zxcvbn dictionary are bundled
  locally (`@fontsource-*`, `src/lib/i18n/locales/*`); `app.html`
  references only same-origin assets — no CDN, no third-party script tag.

### 1.6 The one under-disclosed claim, fixed in that pass (2026-11-03)

The README disclosed Vercel telemetry but not the automatic update check:
`checkForPwaUpdate('auto')` fired ~3 s after every production mount
(`+layout.svelte:183-185`) and sent two bodyless unauthenticated GETs to
public GitHub URLs (`pwa-update.ts:8-9,233-236`). No cookies (default
`credentials: 'same-origin'`), no payload, no health data — but GitHub
saw IP, user agent, and timing, and the unauthenticated api.github.com
pool (60 req/hour per IP) burns out fast on shared egress.

Fix landed in the same pass: the timer-driven check now runs at most once
every 12 hours per device (`shouldRunAutoUpdateCheck` +
`bmi.updateCheckAt` in localStorage; a failed or offline attempt is not
recorded, so the next load retries instead of blinding the check). Manual
checks in About and service-worker-driven confirmations never throttle.
Proven live at the CDP level: seeded key, delta 0 requests across a
reload; cleared key, delta exactly one request pair. The README
Limitations line and the SECURITY.md Privacy Boundary state the throttled
behavior. The tagline's "no cloud profile" claim remains true: an
IP-visible update ping is not a profile, and no health byte participates.

Verdict of that pass on the remaining claim classes: "Encrypted backups"
is an optional layer and the docs say so (honest once read past the
tagline); passphrases are JS strings and cannot be zeroed in memory —
an inherent platform boundary the docs never overclaim; **no false or
dangerous claim found** — no telemetry of health values, no hidden sync,
no server-side processing, no stubbed privacy feature, no crypto
misrepresentation.

## 2. The crypto stack, verified line by line

### 2.1 At-rest encryption exactly as documented (2026-11-03)

- **AES-256-GCM via native WebCrypto**: `crypto.subtle.encrypt/decrypt`
  (`src/lib/utils/crypto.ts:396-401,482-488`).
- **IV**: 12 bytes (`IV_LENGTH`, line 38) from `crypto.getRandomValues`
  (lines 187-191), generated fresh per encryption (line 373). 16-byte
  random salt (line 37).
- **Keys are non-extractable**: `importKey(..., false, ...)` (line 133) —
  key material cannot be read back out of the CryptoKey.
- **Argon2id is the real Argon2id**: `@noble/hashes/argon2.js` — pure
  JavaScript, no WASM wrapper (line 130). Production parameters are
  exactly `m: 64*1024` KiB (64 MiB), `t: 3`, `p: 1`, `dkLen: 32`
  (lines 55-62), matching the SECURITY.md table cell for cell. CI test
  mode uses the lightweight params, which SECURITY.md also discloses.
- **PBKDF2 legacy**: 600,000 iterations, SHA-256 (lines 36, 150-156) —
  import-only, never used for new encryptions, as documented.
- **Integrity**: AES-GCM auth tag + SHA-256 over the ciphertext (not
  plaintext, so no equality fingerprint) with a byte-wise constant-time
  comparison (lines 226-257).

### 2.2 Signed exports: the signature covers the entire envelope

- v3 signs `JSON.stringify({ version, source, exportedAt, records })`
  with HMAC-SHA256 under a per-export random salt
  (`src/lib/utils/history-io.ts:340-348`); import re-derives the
  identical payload string via `buildPayload` (lines 399-411) and
  verifies with `crypto.subtle.verify` — constant-time (lines 137-143,
  426-431). Any modification of any record or metadata field breaks the
  signature.
- The strength caveat — the HMAC key lives in the client bundle and is
  merely XOR-split for obfuscation — is disclosed verbatim in the module
  header (lines 6-18) and in README "Limitations (honest)". The docs do
  not oversell it.

### 2.3 Import-boundary hardening (2026-11-19, from the depth round)

- **M1 — hostile envelope KDF burn (commit `0164159`).** The envelope KDF
  read-side caps honored `KDF_CAPS = { m: 1048576, t: 64, p: 8 }` (1 GiB,
  64 iterations), so a crafted "encrypted backup" could freeze/OOM the
  KDF worker inside the tab. The caps now sit 4× above the highest rung
  the app ever writes (64 MiB / t 3 / p 1) and bound a hostile
  derivation to seconds: `{ m: 262144, t: 8, p: 4 }`, pinned by an
  explicit battery assertion (`kdf-ladder.test.ts`).
- **M2 — uncapped import record count (commit `0164159`).** The ledger's
  save floor is O(N) sync hashes (`ledger-chain.ts` says so in its own
  cost model), so 5 MB of minimal records (≈125k commits) was a forever
  per-save tax. `MAX_IMPORT_RECORDS = 10_000` (~27 years of daily
  entries) refuses with `too_many_records` before any integrity work,
  mapped through `importErrorKey` and the four locales, battery-pinned by
  `history-io-caps.test.ts`.
- Both are attacker-controlled and endurance-shaped: they degrade a
  ledger forever, not once — which is why they were treated as MEDIUM
  findings despite needing no crypto break.

### 2.4 Data-chain non-findings verified during the same round

- Prototype pollution unreachable (records rebuilt as fresh literals
  through `toRecord`); `1e999`-class non-finite literals rejected per
  record; no regex DoS surface; the 5 MB size gate enforced pre-parse;
  CSV export-side only (cells quoted; no formula-injection surface since
  cells are numbers and static labels).
- Crypto hygiene: fresh salt+IV per encrypt, `crypto.subtle.verify`
  constant-time verify, `Math.random` absent from key paths, key material
  never logged, caller-side zeroization on every install path.

## 3. The provenance depth matrix extended to the publisher (D3, 2026-11-23)

Scope: close the two holes the previous session's honest verdict
documented — "D0-D2 can be forged 100% with public tooling; the commit
anchor exists in output but binds to nothing" (the minted matrix) and the
regenerable release channel (release-MITM). Method: every layer wired end
to end (module runtime, gate recompute, tests, generator oracle, CI
lane), each leg verified independently from at least two implementations
(TypeScript runtime, Python RFC 8032 reference, OpenSSL CLI), negative
cases proven to fail closed before any green run was trusted.

### 3.1 C2 — D3, the publisher signature (commit `87af298`)

- The D3 message is the length-framed clear bytes of both layers (u32le
  length prefixes, domain `bmi-stellar/depth-matrix/v1`), signed with the
  publisher's Ed25519 key. The private seed lives offline (generated
  fresh that session, in `download/`, never printed or committed); the
  module carries only the public key and the signature.
- The runtime verdict becomes three-fold: fingerprints (D2), identity
  binding, and publisher signature. Verdict space: `verified` /
  `unsigned` (the empty-signature rotation state — a known state, not
  evidence of tampering) / `tampered`.
- The verifier is self-contained bigint arithmetic (extended homogeneous
  coordinates, strict `s < L`), zero new dependencies — the app keeps
  its zero-curve footprint. During development a precedence bug
  (`&` binding looser than `===`) threw on every point decode and was
  caught because the D3 status refused to go green; the fix is commented
  as load-bearing in `edDecode`.
- Cross-checked from three implementations: the TypeScript runtime, the
  pure-Python RFC 8032 reference (`generate-provenance-words.py --check`,
  section [13] of the wholesale gate-keepers lane), and
  `openssl pkeyutl -verify` (Ed25519 is deterministic — all three produce
  the identical signature bytes).
- The gate (`check-signature.ts`) pins `EXPECTED_OWNER_PUBLIC_KEY` and
  verifies the signature over its own recomputed payload: swapping the
  module's constants AND the module's key still stops at a visible gate
  diff.

### 3.2 C1b — the artifact gate (commit `9c28752`)

- The tree gates proved the source; `check-artifact-provenance.ts` proves
  the shipped bytes. Over every text file the build emitted: zero
  plaintext identity (manifest, authors, handle, contact, and their
  fragments), the D3 pair present, the masked words present (as minified
  decimal BigInt literals), the PWA field parity. Wired `audit:artifact`
  into CI + both full `build.sh` lanes.
- The gate's first run caught its own design error — the D3 domain
  separator was probed as identity when it is public protocol material
  (the brand-prose class). Fixed with the boundary documented in the
  needle list; the lesson is recorded in INNOVATIONS entry 34.

### 3.3 Hygiene (commit `ca9b107`)

The two unused symbols the CI lint lane caught in `87af298` (unused
`D3_DOMAIN` import, unused `edEncode`) removed.

### 3.4 Verification evidence for the D3 session

- `signature.test.ts`: 13/13 (8 prior + 5 D3: RFC 8032 vectors 1-2,
  minted-matrix forgery, single-hex-digit tamper, depthLine shape).
- Full suite: 806 tests / 62 files green before the C2 push.
- `audit:signature` gate: 8/8 including the new D3 leg; generator
  `--check` 10/10 from the Python oracle.
- `audit:artifact`: 4/4 over the built `.vercel/output/static` payload
  (63 text files scanned).
- Negative proofs: tampered message, non-canonical `s` (s+L), flipped
  signature digit, and the mallory-identity minted payload all FAIL the
  verify (pinned as tests).
- CI for `ca9b107`: all four lanes green (CI, Gate-keepers, CodeQL,
  Docs).

## 4. The signed release channel (C3)

- **The tag-signing contract.** `release.yml` refuses to publish unless
  `git tag -v` shows a good signature from the key pinned in the
  `RELEASE_GPG_PUBLIC_KEY` repository secret (armored public key —
  public material by definition; a plain repository variable works as
  the fallback, so either tab serves; rotation is a settings change plus
  a workflow edit, both auditable). Fail closed while neither is set:
  the error message names the setting and the reason.
- **The attestation lane.** `actions/attest-build-provenance` (SHA-pinned
  v3) binds both release archives to the repository and workflow run
  through the GitHub OIDC identity; the attestation lands in the public
  transparency log and verifies offline with `gh attestation verify`.
  The permissions block gains `id-token: write` + `attestations: write`
  for exactly this flow.
- **The manifest gate reads raw entry names, not columns.** The first
  real release run (`v80.5.2-night.1`, run #54) exposed the gate's own
  fragility: the runner's `unzip -l | awk '$4'` column extraction
  silently dropped 3 of the 6 required names while the byte-identical
  command sequence passed locally — the same "checksum proves transport,
  never contents" class of bug the gate exists to catch, now inside the
  gate itself. It reads names in zipinfo mode (`unzip -Z1`, one per
  line, no columns, no headers) matched with `grep -Fx`, and on failure
  dumps the entries the archive actually lists, so a listing quirk can
  never eat a required file silently again.
- **Threat-model honesty.** The tag contract protects against a
  forged/unwitting tag; the attestation protects against release-page
  tampering post-publish. An attacker who controls the GitHub account
  itself can still cut a new tag — but it must be GPG-signed by the
  owner's key (they cannot) or the workflow fails closed, so the
  forgery surface shrinks to "compromise the owner's Proton GPG key",
  the same surface as every signed-release project in existence.

## 5. Honest limits and flagged items (kept, not silently dropped)

- D3 is provenance and tamper evidence, not DRM. The public key and
  signature ride the bundle; an attacker who understands the scheme can
  strip the whole matrix — but stripping means editing the gate (a
  visible diff), and the release channel no longer honors a stripped
  tree with a valid signed tag.
- Until `RELEASE_GPG_PUBLIC_KEY` was set (done 2026-11-23), the release
  lane failed closed by design — that was the correct failure.
- Memory forensics remains out of scope (the materialized plaintext
  lives in process memory by design of the -V/About surfaces); JS
  strings cannot be zeroed — an inherent platform boundary.
- Production `img-src` carries a bare `https:` wildcard
  (`hooks.server.ts:61`). No code loads remote images, so nothing leaks
  today, but tightening it to `'self' data: blob:` would shrink the XSS
  exfil surface. Flagged, not changed (hardening candidate).
- `src/lib/utils/crypto.ts:363` comment says "if Argon2 WASM fails" —
  stale wording; the implementation is pure JS. Cosmetic, flagged.
- The seal-failure honest-degrade posture ("I failed to witness" stays
  distinguishable from "I am not here", typed `{"t":"seal-failed"}`
  marker) is documented in-code; a user-visible degraded-encryption
  surface is a product decision, queued below.

## 6. Owner decision queue (security-facing, merged)

1. DONE 2026-11-23: `RELEASE_GPG_PUBLIC_KEY` set as a repository secret
   (armored public key of the Proton GPG identity); the workflow reads
   the secret with the variable fallback (the first release attempt
   exposed the namespace mismatch and was fixed in the same session).
2. Sign the next tag (`git tag -s vX.Y.Z`) with the same identity; the
   workflow now demands it.
3. The D3 publisher keypair lives in `download/d3-publisher-key.pem`
   (fresh, sandbox-local, never committed). Rotate at will before the
   next identity/signature change: re-run the generator with
   `--signing-key`, paste the block, and the gate re-pins.
4. Tighten production `img-src https:` → `'self' data: blob:`.
5. Surface the seal-failure degraded-encryption state to the user.
6. The SvelteKit 3.x major upgrade is the only real fix for the four
   allowlisted SvelteKit advisories (the allowlist entries expire
   2027-05-01 and force re-review; see the engineering consolidated
   audit for the dependency posture).

---

_Consolidated 2026-11-28 from the three source audits named in the
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
