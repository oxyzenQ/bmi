<!--
  SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
  SPDX-License-Identifier: AGPL-3.0-only OR Commercial
-->

# Release Process

## How to Release

```bash
# 1. Verify everything passes
bun run verify

# 2. Update version (syncs package.json, README.md, DORMANT.md, CHANGELOG.md)
./scripts/dev/version-to.sh <version>   # the zelynic-style direct entry
bun run bmi-update-version <version>    # the same manager through bun
#   CHANGELOG.md gets two automatic writes: the bare vX.Y.Z line in the
#   ## [Released] ledger (newest first) and the ## [X.Y.Z] release
#   section spliced into the Released area, right after the ledger,
#   pre-filled from git history or the migrated Unreleased bullets -
#   never under ## [Unreleased], which sits at the bottom of the file
#   and starts fresh after every release. The draft states the what -
#   write the why by hand before tagging.
git add -A && git commit -m "chore: prepare for release v<major>.<minor>.<patch>"
git push origin main

# 3. Tag and push
git tag v<major>.<minor>.<patch>
git push origin v<major>.<minor>.<patch>
```

The workflow validates the tag format (`v<major>.<minor>.<patch>`, with an optional pre-release suffix like `-night.1`) and exact version match, builds a static archive, generates a commit-based changelog, and publishes the GitHub Release with source + build artifacts.

## Artifacts

| File                           | Contents                              |
| ------------------------------ | ------------------------------------- |
| `bmi-stellar-source-{tag}.zip` | Full source, rebuild from scratch     |
| `bmi-stellar-build-{tag}.zip`  | Pre-built static output, deploy ready |
| `*.sha512sum`                  | Integrity checksums (SHA-512)         |
| `*.b3sum`                      | Integrity checksums (BLAKE3)          |
| `*.shake256`                   | Integrity checksums (SHAKE256)        |

The source archive is a self-verifying tree: it ships the config
dotfiles (`.prettierrc`, `.prettierignore`, `.gitignore`,
`.codespellrc`, `.npmrc`, `.tool-versions`, `.yamllint`), the
`.githooks/` tree, and the license-law documents (`BRANDING.md`,
`DORMANT.md`, `RULES.md`, `NOTICE`, `TRADEMARK.md`), so `./verify.sh`
passes inside the extracted zip — no git clone required. The
packaging step hard-fails if any expected file is missing from the
checkout, and a post-zip manifest gate reads the finished archive
back and requires `package.json` and the verify-critical dotfiles at
the archive root (the night-netrunner-1 fix for the v80.5.1 zip that
failed `format:check` with 202 warnings as shipped).

## Tag Format

`v<major>.<minor>.<patch>` — must match `package.json` exactly.

A suffix (`v<major>.<minor>.<patch>-<suffix>`, e.g. `v80.0.0-night.1`) publishes a pre-release: GitHub flags the release with the Pre-release badge and it is never marked "latest", while stable release notes span from the nearest previous stable tag. The suffix is free-form (`beta.1`, `rc.2`, `night.7`) — the tag shape is the channel, no whitelist to maintain.

## Rollback

Fix forward on `main`. If a hotfix is needed, create a new release tag rather than moving an existing published tag.

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
