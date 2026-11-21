<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# BMI Stellar — Depth Hardening & LTS Audit Report (night-depth-hardening-5 / night-zen-lts-Z)

**Date:** 2026-11-19
**Scope:** night-depth-hardening-5 (precision + deterministic output across minimal distros, kernel 5.15+ LTS baseline; depth hardening of every existing innovation for LTS usage, ultra scale on server, long endurance, high value) + night-zen-lts-Z-1 (all infrastructure) + night-zen-lts-Z-2 (the sharpest skill: the core data chain and its crypto stack), cross-checked against every prior audit in this repository
**Method:** three parallel breadth sweeps (CI/build infra, dragon-hunt hygiene, security-boundary) plus hand reading of the sharpest surfaces (`bmi-calculator.ts`, `ledger-chain.ts`, `engine/argon2id/src/lib.rs` in full, `kdf-ladder.ts`, the import pipeline), with every fix TDD-verified and gated by `./scripts/build.sh check-all` + `./scripts/gate-keepers.sh`
**Mandate:** ultimate total LTS, reliable all round — with explicit skip-and-justify when a domain is already at peak; never over-engineer past the peak

---

## Resolution Summary

| Commit    | Domain        | Change                                                                                                                                                         |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0164159` | Security (M1) | Envelope KDF read-side caps tighten 1 GiB / t 64 / p 8 → 256 MiB / t 8 / p 4 — the hostile-envelope OOM burn is bounded to seconds                             |
| `0164159` | Security (M2) | Import record cap `MAX_IMPORT_RECORDS = 10,000`, refused before integrity work — one hostile file can no longer become a durable O(N) tax                      |
| `0164159` | Hygiene       | One `bytesToHex` home (leaf `hex.ts`) replaces seven hand-rolled copies; the duplicated import pre-guard merges into `importPlaintextOrFail`                   |
| `0164159` | Hygiene       | Dead code: 3 test-only hooks, 5 unneeded exports, 1 stale eslint-disable, 28 dead translation keys × 4 locales; ratchets move DOWN (760→751, 676→640, 631→601) |
| `0164159` | Infra (Z1)    | `rust-validate` and `rust-engine-audit` obey the ten-minute CI law (15→10); security-audit's Rust toolchain pins 1.100.0; build.sh interpolates the bun pin    |
| (this)    | Docs          | This audit, the innovation ledger entry, the Unreleased changelog bullets                                                                                      |

## Round Mandates

### night-depth-hardening-5 — precision, deterministic output, distro minimal 5.15+

- **The math core is already deterministic at peak — verified, not assumed.** `bmi-calculator.ts` uses only IEEE-754 exact operations (`+ - * /`), no `Math.pow`, no transcendental functions, and a fixed `toFixed(2)` output precision; `lib.rs` (read in full, 779 lines) contains no `HashMap` iteration, no float formatting, static slot arrays only, and RustCrypto constructions whose output is deterministic by specification. The Mifflin-St Jeor BMR is pure arithmetic. Nothing to fix; fixing nothing was the correct action.
- **The deterministic-build seat was already at peak (innovation 28).** The wasm artifact is pinned (`rust-toolchain.toml` channel 1.100.0 + `Cargo.lock` + recorded SHA-256 digest + the provenance CI lane), so "the same bytes on every distro" is already enforced by construction. Kernel 5.15+: the wasm32-unknown-unknown target makes no syscalls, and the only native Rust execution surface is the CI provenance lane (GitHub runners ≥ 5.15) — there is no distro-sensitive code path to harden. Documented; no over-engineering performed.
- **One real determinism finding, one deliberate skip.** `computeChainSync` sorts timestamp-only, so two records sharing one millisecond chain in stored-array order — a cross-realm merge could theoretically order them differently and produce a different head. Fixed head order would require a canonical tiebreak, which changes chain heads for any ledger containing duplicate-timestamp records and would false-positive the witness on upgrade. Skip (documented below): the migration cost outweighs a rare edge the single-writer law already orders.
- **Guardian continuity (the hidden-failure-mode finding).** The scheduled runs visible in the Actions API (Aug–Oct, including the Sept 7 → Oct 26 security-audit red streak and the Oct 26 maintenance red) belong to the repository's predecessor state: the current git history starts at `e43799d` (2026-11-19 09:25), which created all ten workflow files fresh, with the Sunday 03:00/03:30 crons. The new schedule's first firing is Sunday 2026-11-22. The Oct failures themselves were stale signals — the dependency audit they red on is now allowlisted with reasons and expiries and passes locally (`audit:deps` green, 6 accepted advisories, every entry inside its expiry). Both lanes were dispatched manually post-fix to prove the current tree green instead of waiting.

### night-zen-lts-Z-1 — all infrastructure

- The 10-workflow/15-job inventory is otherwise exemplary: every job declares `timeout-minutes`, every `uses:` is a 40-hex SHA pin, no `|| true` swallows a real signal (each is documented and guarded), no stale path references, scripts/ tree discipline fully compliant with RULES.md, zero TODO/FIXME/HACK/XXX markers.
- Fixed: the two 15-minute jobs (a direct RULES.md violation — measured runtime ~2 min, so the ceiling holds with margin); the floating `@stable` toolchain inside a lane whose own comment forbids float; the hardcoded `bun@1.3.11` error string that drifts at the next bun bump.
- Noted, not fixed (observation-only posture is documented as intentional in the workflow): `continue-on-error: true` on `rust-engine-audit` means an advisory finding can never redden the run — the escalation gap is an owner decision, listed in the queue.

### night-zen-lts-Z-2 — the sharpest skill (core data chain + crypto stack)

- The validated data chain (innovation 2) held against every probe: prototype pollution unreachable (records rebuilt as fresh literals through `toRecord`), `1e999`-class non-finite literals rejected per record, no regex DoS surface, the 5 MB size gate enforced pre-parse, and CSV export-side only (cells quoted; no formula-injection surface since cells are numbers and static labels).
- Fixed: the two MEDIUM findings below, both attacker-controlled and both endurance-shaped (they degrade a ledger forever, not once).
- **M1 — hostile envelope KDF burn (was: up to 1 GiB memory + 64 iterations per passphrase attempt).** `validateEnvelopeKdfParams` honored the read-side caps `KDF_CAPS = { m: 1048576, t: 64, p: 8 }`; a crafted "encrypted backup" could freeze/OOM the KDF worker inside the tab. The caps now sit 4× above the highest rung the app ever writes (64 MiB / t 3 / p 1) and bound a hostile derivation to seconds: `{ m: 262144, t: 8, p: 4 }`, pinned by an explicit battery assertion.
- **M2 — uncapped import record count (was: 5 MB of minimal records ≈ 125k commits permanently).** The ledger's save floor is O(N) sync hashes (`ledger-chain.ts` says so in its own cost model), so one hostile file was a forever per-save tax. `MAX_IMPORT_RECORDS = 10_000` (~27 years of daily entries) refuses with `too_many_records` before any integrity work, mapped through `importErrorKey` and the four locales, battery-pinned by `history-io-caps.test.ts`.

## The Five Audit Areas (perstage verdicts)

1. **Stability & Crash** — the crash surface is the engine ABI and the import boundary. `lib.rs` read in full: every pointer/length pair validated (`raw_slice`), the seal/open seats zeroize on failure, panics abort the instance and the wrapper falls back to the byte-identical JS engine (a hostile input can lose the speedup, never the key). The stress surface that existed — burn burns (M1) and durable degradation (M2) — is now bounded and battery-pinned. Visual/performance regressions: none (no UI code path touched except the removed dead key cleanup; `svelte-check` 0/0, 772/772 green, the build gate green).
2. **Code Hygiene (dragon hunt)** — seven hex-encoder copies merged into one leaf home (`hex.ts`), the doubled import pre-guard merged (`importPlaintextOrFail` — which also fixes a misleading `wrong_passphrase` on the validate path for corrupted encrypted payloads), one shared `formatShareTimestamp`, 3 dead test hooks deleted, 5 unneeded exports un-exported, 1 stale eslint-disable removed, 28 dead translation keys × 4 locales deleted (older-UI residue, zero references, no dynamic key construction). Deliberate keep: `kdf-wasm-engine.ts`'s local base64/hex helpers — its documented dependency-leaf contract wins over dedup.
3. **Optimization** — skip, with the honest reason: no profiling data exists in the tree (the perf claim surface is the runtime-proof CI lane, not a micro-benchmark harness), and every hot path the sweep inspected is already bounded by design (the checkpoint-cached chain, the engine-first KDF with JS fallback). A micro-optimization without a measurement is superstition; none was performed.
4. **Security Hardening (white hat)** — M1 and M2 fixed above; IV/nonce hygiene, constant-time checksum compare, zeroization discipline, worker origin gates, CSP headers, and the supply-chain posture all verified clean (see non-findings). The remaining lows are listed honestly in the queue, not silently skipped.
5. **LTS Stability** — the hidden failure modes found: the guardian-schedule discontinuity (resolved by evidence + dispatches + the 2026-11-22 first firing to watch), the two CI-law violations (fixed), and the two endurance burns (fixed). The deterministic-build and deterministic-math surfaces verified at peak.

## Verified Non-Findings (checked, already correct, left untouched)

- `computeBmi`/`computeBmrMifflinStJeor`: exact IEEE arithmetic only — cross-engine deterministic within the spec's guarantees.
- `engine/argon2id/src/lib.rs`: the handle generation/masking, the fail-closed kind gates, the volatile zeroization, and the refusal values that cannot collide with valid handle shapes (the Z8 contract) all read correct line by line.
- Import parse path: prototype pollution unreachable; NaN/Infinity/Date/regex paths closed; the 5 MB gate pre-parse.
- CSV export: quote-and-double discipline; no attacker-controlled cell prefixes.
- DOM sinks: 14 `{@html}` sites, all static compiled dictionaries; zero `innerHTML`/`eval`/string-`setTimeout`.
- Service worker and vault worker: origin-checked postMessage; integrity manifest bounded re-verification.
- Crypto: fresh salt+IV per encrypt, `crypto.subtle.verify` constant-time verify, `Math.random` absent, key material never logged, caller-side zeroization on every install path.
- Supply chain: 7 runtime deps, one postinstall (esbuild, platform binary), deny.toml structural denies at max.

## Skipped by Verdict (over-engineering guard, stated plainly)

- **Ledger timestamp tiebreak** — a real determinism edge (same-millisecond records chain in stored order), but the fix re-orders an existing hash chain and false-positives the witness on upgrade for affected ledgers. The migration cost exceeds the edge-case benefit. Recorded here so it is re-litigable with evidence.
- **`kdf-wasm-engine` base64/hex dedup** — the duplicate is real, but the module's documented dependency-leaf contract (imports nothing from the app) is an invariant with its own value. Kept.
- **~28 type-only un-exports** — public-surface churn across every module for zero behavior change. Noise exceeds value.
- **Constant-time chain-head compares (`===` on hex heads)** — the compared values are public/derived (not secrets); the timing oracle is theoretical. The existing XOR compare stays for checksums where it matters.
- **Seal-failure plaintext fallback indicator** — the honest-degrade posture is documented in-code; a user-visible degraded-encryption surface is a UX/product decision, queued for the owner.
- **Passphrase hint plaintext / CSP `unsafe-inline` / legacy v0–v2 forgeable checksums** — each is a documented, deliberate design boundary (the zero-knowledge verifier design, the SvelteKit CSP limitation, integrity-only legacy imports). Owner decisions, queued.

## Owner Decision Queue (not acted on)

1. `continue-on-error: true` on `rust-engine-audit` — keep observation-only, or escalate a red advisory into an owner signal (issue/comment)?
2. The seal-failure degraded-encryption indicator (surface the honest fallback to the user).
3. The SvelteKit 3.0/3.1 major upgrade — the only real fix for the four allowlisted SvelteKit advisories (all others expire 2027-05-01 with re-review forced by the policy gate).
4. Watch the new Sunday schedule's first firing (2026-11-22): maintenance 03:00 UTC, security-audit 03:30 UTC, plus the probe/self-heal cohort — the first scheduled data point of the recreated repository.
