# Release Process

## How to Release

```bash
# 1. Verify everything passes
bun run verify

# 2. Update version (syncs package.json, README.md, DORMANT.md, CHANGELOG.md)
./scripts/dev/version-to.sh <version>   # the zelynic-style direct entry
bun run bmi-update-version <version>    # the same manager through bun
git add -A && git commit -m "chore: prepare for release Stellar-v<major>.<minor>"
git push origin main

# 3. Tag and push
git tag Stellar-v<major>.<minor>
git push origin Stellar-v<major>.<minor>
```

The workflow validates the tag format (`Stellar-v<major>.<minor>`) and version match, builds a static archive, generates a commit-based changelog, and publishes the GitHub Release with source + build artifacts.

## Artifacts

| File                           | Contents                              |
| ------------------------------ | ------------------------------------- |
| `bmi-stellar-source-{tag}.zip` | Full source, rebuild from scratch     |
| `bmi-stellar-build-{tag}.zip`  | Pre-built static output, deploy ready |
| `*.sha512`                     | Integrity checksums                   |

## Tag Format

`Stellar-v<major>.<minor>` — must match `package.json` major.minor.

## Rollback

Fix forward on `main`. If a hotfix is needed, create a new release tag rather than moving an existing published tag.
