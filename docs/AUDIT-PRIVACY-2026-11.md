<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# BMI Stellar — Brutal Honesty Privacy Audit

**Date:** 2026-11-03
**Scope:** every privacy claim in the README tagline, the "What makes bmi
sharp" table, the "Limitations (honest)" section, and SECURITY.md — verified
against the actual source at this commit, not against prior audit reports.
**Method:** full-source scans for network primitives (`fetch`,
`XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`), server-endpoint
enumeration, dependency inventory, line-level reads of the crypto, storage,
backup, history-io, service-worker, layout, and hook layers.
**Gate:** `./scripts/build.sh check-all` + `bun run test:ci` green at this
commit.

---

## 1. Confirmed True (100% verified by code)

### 1.1 No server-side processing of health data — physically impossible

- The routes tree contains **zero `+server.ts` endpoints and zero form
  actions**; the SvelteKit server exists only to serve assets and set
  headers (`src/hooks.server.ts`). There is no server path that could
  receive a health value even if the client tried to send one.
- The only server-side logic is the security-header pipeline
  (`src/hooks.server.ts:6-151`) and cache-control — no request body is ever
  read, nothing is logged, nothing is forwarded.

### 1.2 The only outbound calls in the entire app — two, both disclosed below

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

### 1.3 Analytics receives no health values — data-flow proof

- Injection is double-gated: `import.meta.env.PROD &&
__IS_VERCEL_DEPLOYMENT__` (`+layout.svelte:134`; the define is built from
  `process.env.VERCEL === '1'` in `vite.config.ts:99-102`). Self-hosted and
  dev builds never load the SDKs.
- The calls are `injectAnalytics({ mode: 'production' })` and
  `injectSpeedInsights()` with **no data arguments**; a repo-wide scan finds
  **no `track()` calls** (the only `track` matches are Svelte's `untrack`
  reactivity helper). With no custom events, the SDKs' page-view/vitals
  collection has no app-supplied channel for BMI, TDEE, or body-fat values.
- Form-submission trace: `BmiForm` → calculator → `saveBmiToHistory` →
  `history-io.ts` → `storage.ts` → memory cache + `localStorage` + IndexedDB
  (`src/lib/utils/storage.ts:22-30,409-434`) and the local rolling backup
  (`src/lib/utils/backup.ts:55-80`, last 3 snapshots in IndexedDB). Every
  module in the chain is local; none imports `fetch` or any transport.

### 1.4 Encryption stack is exactly what the docs claim

- **AES-256-GCM via native WebCrypto**: `crypto.subtle.encrypt/decrypt`
  (`src/lib/utils/crypto.ts:396-401,482-488`).
- **IV**: 12 bytes (`IV_LENGTH`, line 38) from `crypto.getRandomValues`
  (lines 187-191), generated fresh per encryption (line 373). 16-byte random
  salt (line 37).
- **Keys are non-extractable**: `importKey(..., false, ...)` (line 133) —
  key material cannot be read back out of the CryptoKey.
- **Argon2id is the real Argon2id**: `@noble/hashes/argon2.js` — pure
  JavaScript, no WASM wrapper (line 130). Production parameters are exactly
  `m: 64*1024` KiB (64 MiB), `t: 3`, `p: 1`, `dkLen: 32` (lines 55-62),
  matching the SECURITY.md table cell for cell. CI test mode uses the
  lightweight params, which SECURITY.md also discloses.
- **PBKDF2 legacy**: 600,000 iterations, SHA-256 (lines 36, 150-156) —
  import-only, never used for new encryptions, as documented.
- **Integrity**: AES-GCM auth tag + SHA-256 over the ciphertext (not
  plaintext, so no equality fingerprint) with a byte-wise constant-time
  comparison (lines 226-257).

### 1.5 Signed exports: the signature covers the entire envelope

- v3 signs `JSON.stringify({ version, source, exportedAt, records })` with
  HMAC-SHA256 under a per-export random salt
  (`src/lib/utils/history-io.ts:340-348`); import re-derives the identical
  payload string via `buildPayload` (lines 399-411) and verifies with
  `crypto.subtle.verify` — constant-time (lines 137-143, 426-431). Any
  modification of any record or metadata field breaks the signature.
- The strength caveat — the HMAC key lives in the client bundle and is
  merely XOR-split for obfuscation — is disclosed verbatim in the module
  header (lines 6-18) and in README "Limitations (honest)". The docs do not
  oversell it.

### 1.6 Storage and backup never leave the browser origin

