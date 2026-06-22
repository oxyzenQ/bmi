# BMI Stellar Dormant Maintenance Guide

This guide is the wake-up checklist for BMI Stellar after a quiet period of 1-5 years.

## Current Capsule

- App: BMI Stellar
- Version: `21.6.0`
- Runtime: Bun `1.3.11` from `package.json#packageManager`
- Node range: `>=22 <25`
- Framework: SvelteKit 2, Svelte 5, TypeScript
- Deployment target: Vercel with `@sveltejs/adapter-vercel`
- License: GPL-3.0, enforced in source headers as `GPL-3.0-only`

## Wake-Up Order

1. Install the pinned toolchain if possible.
2. Run `bun install --frozen-lockfile`.
3. Run the validation gate:

```bash
bun run format:check
bun run audit:loc
bun run audit:headers
bun run audit:pwa-offline
bun run check
bun run lint
bun run test:ci
bun run build
bun audit
```

4. If the frozen install fails because the ecosystem moved, upgrade Bun/Node first, then make dependency changes in a dedicated maintenance commit.
5. If CI fails only because GitHub Actions runners/actions changed, update workflow actions without touching app behavior.

## Data Safety Rules

Do not delete, rename, or migrate these without a compatibility plan:

- `STORAGE_KEYS.HISTORY` / `bmi.history`
- `STORAGE_KEYS.BMI_GOAL`
- `STORAGE_KEYS.BMI_GOAL_START`
- passphrase hint storage
- IndexedDB key-value store
- IndexedDB `backups` store
- encrypted backup format `bmi-encrypted-v1`
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
- Release tags: `Stellar-v<major>.<minor>`
- Version sync: `bun run bmi-update-version <version>`

Do not edit version strings manually across files.

## Dependency Policy

- Prefer minimal compatible updates.
- Keep `bun.lock` committed.
- Use `bun install --frozen-lockfile` in CI.
- Run `bun audit` after dependency changes.
- Keep dependency update automation PR-first unless an emergency hotfix requires direct push.
- Avoid adding runtime dependencies for small scripts or maintenance checks.

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

## Expected Aging Risks

After 1 year, the app should usually wake with normal dependency refreshes.

After 2-3 years, expect possible GitHub Actions, Bun, SvelteKit, Vite, or Vercel maintenance.

After 5 years, expect a toolchain refresh before deployment. The app data model and offline-first behavior should remain recoverable if the safety rules above are preserved.
