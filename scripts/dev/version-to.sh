#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# BMI STELLAR VERSION MANAGER
#
# The zelynic dev/version-to.sh shape carrying the BMI Stellar surfaces:
# one command moves every version surface so the surfaces can never
# drift. package.json is the single source of truth (the role Cargo.toml
# plays in zelynic); scripts/build.sh -V and the doctor banner read it
# live, so they auto-derive and need no rewrite here.
#
# Usage:
#   ./scripts/dev/version-to.sh                     # current version + usage
#   ./scripts/dev/version-to.sh v21.9.0             # set an absolute version (v-prefix optional)
#   ./scripts/dev/version-to.sh v80.0.0-night.1     # a pre-release target, same four surfaces
#   ./scripts/dev/version-to.sh patch|minor|major   # bump word from the current version
#   ./scripts/dev/version-to.sh <target> --dry-run  # preview every rewrite, write nothing
#   ./scripts/dev/version-to.sh <target> --commit   # update, then stage + commit the surfaces
#
# Surfaces updated (the night-improve-3 contracts, unchanged from the
# TypeScript tool this file replaces):
#   package.json  "version" - the source of truth, full X.Y.Z
#   README.md     the "Current release: `vX.Y.Z`" line, the "BMI Stellar
#                 vX.Y.Z" display title, the "badge/version-vX.Y.Z-" badge
#                 URL, and the 'alt="Version vX.Y.Z"' alt - full vX.Y.Z
#   DORMANT.md    the "Version: `X.Y.Z`" capsule line - full X.Y.Z
#   CHANGELOG.md  the "## [X.Y.Z]" release heading spliced
#                 directly under "## [Unreleased]" (Keep a Changelog)
#
# A pre-release target (X.Y.Z-<suffix>, e.g. 80.0.0-night.1) moves the
# same four surfaces - the suffix rides every pattern below.
#
# Honest probes, the zelynic NIGHT-hunt-32 rule: a missing file, a
# missing surface, or an already-recorded version warns and writes
# nothing - never claim a write that did not happen. --commit refuses
# an unchanged tree and stages only the four surfaces, so a version
# commit can never smuggle unrelated work in.
#
# Self-contained bash (no bun, no node): the dev lane runs everywhere
# git runs, the zelynic dev/ convention.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${SCRIPT_DIR}"

ok()   { printf '  \033[0;32mOK\033[0m %s\n' "$1"; }
same() { printf '  \033[0;36m•\033[0m %s\n' "$1"; }
warn() { printf '  \033[0;33m!\033[0m %s\n' "$1"; }
die()  { printf '\033[0;31mError: %s\033[0m\n' "$1" >&2; exit 1; }

# Read the current version from package.json (single source of truth).
# The first "version" key in the file is the package version - the same
# first-match contract the TypeScript tool's non-global replace owned.
current_version() {
        sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' package.json 2>/dev/null | head -1 || true
}

validate_version() {
        if ! printf '%s' "$1" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?$'; then
                die "invalid version '$1' - expected X.Y.Z or X.Y.Z-<suffix> (or the patch|minor|major bump words)"
        fi
}

show_usage() {
        printf '\033[0;36mBMI Stellar version manager\033[0m - the zelynic dev lane shape\n'
        printf '\n'
        printf 'Usage:\n'
        printf '  ./scripts/dev/version-to.sh                     show the current version\n'
        printf '  ./scripts/dev/version-to.sh v<VERSION>          set an absolute version (v-prefix optional)\n'
        printf '  ./scripts/dev/version-to.sh patch|minor|major   bump from the current version\n'
        printf '  ./scripts/dev/version-to.sh <target> --dry-run  preview every rewrite, write nothing\n'
        printf '  ./scripts/dev/version-to.sh <target> --commit   update, then stage + commit the surfaces\n'
        printf '\n'
        printf 'Surfaces: package.json (source of truth), README.md (vX.Y.Z),\n'
        printf 'DORMANT.md (X.Y.Z), CHANGELOG.md (release heading).\n'
}

TMP_WORK="$(mktemp)"
trap 'rm -f "${TMP_WORK}" "${TMP_WORK}.out"' EXIT

DRY_RUN=false
COMMIT=false
POSITIONAL=""
for arg in "$@"; do
        case "${arg}" in
        --dry-run) DRY_RUN=true ;;
        --commit | -c) COMMIT=true ;;
        -h | --help)
                show_usage
                exit 0
                ;;
        -*) die "unknown option: ${arg} (run with no arguments for usage)" ;;
        *)
                if [ -n "${POSITIONAL}" ]; then
                        die "unexpected extra argument '${arg}' - exactly one version target is allowed"
                fi
                POSITIONAL="${arg}"
                ;;
        esac
