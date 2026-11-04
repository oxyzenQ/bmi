# Release Process

## How to Release

```bash
# 1. Verify everything passes
bun run verify

# 2. Update version (syncs package.json, README.md, DORMANT.md, CHANGELOG.md)
./scripts/dev/version-to.sh <version>   # the zelynic-style direct entry
bun run bmi-update-version <version>    # the same manager through bun
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
| `*.sha512sum`                  | Integrity checksums                   |

## Tag Format

`v<major>.<minor>.<patch>` — must match `package.json` exactly.

A suffix (`v<major>.<minor>.<patch>-<suffix>`, e.g. `v80.0.0-night.1`) publishes a pre-release: GitHub flags the release with the Pre-release badge and it is never marked "latest", while stable release notes span from the nearest previous stable tag. The suffix is free-form (`beta.1`, `rc.2`, `night.7`) — the tag shape is the channel, no whitelist to maintain.

## Rollback

Fix forward on `main`. If a hotfix is needed, create a new release tag rather than moving an existing published tag.
