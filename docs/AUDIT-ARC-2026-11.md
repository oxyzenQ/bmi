<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# BMI Stellar — Architecture Depth Audit (night-arc-gems-1)

**Date:** 2026-11-26
**Scope:** the whole-tree architecture at the smoothbore bar — hot-path latency (no lag, no bottleneck), determinism (math proof plus build determinism), safety (injection, storage, supply chain), honesty (claims versus mechanisms), and LTS investment value
**Method:** static read of the hot paths (storage, ledger chain, KDF engine order, render loops, HTML sinks), live gate runs on the working tree (proof census, scripts LOC, headers, branding, version sync, format), a production build under the new warning-equals-failed law, and symbol-level cross-checks of every claim below against `src/**` — no claim was kept that could not point at its mechanism

---

## Verdict

No code change required. The architecture holds at the smoothbore bar in every audited dimension: the hot paths are bounded or amortized, the math is pinned by property proofs and fail-closed runtime claims, the injection surface is static-by-construction, and the gates that enforce all of it ran green on this very tree during the audit. The honest limits recorded below are observations with no action recommended today — investing in them now would be over-engineering, not hardening.

## Smoothbore (no lag, no bottleneck) — verified

- **KDF never blocks the UI by design.** In production the derivation rides the KDF worker (`kdf.worker.ts`): the Rust wasm engine first (digest-verified before use), the `@noble/hashes` implementation as its in-worker fallback. The main-thread JavaScript path exists only for tests, non-browser contexts, and worker failure, and logs the degradation (`warnDev` in `argon2idRawBytes`, `crypto-primitives.ts`). Every path implements the same Argon2id (RFC 9106) and is pinned byte-identical by the known-answer and cross-check suites.
- **Ledger continuity append is amortized O(1).** `computeChainSync` (`ledger-chain.ts`) resumes from the divergence point through cached checkpoints (`CACHE_MAX_ENTRIES = 4`): one new link for a typical append, a full re-hash only on a cache miss or real divergence.
- **Render loops are bounded and rAF-batched.** The sparkline renders `history.slice(-MAX_POINTS)` with `MAX_POINTS = 20`; scroll and hover state flush through `requestAnimationFrame`; the DnaHelix animation ticks at 25 ms but writes to the DOM only when the helix slot actually changes, and browsers throttle the interval when the tab is hidden.
- **Every data boundary carries a numeric bound.** `MAX_IMPORT_RECORDS = 10_000` and `MAX_IMPORT_SIZE = 5 MB` on import, a 24-hour timestamp-skew tolerance, `MAX_BACKUPS = 3` in the IndexedDB rotation, a 200-entry logger ring, and a 512-entry warn-dev dedup table.
- **The single-writer law is real and tested.** An origin-wide Web Lock (`ledger-lock.ts`) serializes legit ledger writes across tabs, with dedicated suites (`ledger-lock.test.ts`, `ledger-single-writer.test.ts`).
- **The LOC law holds at the file level.** The largest source file is `share-image.ts` at 957 of the 1000-line cap; `check-loc` and `check-scripts-loc` both pass on this tree.

## Determinism and math proof — verified

- The proof census guard passes: 7 property-proof harnesses on disk (`clamp-display-for-all`, `next-after` float determinism, `classifier-for-all`, `bytes-hex-for-all`, `kdf-ladder-floor`, `envelope-kdf-gate`, `crack-time-ladder`), every law exported by its source and exercised by its harness.
- The runtime proof harness proves eighteen fail-closed claims live in a pinned browser (`scripts/proof/run-proof.ts`), on its own CI lane.
- The service worker gates its precache on digest integrity and re-verifies round-robin per navigation (night-frontier-Z10) — poisoning cannot survive a bounded number of navigations.
- This audit window adds the depth-strict build law: **warning = failed** at every build-adjacent lane — svelte-check with `--fail-on-warnings`, eslint with `--max-warnings 0`, and a bundler `onwarn` law that turns any warning (including the 700 KB chunk cap) into a hard build error.

## Safety — verified

- **The HTML injection surface is static by construction.** All 12 `{@html}` sinks in the tree render developer-owned locale strings from `src/lib/i18n/locales/*.ts` shipped inside the bundle; no sink interpolates user data, and no dynamic key reaches `t()`.
- **Security headers ship from `src/hooks.server.ts`** — CSP with an explicit `img-src` allowlist (`'self' data: blob:`, no wildcards), HSTS, COOP/COEP, and Permissions-Policy.
- **The at-rest seal keeps its honest failure modes.** The `bmi-at-rest-v1` seal writes a typed `{"t":"seal-failed"}` marker on witness failure ("I failed to witness" stays distinguishable from "I am not here"), keyed witness sealing requires the passphrase (night-frontier-Z6-Z9 symbols verified on disk: `ledger-vault-anchor.ts`, `ledger-continuity.ts`, `vault-opfs.ts`).
- **The supply-chain policy holds on this tree.** Registry-only ranges, an empty lifecycle-script trust list, exact-pinned engine dependencies, digest-pinned scanners, and `audit:supply-chain` green.

## Honest limits (observations, not defects)

- The live history carries no record cap. The realistic bound is the import cap (10,000 records) and a human weigh-in cadence; a full-history sort per read stays cheap at that scale. No action recommended — a cap now would be a policy change, not a fix.
- The main-thread KDF fallback blocks the UI for the derivation window when the worker itself fails. It is an intentional degradation with a logged warning, not a hot path.
- `__BUILD_TIME__` embeds wall-clock time, so the web bundle is not byte-reproducible by design. It is display-only build info; the wasm engine lane is byte-reproducible and digest-verified, which is where reproducibility carries security weight.
- The DnaHelix poll runs every 25 ms; each tick is an arithmetic slot comparison with a DOM write only on slot change — negligible on any hardware this app targets.

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
