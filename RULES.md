# BMI Stellar Engineering Rules

## Line Count Discipline

Core code files must stay under 1000 lines of code.

This rule applies to:

- `*.ts`
- `*.js`
- `*.svelte`
- `*.css`
- other core source extensions if they are introduced later

This rule excludes:

- `*.md`
- `*.txt`
- generated output
- dependency folders
- build artifacts
- `.svelte-kit`
- `.vercel/output`
- `node_modules`
- `dist`
- `build`
- coverage
- `.git`

When a core file approaches the limit, split by domain, component, or service ownership. Do not perform cosmetic slicing just to move lines around.

## Repository Layout - scripts/

The scripts tree follows the zelynic gate discipline: one gate per file, one
wholesale orchestrator, nothing loose at the tree root.

- `scripts/build.sh` - the build/check orchestrator (mirrors the CI workflow)
- `scripts/gates/` - atomic audit gates, one concern per file (`check-loc.ts`,
  `check-headers.ts`, `check-branding.ts`, `check-pwa-offline-shell.ts`,
  `audit-deps.ts`)
- `scripts/dev/` - developer tools (`version-to.ts` version manager)
- `scripts/ci/` - CI-lane helpers invoked by GitHub Actions workflows
- `scripts/lib/` - shared code imported by gates (`audit-core-files.ts`)
- `scripts/audit-allowlist.json` - gate data for the dependency-audit policy

New gates land in `scripts/gates/`; new CI helpers land in `scripts/ci/`.
Nothing else lives at the `scripts/` root.
