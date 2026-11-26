<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# BMI Stellar Dormant Maintenance Guide

This guide is the wake-up checklist for BMI Stellar after a quiet period of 1-5 years.

## Current Capsule

- App: BMI Stellar
- Version: `80.6.0`
- Runtime: Bun `1.3.11` from `package.json#packageManager`
- Node range: `>=22 <27`
- Framework: SvelteKit 2, Svelte 5, TypeScript
- Engine toolchain: Rust `1.100.0` pinned in `engine/argon2id/rust-toolchain.toml` (only needed to rebuild the wasm KDF artifact via `scripts/ci/wasm-provenance.sh --refresh`; the embedded artifact is verified against the crate in CI without a local Rust install)
- Deployment target: Vercel with `@sveltejs/adapter-vercel`
- License: AGPL-3.0-only OR Commercial, enforced in source headers as `AGPL-3.0-only OR Commercial` (the manifest spells the second seat as `LicenseRef-Commercial`)

## Wake-Up Order

1. Install the pinned toolchain if possible.
2. Run the one-command bring-up: `./scripts/setup.sh` (toolchain check against the `packageManager` pin, `bun install --frozen-lockfile`, and the pre-commit gate wiring in three idempotent phases). Or run the steps by hand:

```bash
bun install --frozen-lockfile
```

3. Run the validation gate. The canonical entry point is the local gatekeeper:

```bash
./scripts/build.sh check-all
```

This runs the full chain (format:check → the eleven audits → check → lint → test:ci → build — the exact enumeration lives in `scripts/build.sh` under `check_all`). The lighter `bun run verify` runs four of the eleven audits and uses `test:run` instead of `test:ci`.

4. If the frozen install fails because the ecosystem moved, upgrade Bun/Node first, then make dependency changes in a dedicated maintenance commit.
5. If `audit:deps` fails because new advisories were published against pinned transitive deps during the dormant period, bump the relevant `overrides` in `package.json` (do not weaken crypto deps). If no fixed release exists within the pinned major, add a temporary entry with a reason and an expiry to `scripts/audit-allowlist.json` instead of weakening the gate. Re-run `bun install` then `./scripts/build.sh check-all`.
6. If CI fails only because GitHub Actions runners/actions changed, update workflow actions without touching app behavior.

## CI During Dormancy

