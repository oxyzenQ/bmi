<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# BMI Stellar — the night-cafe-mclaren-2 depth master audit (2026-11-27)

**Scope:** the pre-build McLaren audit the owner asked for — design, engine
and architecture examined the way a constructor audits a car before it
ships: the math re-proven from first principles, the engine counted
line by line, every moving part checked for drag (no lag, no
bottleneck), every honest claim cross-checked against the source, and
the whole estate re-verified on today's tree, which now carries the
AXP1-ZnQ (Architect's eXecution Protocol 1) address-catalog estate.
**Method:** the pure math functions were driven live (bun/vitest print
of the real implementations over fixed inputs) and their outputs
diffed against an independent Python reference recomputed from the
published literature and standards — not from this repo's code; the
Rust engine's panic surface was counted mechanically; the import graph
of the new CI tooling was audited at the AST level (stdlib-only proof);
every count claim in the docs was re-measured on disk; the known
defect-class sweeps (bare sorts, listener leaks, non-determinism in
math paths, deep clones, raw HTML sinks) ran across the whole
non-test source. No finding below was kept that could not point at its
reproduction command.

## Verdict

Zero code defects found. The math estate is correct, not merely
deterministic; the engine has no panic surface; the interaction
surfaces leak nothing; and every audited doc claim matched the source
except four stale references, which this pass synced
(`e4c847b`). The tree holds the smoothbore bar with a stronger
guarantee than before: the property harnesses no longer stand alone —
an external reimplementation now agrees with them to the letter.

## The math estate, re-proven from first principles

Every value below was produced by the real implementation and then
recomputed independently in Python from the standard or the published
paper. Result: **ALL PASS, zero divergence** (36 checks).

- **Unit constants are the legal exact values.** `IN_TO_CM = 2.54` and
  `LB_TO_KG = 0.45359237` are the international yard-and-pound
  definitions (NIST, 1959), not approximations — conversion round
  trips carry no accumulated error.
- **BMI** (`computeBmi`, 5 sample pairs): `kg / m^2`, printed at
  `toFixed(2)` — 170/65 → 22.49, 180/95 → 29.32, 155/40 → 16.65,
  200/130 → 32.5, 165/68.5 → 25.16. All five match the independent
  recomputation bit-for-bit at the printed precision.
- **WHO classification edges** (`classifyBmi`, 13 boundary probes):
  the lower edge of each band is inclusive exactly as WHO defines it —
  18.49999 → Underweight, 18.5 → Normal Weight, 24.999 → Normal,
  25 → Overweight, 29.999 → Overweight, 30 → Obese.
- **BMR** (`computeBmrMifflinStJeor`, 4 cases): 10·kg + 6.25·cm −
  5·age + 5 (male) / − 161 (female) — the published Mifflin-St Jeor
  (1990) equations to the last digit (1648.75, 1249, 1705, 1057.75),
  with null on non-positive inputs.
- **The crack-time ladder** (`formatCrackTime`, 11 points): greedy
  biggest-unit with in-band rounding — Julian years (365.25 d) and a
  30.44 d mean month; the band transitions are monotone
  (99.999 y → "100 years", 100 y → "1 century") and the mid-band
  rounding behavior is documented below as an honest limit.
- **The KDF ladder** (`kdf-ladder.ts`): the floor is exactly the OWASP
  Password Storage Cheat Sheet Argon2id minimum (m 19456 KiB = 19 MiB,
  t 2, p 1); the read-side caps are m 262144 KiB = 256 MiB, t 8, p 4
  (the night-depth-hardening-5 M1 tightening, still in force); every
  tier sits inside [floor, caps] on all three axes, tier memory is
  monotone (19456 → 32768 → 65536 KiB), and dkLen is 32 — the AES-256
  key size.

## The engine (the powertrain)

- **Zero panic surface.** `engine/argon2id/src/lib.rs` (779 lines)
  contains no `unwrap()`, no `expect()`, no `panic!`, no
  `unreachable!` — counted mechanically, not skimmed. The release
  profile pins `panic = "abort"` (a wasm trap is loud, never silent
  corruption), `lto = true` and `codegen-units = 1` (the deterministic
  build the provenance lane pins).
- **The wasm boundary validates before the engine runs.** The JS side
  (`kdf-wasm-engine.ts`) rejects non-integer parameters, bounds the
  output length to [4, 2^32-1], requires salt ≥ 8 bytes (the RFC 9106
  minimum), and maps every engine error code onto a thrown Error so
  the worker fallback and the wasm engine fail in the same shape.
- **The KDF never blocks the main thread by design** (worker-first,
  logged fallback — the night-arc-gems-1 structure, still true), and
  the production tier runs m 64 MiB / t 3 / p 1 — above the OWASP
  floor, inside the caps.

## The chassis (interaction surfaces, drag and leaks)

- **No bare-comparator sort on data** — the one `.sort()` without a
  comparator in the tree (`version-family.ts`) sorts relative path
  strings for deterministic discovery order, exactly what it claims.
- **No `Math.random` or `Date.now` in any math path** — timestamps
  exist only in records, skew checks and display; the calculator,
  classifier, ladders and gauge math are pure.
- **Every interval, listener and observer is cleaned up.** The
  DnaHelix poll and the DebugPanel auto-refresh both return their
  teardowns from `onMount`; the jelly-scroll surface registers every
  listener with `{ passive: true }` and removes all six on destroy.
- **No deep-clone in hot paths, no raw `innerHTML` sink** — the only
  `{@html}` seats remain the 12 developer-owned locale-string sinks in
  `AboutSection.svelte` (counted today: 12, one file).
- **The data bounds all hold** (each re-measured at its constant):
  import 10,000 records / 5 MB, backup rotation 3, timestamp skew 24 h,
  ledger checkpoint cache 4, logger ring 200, warn-dev dedup 512,
  sparkline 20 points.

## The instrumentation (claims versus source)

- The proof census gate ran green live during the audit: **7 property
  harnesses, 7 on disk**, every law exported by its source.
  (`next-after` float determinism, named by the night-arc-gems-1
  audit, is a law exercised inside the harnesses — `classifier`,
  `clamp-display`, `crack-time-ladder` — not a standalone file; the
  census gate is the authoritative count, recorded here so the next
  audit does not misread that list.)
- The runtime proof harness carries exactly **18 `prove()` claims**
  (the CI lane's green run on this tree is the live witness).
- The new AXP1-ZnQ CI tooling passes its own supply-chain bar: the AST
  import audit shows **stdlib-only** across all four Python files —
  no third-party dependency joined the maintenance surface.
- The claims-versus-source cross-check found four stale references
  (the missing AUDIT-DEPTH map row, the maintenance-policy address
  refresh, the verdict bullet's expansion, the empty Unreleased
  ledger) — all synced in `e4c847b`.

## What was not changed, on purpose

- **No code change anywhere.** The math is correct (verified against
  the literature, not merely deterministic), the engine has nothing to
  remove, and the sweep classes came back empty — fixing nothing was
  the correct action, the audit's job is to prove it rather than to
  manufacture work.
- **The crack-time ladder keeps its `Math.round` mid-band behavior.**
  Exactly 1.5 centuries of projected crack time prints "2 centuries"
  (round-half-up inside the band). It is deterministic, monotone
  across every boundary probed, and inside the property harness's
  pinned contract; changing the rounding is a display-taste decision,
  not a fix.
- **The 30.44 d month constant stays.** The true mean Gregorian month
  is 30.436875 d — a 0.01% display deviation on one rung of a
  subjective ladder, deterministic and documented.

## Honest limits (observations, not defects)

- `share-image.ts` draws its canvas without awaiting
  `document.fonts.ready` — text renders with the system font stack
  available at call time. Per-device output is stable (system fonts do
  not change mid-session), and the digest lane pins the archive
  signature, not the pixels; a webfont-driven redesign would need the
  await added. Not a defect today.
- The live history still carries no record cap (the import cap and a
  human weigh-in cadence bound it in practice) — the night-arc-gems-1
  posture stands: a cap now is a policy change, not a fix.
- The audit's Python reference lives outside the repo
  (`scripts/audit-mclaren2/` on the auditor's bench, not in the tree):
  the repo already carries the property harnesses as the standing
  gate, and a second implementation of the same laws inside the tree
  would be a second truth to keep in step — the zelynic
  one-discovery-law principle, applied to proofs.

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