done

if [ "${DRY_RUN}" = true ] && [ "${COMMIT}" = true ]; then
        die "--dry-run and --commit are mutually exclusive - choose one"
fi

# The bare call, the zelynic no-argument shape: show the current
# version and the usage, touch nothing.
if [ -z "${POSITIONAL}" ]; then
        if [ "${DRY_RUN}" = true ] || [ "${COMMIT}" = true ]; then
                die "no version target given (patch|minor|major or X.Y.Z)"
        fi
        [ -f package.json ] || die "package.json not found - run from the repository root"
        CURRENT="$(current_version)"
        [ -n "${CURRENT}" ] || die "cannot read the version from package.json"
        printf 'Current version: \033[0;32mv%s\033[0m (package.json)\n' "${CURRENT}"
        printf '\n'
        show_usage
        exit 0
fi

[ -f package.json ] || die "package.json not found - run from the repository root"
CURRENT="$(current_version)"
[ -n "${CURRENT}" ] || die "cannot read the version from package.json"

case "${POSITIONAL}" in
patch | minor | major)
        # Bump words operate on the numeric core: from a pre-release
        # current (80.0.0-night.1) they produce the next STABLE target
        # (patch -> 80.0.1); pre-release iterations use an absolute
        # target (v80.0.0-night.2).
        IFS='.' read -r major minor patch <<<"${CURRENT%%-*}"
        case "${POSITIONAL}" in
        patch) NEW="${major}.${minor}.$((patch + 1))" ;;
        minor) NEW="${major}.$((minor + 1)).0" ;;
        major) NEW="$((major + 1)).0.0" ;;
        esac
        ;;
*) NEW="${POSITIONAL#v}" ;;
esac
validate_version "${NEW}"

CHANGED=0

printf '\n'
printf '\033[0;36m  BMI Stellar - Version Manager\033[0m\n'
printf '  Current: %s\n' "${CURRENT}"
printf '  Target:  %s\n' "${NEW}"
if [ "${DRY_RUN}" = true ]; then
        printf '  Mode:    \033[0;33mDRY RUN\033[0m\n'
fi
printf '\n'

if [ "${CURRENT}" = "${NEW}" ]; then
        printf '  package.json already carries the target version; syncing the display surfaces.\n'
        printf '\n'
fi

# --- package.json (source of truth) ---
# The first "version" key moves; dependency entries and every other
# line pass through untouched. awk keeps the original spacing and the
# trailing comma exactly as prettier formatted them.
cp package.json "${TMP_WORK}"
awk -v ver="${NEW}" 'BEGIN { done = 0 }
        !done && /^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?"/ {
                sub(/"[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?"/, "\"" ver "\"")
                done = 1
        }
        { print }
' package.json >"${TMP_WORK}"
if cmp -s package.json "${TMP_WORK}"; then
        same "package.json - already at ${NEW}"
elif [ "${DRY_RUN}" = true ]; then
        CHANGED=1
        same "package.json - would set ${NEW} (dry run)"
else
        cp "${TMP_WORK}" package.json
        CHANGED=1
        ok "package.json - version ${NEW} (source of truth)"
fi

# --- README.md (the four display surfaces, short vX.Y) ---
# Probed first, the NIGHT-hunt-32 rule: a surface that is absent warns
# instead of claiming a rewrite that never happened.
if [ ! -f README.md ]; then
        warn "README.md - file absent, nothing to write"
else
        EXPR=()
        FOUND=0
        if grep -qE "Current release: \`v[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?\`" README.md; then
                FOUND=$((FOUND + 1))
                EXPR+=(-e "s/Current release: \`v[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?\`/Current release: \`v${NEW}\`/g")
        else
                warn "README.md current-release line - surface absent, nothing to rewrite"
        fi
        if grep -qE 'BMI Stellar v[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?' README.md; then
                FOUND=$((FOUND + 1))
                EXPR+=(-e "s/BMI Stellar v[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?/BMI Stellar v${NEW}/g")
        else
                warn "README.md display title - surface absent, nothing to rewrite"
        fi
        if grep -qE 'badge/version-v[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?-' README.md; then
                FOUND=$((FOUND + 1))
                EXPR+=(-e "s/badge\/version-v[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?-/badge\/version-v${NEW}-/g")
        else
                warn "README.md version badge - surface absent, nothing to rewrite"
        fi
        if grep -qE 'alt="Version v[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?"' README.md; then
                FOUND=$((FOUND + 1))
                EXPR+=(-e "s/alt=\"Version v[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?\"/alt=\"Version v${NEW}\"/g")
        else
                warn "README.md badge alt text - surface absent, nothing to rewrite"
        fi
        if [ "${FOUND}" -eq 0 ]; then
                warn "README.md - no version surface found, nothing to rewrite"
        else
                cp README.md "${TMP_WORK}"
                sed -E -i "${EXPR[@]}" "${TMP_WORK}"
                if cmp -s README.md "${TMP_WORK}"; then
                        same "README.md - all ${FOUND} present surface(s) already current"
                elif [ "${DRY_RUN}" = true ]; then
                        CHANGED=1
                        same "README.md - would rewrite ${FOUND} surface(s) to v${NEW} (dry run)"
                else
                        cp "${TMP_WORK}" README.md
                        CHANGED=1
                        ok "README.md - ${FOUND} surface(s) rewritten to v${NEW}"
                fi
        fi