- Scheduled guardians run weekly on Sunday, WIB-morning anchored: dependency maintenance (Sunday 10:00 WIB — the bun lockfile and, since night-frontier-Z6, the Rust engine lockfile through the sweep's rust jobs), CodeQL (Sunday 10:00 WIB), the security audit (Sunday 10:30 WIB, 30 minutes after maintenance so it audits the refreshed lockfiles — `bun.lock` and `engine/argon2id/Cargo.lock`), and the runtime proof harness (Sunday 11:00 WIB, eighteen fail-closed runtime claims in a pinned browser).
- GitHub disables scheduled workflows after 60 days without repository activity and sends one notice. This is expected while dormant; re-enable each workflow from the Actions tab (or `gh workflow enable <name>`) as part of wake-up.
- The self-heal and runtime-probe lanes are retired, so the estate carries no standing push credential at all: pin freshness re-reads on every commit through the pre-commit advisory gate, the sweep heals on demand, and every automation commit rides the committer's own credentials.
- The dependency maintenance workflow commits with `GITHUB_TOKEN`, so its weekly commit does not trigger CI; it validates the refreshed lockfile inside the workflow before committing.
- Every automation commit must stay format-clean (`prettier --check .` gates CI): the on-demand pin sweep writes single-space pin comments, and any future automation writer must run prettier on `.github/workflows/` before committing. Keep new automation writers inside that contract.
- A failed scheduled run sends notifications on purpose (the guardian contract). Fix the cause; do not disable a lane silently.

## Data Safety Rules

Do not delete, rename, or migrate these without a compatibility plan:

- `STORAGE_KEYS.HISTORY` / `bmi.history` (localStorage)
- `STORAGE_KEYS.BMI_GOAL` / `bmi.goal` (localStorage)
- `STORAGE_KEYS.BMI_GOAL_START` / `bmi.goal.start` (localStorage)
- `STORAGE_KEYS.UNIT_SYSTEM` / `bmi.unitSystem` (localStorage)
- `STORAGE_KEYS.LOCALE` / `bmi.locale` (localStorage)
- OPFS file `vault-backup.json` (night-frontier-Z4: the flush-written vault tier, the latest backup snapshot as the second durable home; restore falls back to it when the IndexedDB rotation is gone — never edit it by hand, never add files to the OPFS root, the P3 inventory law asserts it stays exactly this one; since night-frontier-Z7 the snapshot's witness entry is a CONSUMED anchor — the tri-home law consults it before any unanchored re-anchor)
- IndexedDB `meta` store entry `__history_chain_head` (the continuity witness, night-frontier-Z3: JSON `{ head, length }` for a plain witness; night-frontier-Z6 adds `{ mode: 'keyed', kf }` for a passphrase-protected ledger — `kf` is the public SHA-256 fingerprint of the attestation key, never secret material; a restore tombstones it to an empty string for pre-Z3 snapshots - never delete it without clearing `bmi.history`, never rewrite it outside a legit write)
- IndexedDB `meta` store entry `__encryption_verifier` (AES-GCM ciphertext of known verifier plaintext; never the passphrase itself)
- IndexedDB `meta` store entry `__at_rest_salt` (device-local at-rest salt; not secret, defeats precomputation only)
- At-rest seal format `bmi-at-rest-v1` (sealed health values behind the same storage keys; readable only with the ledger passphrase)
- Storage origin marked persistent via `navigator.storage.persist()` (eviction resistance; a denial is reported, not hidden)
- IndexedDB write transactions carry `durability: 'strict'` (fsync-at-commit hint; a hint per spec, honored on Baseline-2024 engines)
- IndexedDB `backups` store (encrypted backup blobs)
- Encrypted backup format `bmi-encrypted-v3` (legacy `bmi-encrypted-v1` readable)
- Argon2id and PBKDF2 legacy import support

BMI inputs, history, goals, encryption verifier data, and backups are device-local. Do not introduce an app backend for health data.

## PWA Offline Smoke Test

Use a production build or deployed preview.

1. Open the app online.
2. Navigate through Welcome, Calculator, Gauge, Reference, About, and Info.
3. Install the PWA.
4. Close all app/browser tabs.
5. Disable network.
6. Open the installed PWA.
7. Expected result: the real BMI Stellar app shell opens. The black `BMI Stellar is offline` fallback should not appear if the app shell was previously cached.
8. Re-enable network and refresh once to confirm updates still work.

Always run `bun run audit:pwa-offline` after changing [src/service-worker.ts](src/service-worker.ts).

## Release/Deploy Notes

- Local production build: `bun run build`
- Preview production build: `bun run preview`
- Vercel runtime: `nodejs26.x` in workflows
- Release tags: `v<major>.<minor>.<patch>` (pre-release: `-<suffix>`)
- Version sync: `bun run bmi-update-version <version>`

Do not edit version strings manually across files.

## Dependency Policy

- Prefer minimal compatible updates.
- Keep `bun.lock` committed.
- Use `bun install --frozen-lockfile` in CI.
- Run `bun run audit:deps` (policy-gated scan) after dependency changes. It fails on critical/high/moderate advisories unless an unexpired entry in `scripts/audit-allowlist.json` accepts them; low advisories warn without blocking.
- Keep dependency update automation PR-first unless an emergency hotfix requires direct push.
- Avoid adding runtime dependencies for small scripts or maintenance checks.
- Avoid a bare `bun update --lockfile-only`: it rewrites the manifest ranges in `package.json` and can inject major overrides. Make targeted override bumps per advisory instead (the weekly workflow already restores `package.json` after its refresh).
- The engine dependency tree rides a structural supply-chain policy (night-supply-1): `argon2` is exact-pinned (`=0.6.0`) and, since night-frontier-Z6, the keystore seat's `hmac` (`=0.12.1`) and `sha2` (`=0.10.9`) ride the same exact-pin rule; `engine/argon2id/deny.toml` denies git sources, unknown registries, duplicate versions, and yanked crates, and `cargo deny check bans sources` blocks every push and every swept lane. The cargo-deny scanner installs through a committed digest (`scripts/ci/install-cargo-deny.sh`) — never fetch-executed. Cargo never executes in a job that holds write permission: build gates run read-only, commit jobs only copy and stage files.
- Run `bun run audit:supply-chain` after any manifest, lockfile, or CI change: it pins the registry-only ranges, the empty lifecycle-script trust list, the no-unpinned-fetch and no-pipe-exec rules across workflows and scripts, the well-formed recorded lock checksums, and the engine exact-pin plus deny.toml verdicts.

## Core Code Rules

- Core `*.ts`, `*.js`, `*.svelte`, and `*.css` files must stay under 1000 LOC.
- Split large files by domain, component, or service ownership.
- Keep source/config copyright and SPDX headers intact.
- Do not add headers to Markdown, text files, generated output, build artifacts, dependencies, or coverage.

## Security Boundaries

- Never log passphrases, derived keys, verifier plaintext, decrypted backups, encrypted backup payloads, or raw health history.
- Do not weaken Argon2id, AES-GCM, checksum, or verifier behavior without focused tests.
- Treat service worker changes as security-sensitive.
- Hosted telemetry must never receive BMI values, history, passphrases, keys, backup payloads, or decrypted imports.

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
