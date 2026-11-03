# BMI Stellar Engineering Rules

## Line Count Discipline

The zelynic-aligned three-tier LOC law:

- **1000 lines - the hard cap.** Every core code file stays under 1000 lines
  of code. No exceptions, no markers.
- **600 lines - the ratchet.** Any core file at or above 600 lines is recorded
  with its exact count in `scripts/loc-ratchet.json` and may never grow past
  that watermark. A new file crossing 600 fails the gate until its entry is
  added by hand (visible debt in the diff). A file that shrinks below 600
  must have its entry removed in the same change - the debt ledger only
  shrinks, never grows.
- **1000 lines - scripts.** Every `.sh`/`.py` under `scripts/` stays under
  1000 lines (enforced by `scripts/gates/check-scripts-loc.sh`). A script
  that cannot split the same hour self-declares one honest IOU comment:
  `# LOC_EXEMPT: <justification>`.

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

When a core file approaches a limit, split by domain, component, or service ownership. Do not perform cosmetic slicing just to move lines around.

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
