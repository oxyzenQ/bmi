# BMI Stellar Dormant Maintenance Guide

This guide is the wake-up checklist for BMI Stellar after a quiet period of 1-5 years.

## Current Capsule

- App: BMI Stellar
- Version: `80.0.3`
- Runtime: Bun `1.3.11` from `package.json#packageManager`
- Node range: `>=22 <25`
- Framework: SvelteKit 2, Svelte 5, TypeScript
- Deployment target: Vercel with `@sveltejs/adapter-vercel`
- License: AGPL-3.0-only, enforced in source headers as `AGPL-3.0-only`

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

This mirrors `.github/workflows/ci.yml` step-by-step (format:check → audit:deps → audit:loc → audit:headers → audit:branding → audit:pwa-offline → check → lint → test:ci → build). The lighter `bun run verify` is acceptable for quick local iteration but skips `audit:deps` and uses `test:run` instead of `test:ci`.

4. If the frozen install fails because the ecosystem moved, upgrade Bun/Node first, then make dependency changes in a dedicated maintenance commit.
5. If `audit:deps` fails because new advisories were published against pinned transitive deps during the dormant period, bump the relevant `overrides` in `package.json` (do not weaken crypto deps). If no fixed release exists within the pinned major, add a temporary entry with a reason and an expiry to `scripts/audit-allowlist.json` instead of weakening the gate. Re-run `bun install` then `./scripts/build.sh check-all`.
6. If CI fails only because GitHub Actions runners/actions changed, update workflow actions without touching app behavior.

## CI During Dormancy

- Scheduled guardians run weekly in UTC: dependency maintenance (Monday 00:00), security audit (Monday 00:30), actions self-heal (Monday 00:00), CodeQL (Monday 03:00), and the runtime probe (Sunday 01:00).
- GitHub disables scheduled workflows after 60 days without repository activity and sends one notice. This is expected while dormant; re-enable each workflow from the Actions tab (or `gh workflow enable <name>`) as part of wake-up.
- The actions self-heal and runtime probe push with `PAT_WORKFLOW`. If that secret expires while dormant, both lanes fail weekly until it is rotated in GitHub settings.
- The dependency maintenance workflow commits with `GITHUB_TOKEN`, so its weekly commit does not trigger CI; it validates the refreshed lockfile inside the workflow before committing.
- Every automation commit must stay format-clean (`prettier --check .` gates CI): the self-heal sweep writes single-space pin comments and the runtime probe runs prettier on `.github/workflows/` before committing. Keep new automation writers inside that contract.
- A failed scheduled run sends notifications on purpose (the guardian contract). Fix the cause; do not disable a lane silently.

## Data Safety Rules

Do not delete, rename, or migrate these without a compatibility plan:

- `STORAGE_KEYS.HISTORY` / `bmi.history` (localStorage)
- `STORAGE_KEYS.BMI_GOAL` / `bmi.goal` (localStorage)
- `STORAGE_KEYS.BMI_GOAL_START` / `bmi.goal.start` (localStorage)
- `STORAGE_KEYS.UNIT_SYSTEM` / `bmi.unitSystem` (localStorage)
- `STORAGE_KEYS.LOCALE` / `bmi.locale` (localStorage)
- IndexedDB `meta` store entry `__encryption_verifier` (AES-GCM ciphertext of known verifier plaintext; never the passphrase itself)
- IndexedDB `backups` store (encrypted backup blobs)
- Encrypted backup format `bmi-encrypted-v3` (legacy `bmi-encrypted-v1` readable)
- Argon2id and PBKDF2 legacy import support

BMI inputs, history, goals, encryption verifier data, and backups are device-local. Do not introduce an app backend for health data.

## PWA Offline Smoke Test

Use a production build or deployed preview.

1. Open the app online.
2. Navigate through Home, Calculator, Gauge, Reference, About, and Settings.
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
- Vercel runtime: `nodejs24.x` in workflows
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