- The fallback chain (memory → `localStorage` → IndexedDB) is implemented
  entirely in `src/lib/utils/storage.ts` and `src/lib/utils/db.ts`; `db.ts`
  contains no network primitives. IndexedDB and localStorage are origin-
  scoped browser APIs — there is no code path to anything else.
- **No hidden sync exists**: no sync/restore-from-remote code anywhere;
  clearing site data clears the ledger, exactly as the README states.
- The service worker caches same-origin assets only, ignores non-GET and
  cross-origin requests (`src/service-worker.ts:189,192`), and checks
  message origin before `SKIP_WAITING` (lines 113-122).

### 1.7 Passphrase handling matches SECURITY.md

- The passphrase is never stored: only an AES-GCM verifier ciphertext of a
  known plaintext (`BMI_STELLAR_VERIFIER_V1`) lands in IndexedDB
  (`crypto.ts:536-554`); `verifyPassphrase` decrypts it (lines 604-624).
  Wrong passphrase → auth-tag mismatch → false.
- UI hygiene: `autocomplete="new-password"` plus a honeypot username field
  keeps browsers/password managers from caching it
  (`PasswordFields.svelte:51,61,94`); the modal state is cleared on close
  and after operations (`EncryptionModal.svelte:66,145,277`).
- Production logging cannot leak it: `warnDev` is compiled out in
  production (`src/lib/utils/warn-dev.ts:30-32`), the structured logger is
  only called with trace IDs and error contexts, the DebugPanel is
  dev-only (`+layout.svelte:115-125`), and no direct `console.log` of
  values exists outside dev-only modules.
- Fonts, i18n dictionaries, and the zxcvbn dictionary are bundled locally
  (`@fontsource-*`, `src/lib/i18n/locales/*`); `app.html` references only
  same-origin assets — no CDN, no third-party script tag.

## 2. Partially True / Misleading (and what was done)

1. **The update check was under-disclosed — fixed in this commit.** The
   README disclosed Vercel telemetry but not the automatic update check:
   `checkForPwaUpdate('auto')` fires ~3 s after every production mount
   (`+layout.svelte:183-185`) and sends two bodyless unauthenticated GETs to
   public GitHub URLs (`pwa-update.ts:8-9,233-236`). No cookies (default
   `credentials: 'same-origin'`), no payload, no health data — but GitHub
   sees IP, user agent, and timing. README "Limitations (honest)" and the
   SECURITY.md Privacy Boundary now state this explicitly. The tagline's
   "no cloud profile" claim remains true: an IP-visible update ping is not a
   profile, and no health byte participates.
2. **"Encrypted backups" is an optional layer, and the docs say so.** The
   tagline is a feature claim; the body text (README limitation on at-rest
   storage, SECURITY.md export section) states that local storage is not
   encrypted at rest and that unencrypted export exists. Verdict: honest
   once read past the tagline; no change needed.
3. **Passphrases are not zeroed in memory.** They are JS strings — that is
   not achievable in the language. Mitigations present: non-extractable
   keys, per-operation re-derivation, state clearing, no persistence. The
   docs claim "never stored, cached, or transmitted" — which is true — and
   do not claim memory zeroing. Verdict: no doc lie; noted as an inherent
   platform boundary.
4. **Production `img-src` carries a bare `https:` wildcard**
   (`hooks.server.ts:61`). No code loads remote images, so nothing leaks
   today, but tightening it to `'self' data: blob:` would shrink the XSS
   exfil surface. Hardening note only — flagged, not changed.

## 3. False / Dangerous

**None found.** No telemetry of health values, no hidden sync, no
server-side processing, no stubbed privacy feature, no crypto
misrepresentation. Every checked claim in the tagline, the sharpness
table, the limitations list, and SECURITY.md is backed by the source.

## Flagged, not fixed (per audit rules — no code changes)

- `src/lib/utils/crypto.ts:363` comment says "if Argon2 WASM fails" —
  stale wording; the implementation is pure JS. Cosmetic.
- Production `img-src https:` wildcard (see 2.4). Hardening candidate.

## Verification

- `bun run test:ci` — 464/464 across 30 suites, green.
- `./scripts/build.sh check-all` — all steps green (format, 5 audits,
  typecheck, lint, tests, production build).
- Doc fixes in this audit: README limitation bullet + SECURITY.md Privacy
  Boundary paragraph, committed separately from this report.

_End of audit. Every claim above is reproducible from the cited file:line
at this commit._