fi

# --- DORMANT.md (the maintenance capsule, full X.Y.Z) ---
if [ ! -f DORMANT.md ]; then
        warn "DORMANT.md - file absent, nothing to write"
elif ! grep -qE "Version: \`[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?\`" DORMANT.md; then
        warn "DORMANT.md - no Version capsule line found, nothing to write"
else
        cp DORMANT.md "${TMP_WORK}"
        sed -E -i "s/Version: \`[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?\`/Version: \`${NEW}\`/g" "${TMP_WORK}"
        if cmp -s DORMANT.md "${TMP_WORK}"; then
                same "DORMANT.md - capsule already at ${NEW}"
        elif [ "${DRY_RUN}" = true ]; then
                CHANGED=1
                same "DORMANT.md - would set the capsule to ${NEW} (dry run)"
        else
                cp "${TMP_WORK}" DORMANT.md
                CHANGED=1
                ok "DORMANT.md - capsule version ${NEW}"
        fi
fi

# --- CHANGELOG.md (the release heading under ## [Unreleased]) ---
# The Keep a Changelog splice: the version heading lands directly under
# the Unreleased anchor, so the unreleased bullets become the release's
# bullets and Unreleased starts fresh on the next edit. An
# already-recorded version or a missing anchor writes nothing.
if [ ! -f CHANGELOG.md ]; then
        warn "CHANGELOG.md - file absent, nothing to write"
elif grep -qF "## [${NEW}]" CHANGELOG.md; then
        same "CHANGELOG.md - ${NEW} already recorded, nothing to write"
elif ! grep -q '^## \[Unreleased\]$' CHANGELOG.md; then
        warn "CHANGELOG.md - no ## [Unreleased] anchor found, nothing to write"
else
        awk -v heading="## [${NEW}]" 'BEGIN { done = 0 }
                /^## \[Unreleased\]$/ && !done {
                        print
                        print ""
                        print heading
                        done = 1
                        next
                }
                { print }
        ' CHANGELOG.md >"${TMP_WORK}"
        if [ "${DRY_RUN}" = true ]; then
                CHANGED=1
                same "CHANGELOG.md - would splice ## [${NEW}] under ## [Unreleased] (dry run)"
        else
                mv "${TMP_WORK}" CHANGELOG.md
                CHANGED=1
                ok "CHANGELOG.md - release heading ## [${NEW}] spliced under ## [Unreleased]"
        fi
fi

printf '\n'
if [ "${CHANGED}" -eq 0 ]; then
        printf '\033[0;33mAlready at v%s, nothing to change.\033[0m\n' "${NEW}"
        exit 0
fi

if [ "${DRY_RUN}" = true ]; then
        printf '\033[0;32mPreview: %s -> v%s - nothing written.\033[0m\n' "${CURRENT}" "${NEW}"
        printf '\n'
        exit 0
fi

printf '\033[0;32mVersion updated to v%s.\033[0m\n' "${NEW}"
printf 'next: git add package.json README.md DORMANT.md CHANGELOG.md && git commit\n'

# --- --commit (the zelynic auto-commit shape) ---
# Stages exactly the four surfaces, refuses an unchanged tree, and
# commits with the .github/RELEASE.md message convention. The repo's
# pre-commit gate (scripts/gates/check-commit-gate.sh) still runs on
# the commit - a version bump rides the same gates as everything else.
if [ "${COMMIT}" = true ]; then
        if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
                die "--commit refused: not inside a git work tree"
        fi
        for surface in package.json README.md DORMANT.md CHANGELOG.md; do
                if [ -f "${surface}" ]; then
                        git add "${surface}"
                fi
        done
        if git diff --cached --quiet; then
                warn "nothing staged - the surfaces carry no change to commit"
                exit 0
        fi
        git commit -m "chore: prepare for release v${NEW}"
        ok "Committed: chore: prepare for release v${NEW}"
fi
