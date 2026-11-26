#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial

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
#   CHANGELOG.md  two writes (night-log-2, the night-log-1 lesson: the
#                 old empty splice let 80.0.0-80.0.4 and 80.0.6 ship as
#                 bare headings nobody filled):
#                 1. the zelynic Released ledger (NIGHT-improve-76
#                    shape): "## [Released]" gains the bare "vX.Y.Z"
#                    line under the blank spacer, newest first;
#                    created on first use, backfilled from the repo's
#                    v* tags (newest first by tag creation date)
#                 2. the "## [X.Y.Z]" release section is never an
#                    empty heading and never lands under
#                    "## [Unreleased]" - it splices into the Released
#                    area, right after the ledger, newest first
#                    (night-log-3): existing Unreleased bullets
#                    migrate into it (the Keep a Changelog release
#                    event), an empty Unreleased autofills from git
#                    history (commits since the nearest previous
#                    reachable tag, grouped feat/fix/chore/rest into
#                    Added/Changed/Fixed/Chore bullets with short
#                    SHAs), and no reachable tag or an empty range
#                    splices an italic manual-fill note instead - the
#                    draft states the what, the why gets written by
#                    hand before the tag. "## [Unreleased]" lives at
#                    the bottom of the file and starts fresh after
#                    every release; the first-use run relocates it
#                    there from wherever it sat
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

# --- CHANGELOG helpers (the night-log-2 ledger + autofill contract) ---

# The repo's v* tags in the zelynic ledger order: newest first by tag
# creation date. creatordate, not version sort - the ledger records
# when a version shipped, so a pre-release sits below the stable that
# superseded it, wherever version order would rank it.
release_tag_list() {
        git for-each-ref --sort=-creatordate --format='%(refname:short)' 'refs/tags/v*' 2>/dev/null
}

# The numeric core of a version string - everything before a -suffix.
version_core() {
        printf '%s' "$1" | sed 's/-.*//'
}

# The nearest previous tag BELOW the target that HEAD can actually
# reach. Squashed history (the 2026-11 re-root) left the older tags on
# a disconnected lineage, so reachability is probed per tag, never
# assumed: the first tag in newest-first order whose numeric core is
# below the target's AND that is an ancestor of HEAD wins. Prints the
# v-prefixed tag name; fails when nothing qualifies.
autofill_base_tag() {
        local tgt_core tgt_num t t_core t_num
        tgt_core="$(version_core "${NEW}")"
        IFS=. read -r a b c <<<"${tgt_core}"
        tgt_num=$((a * 1000000 + b * 1000 + c))
        while IFS= read -r t; do
                t_core="$(version_core "${t#v}")"
                IFS=. read -r a b c <<<"${t_core}"
                t_num=$((a * 1000000 + b * 1000 + c))
                if [ "${t_num}" -lt "${tgt_num}" ] && git merge-base --is-ancestor "${t}" HEAD >/dev/null 2>&1; then
                        printf '%s\n' "${t}"
                        return 0
                fi
        done < <(release_tag_list)
        return 1
}

# Every line between the Unreleased anchor and the next release heading
# (or a --- separator): the bullets the owner wrote since the last
# release, which migrate into the new release section verbatim.
unreleased_body() {
        awk '
                /^## \[Unreleased\]$/ { inu = 1; next }
                inu && (/^## \[/ || /^---$/) { exit }
                inu { print }
        ' CHANGELOG.md
}

# Strip leading and trailing blank lines, dependency-free - the body
# must land as exactly one blank between the heading and its content.
trim_blank_edges() {
        awk '{ l[NR] = $0 } END { n = NR; while (n > 0 && l[n] == "") n--; s = 1; while (s <= n && l[s] == "") s++; for (i = s; i <= n; i++) print l[i] }'
}

# Print CHANGELOG.md lines [start, end] (end empty = through EOF). An
# inverted range prints nothing - GNU sed prints the start line of an
# inverted range once instead, which would duplicate a heading mid-splice.
sed_lines() {
        if [ -n "${2}" ] && [ "${2}" -ge "${1}" ]; then
                sed -n "${1},${2}p" CHANGELOG.md
        elif [ -z "${2}" ]; then
                sed -n "${1},\$p" CHANGELOG.md
        fi
}

# Append one block to a composition being built on stdout: trim its
# blank edges, then emit it with one leading blank line only when it
# survives the trim - an empty block never leaves a stray blank behind.
emit_block() {
        trim_blank_edges <"$1" >"${TMP_WORK}.piece"
        if [ -s "${TMP_WORK}.piece" ]; then
                printf '\n'
                cat "${TMP_WORK}.piece"
        fi
}

# Compose the spliced CHANGELOG on stdout: the file arguments arrive in
# order, the first surviving piece prints trimmed and bare, every
# following piece prints as one blank line plus its trimmed content, and
# the file ends on a fresh "## [Unreleased]" anchor - so every boundary
# in the composed file carries exactly one blank line.
compose_splice() {
        first=1
        for piece in "$@"; do
                trim_blank_edges <"${piece}" >"${TMP_WORK}.piece"
                if [ -s "${TMP_WORK}.piece" ]; then
                        if [ "${first}" -eq 0 ]; then
                                printf '\n'
                        fi
                        cat "${TMP_WORK}.piece"
                        first=0
                fi
        done
        printf '\n## [Unreleased]\n'
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
	printf 'DORMANT.md (X.Y.Z), CHANGELOG.md (Released ledger + the\n'
	printf 'pre-filled release section).\n'
}

TMP_WORK="$(mktemp)"
trap 'rm -f "${TMP_WORK}" "${TMP_WORK}.out" "${TMP_WORK}.raw" "${TMP_WORK}.body" "${TMP_WORK}.section" "${TMP_WORK}.ledger" "${TMP_WORK}.head" "${TMP_WORK}.stack" "${TMP_WORK}.unrel" "${TMP_WORK}.piece" "${TMP_WORK}.p1" "${TMP_WORK}.p2" "${TMP_WORK}.p3"' EXIT

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

# --- CHANGELOG.md (the Released ledger + the pre-filled release section) ---
# Two writes, one command (night-log-2, the night-log-1 lesson: the old
# empty splice let 80.0.0-80.0.4 and 80.0.6 ship as bare headings nobody
# filled):
# 1. The zelynic Released ledger (NIGHT-improve-76): "## [Released]" with
#    the bare vX.Y.Z lines, newest first by tag creation date. Created on
#    first use with a backfill from the repo's v* tags - spliced in after
#    the header prose, never rebuilt from the anchor down (the night-log-3
#    fix: that rebuild used to eat the header); "## [Unreleased]" relocates
#    to the bottom of the file with its body intact. The new version
#    splices in under the blank spacer. An unexpected shape warns and
#    writes nothing - a ledger this script did not create is not one it
#    rewrites.
# 2. The "## [X.Y.Z]" release section is never an empty heading and never
#    lands under "## [Unreleased]" (the night-log-3 fix: the bump used to
#    file the release under Unreleased): it splices into the Released
#    area, right after the ledger, newest first. Existing Unreleased
#    bullets migrate into it (the Keep a Changelog release event), an
#    empty Unreleased autofills from git history since the nearest
#    previous reachable tag (grouped feat/fix/chore/rest into
#    Added/Changed/Fixed/Chore bullets with short SHAs), and no reachable
#    tag or an empty range splices an italic manual-fill note instead.
#    The draft is editorial - the why still gets written by hand before
#    the tag.
if [ ! -f CHANGELOG.md ]; then
        warn "CHANGELOG.md - file absent, nothing to write"
elif ! grep -q '^## \[Unreleased\]$' CHANGELOG.md; then
        warn "CHANGELOG.md - no ## [Unreleased] anchor found, nothing to write"
else
        # --- 1. the Released ledger ---
        if grep -qxF "v${NEW}" CHANGELOG.md; then
                same "CHANGELOG.md ledger - v${NEW} already recorded, nothing to write"
        elif grep -q '^## \[Released\]$' CHANGELOG.md; then
                if [ -z "$(sed -n '/^## \[Released\]$/{n;p;}' CHANGELOG.md)" ]; then
                        awk -v ver="v${NEW}" '
                                /^## \[Released\]$/ && !done {
                                        print
                                        getline spacer
                                        print spacer
                                        print ver
                                        done = 1
                                        next
                                }
                                { print }
                        ' CHANGELOG.md >"${TMP_WORK}"
                        if [ "${DRY_RUN}" = true ]; then
                                CHANGED=1
                                same "CHANGELOG.md ledger - would splice v${NEW} (## [Released], newest first) (dry run)"
                        else
                                mv "${TMP_WORK}" CHANGELOG.md
                                CHANGED=1
                                ok "CHANGELOG.md ledger - v${NEW} recorded (## [Released], newest first)"
                        fi
                else
                        warn "CHANGELOG.md ledger - unexpected ## [Released] shape (no blank spacer under the heading), nothing to write"
                fi
        else
                # First use: restructure into the canonical shape as the
                # ledger lands. The header prose (everything above the
                # released stack, --- separator included) stays untouched;
                # the "## [Released]" ledger slots in right after it,
                # backfilled from the repo's v* tags (newest first by tag
                # creation date), the new version on top; and
                # "## [Unreleased]" moves to the bottom of the file with its
                # body intact - the section step below migrates that body
                # into the new release section. The ledger is spliced into
                # the file, never rebuilt from the anchor down (the
                # night-log-3 fix: that rebuild used to eat the header).
                REL1="$(awk '/^## \[Unreleased\]$/ { next } !r && /^## \[/ { r = NR } END { print r }' CHANGELOG.md)"
                ANCH="$(awk '/^## \[Unreleased\]$/ { print NR; exit }' CHANGELOG.md)"
                UNREL_END="$(awk -v a="${ANCH}" '
                        NR > a && /^## \[/ && !f { print NR - 1; f = 1; exit }
                        END { if (!f) print NR }
                ' CHANGELOG.md)"
                if [ -z "${REL1}" ] || [ "${ANCH}" -lt "${REL1}" ]; then
                        # legacy shape: the anchor sits above the released
                        # stack (or there is no release section at all)
                        sed_lines 1 "$((ANCH - 1))" >"${TMP_WORK}.head"
                        sed_lines "${ANCH}" "${UNREL_END}" >"${TMP_WORK}.unrel"
                        sed_lines "$((UNREL_END + 1))" "" >"${TMP_WORK}.stack"
                else
                        # the anchor already sits below the released stack
                        sed_lines 1 "$((REL1 - 1))" >"${TMP_WORK}.head"
                        sed_lines "${REL1}" "$((ANCH - 1))" >"${TMP_WORK}.stack"
                        sed_lines "${ANCH}" "${UNREL_END}" >"${TMP_WORK}.unrel"
                fi
                {
                        trim_blank_edges <"${TMP_WORK}.head" >"${TMP_WORK}.piece"
                        if [ -s "${TMP_WORK}.piece" ]; then
                                cat "${TMP_WORK}.piece"
                                printf '\n'
                        fi
                        printf '## [Released]\n\n'
                        printf 'v%s\n' "${NEW}"
                        release_tag_list
                        emit_block "${TMP_WORK}.stack"
                        emit_block "${TMP_WORK}.unrel"
                } >"${TMP_WORK}.ledger"
                if [ "${DRY_RUN}" = true ]; then
                        CHANGED=1
                        same "CHANGELOG.md ledger - would create ## [Released] after the header prose, backfilled from the v* tags, and relocate ## [Unreleased] to the bottom (dry run)"
                else
                        mv "${TMP_WORK}.ledger" CHANGELOG.md
                        CHANGED=1
                        ok "CHANGELOG.md ledger - ## [Released] created after the header prose, backfilled from the v* tags, v${NEW} on top; ## [Unreleased] relocated to the bottom"
                fi
                TAGN="$(release_tag_list | wc -l)"
                if [ "${TAGN}" -lt 2 ]; then
                        warn "ledger backfilled from ${TAGN} local v* tag(s) - run 'git fetch --tags origin' and top the ledger up by hand if this looks short"
                fi
        fi

        # --- 2. the pre-filled release section ---
        if grep -qF "## [${NEW}]" CHANGELOG.md; then
                same "CHANGELOG.md - ## [${NEW}] already recorded, nothing to write"
        else
                unreleased_body | trim_blank_edges >"${TMP_WORK}.body"
                if [ -s "${TMP_WORK}.body" ]; then
                        SECTION_SOURCE="migrated the Unreleased bullets"
                else
                        SECTION_SOURCE="autofilled from git history"
                        if BASE="$(autofill_base_tag)"; then
                                git log --no-merges --format='%h%x09%s' "${BASE}..HEAD" >"${TMP_WORK}.raw" 2>/dev/null || :
                                while IFS=$'\t' read -r sha subj; do
                                        [ -n "${sha}" ] || continue
                                        case "${subj}" in
                                        "chore: prepare for release"*) continue ;;
                                        feat*) sec="Added" ;;
                                        fix*) sec="Fixed" ;;
                                        chore*) sec="Chore" ;;
                                        *) sec="Changed" ;;
                                        esac
                                        bullet="${subj}"
                                        if printf '%s' "${subj}" | grep -qE '^[A-Za-z]+(\([^)]*\))?:[[:space:]]'; then
                                                bullet="$(printf '%s' "${subj}" | sed -E 's/^[A-Za-z]+(\([^)]*\))?:[[:space:]]+//')"
                                        fi
                                        printf '%s\t- **%s** _(%s)_\n' "${sec}" "${bullet}" "${sha}"
                                done <"${TMP_WORK}.raw" | awk -F'\t' '
                                        { buf[$1] = buf[$1] $2 "\n"; seen[$1] = 1 }
                                        END {
                                                first = 1
                                                split("Added Changed Fixed Chore", ord, " ")
                                                for (i = 1; i <= 4; i++) {
                                                        if (!seen[ord[i]]) continue
                                                        if (!first) printf "\n"
                                                        first = 0
                                                        printf "### %s\n\n", ord[i]
                                                        printf "%s", buf[ord[i]]
                                                }
                                        }
                                ' >"${TMP_WORK}.body"
                                rm -f "${TMP_WORK}.raw"
                                if [ ! -s "${TMP_WORK}.body" ]; then
                                        printf '_No commits recorded since %s - fill the section from the release diff manually._\n' "${BASE}" >"${TMP_WORK}.body"
                                        SECTION_SOURCE="empty range since ${BASE}"
                                fi
                        else
                                printf '_No previous tag reachable from HEAD - fill the section from the release diff manually._\n' >"${TMP_WORK}.body"
                                SECTION_SOURCE="no reachable previous tag"
                        fi
                fi
                # Splice into the Released area (night-log-3): the release
                # record belongs right after the ledger, newest first - never
                # under the Unreleased anchor. The anchor block dissolves (its
                # body became this section's body) and the file ends on a
                # fresh "## [Unreleased]" at the bottom.
                {
                        printf '## [%s]\n\n' "${NEW}"
                        cat "${TMP_WORK}.body"
                } >"${TMP_WORK}.section"
                ANCH="$(awk '/^## \[Unreleased\]$/ { print NR; exit }' CHANGELOG.md)"
                UNREL_END="$(awk -v a="${ANCH}" '
                        NR > a && /^## \[/ && !f { print NR - 1; f = 1; exit }
                        END { if (!f) print NR }
                ' CHANGELOG.md)"
                REL_LEDGER="$(awk '/^## \[Released\]$/ { print NR; exit }' CHANGELOG.md)"
                if [ -n "${REL_LEDGER}" ]; then
                        INSERT_AT="$(awk -v r="${REL_LEDGER}" '
                                NR > r && /^## \[/ && $0 !~ /^## \[Unreleased\]$/ { print NR; exit }
                        ' CHANGELOG.md)"
                        if [ -z "${INSERT_AT}" ] && [ "${ANCH}" -gt "${REL_LEDGER}" ]; then
                                # The ledger is the last release heading and the
                                # anchor follows it - the new section becomes the
                                # first release section, right before the anchor.
                                INSERT_AT="${ANCH}"
                        fi
                else
                        INSERT_AT="$(awk '/^## \[/ && $0 !~ /^## \[Unreleased\]$/ { print NR; exit }' CHANGELOG.md)"
                fi
                if [ -n "${INSERT_AT}" ] && [ "${INSERT_AT}" -gt "${ANCH}" ]; then
                        # Degenerate shape: the anchor sits above the splice
                        # point, inside the released area. Dissolve the anchor
                        # block, land the section at the splice point, and end
                        # on a fresh anchor.
                        sed_lines 1 "$((ANCH - 1))" >"${TMP_WORK}.p1"
                        sed_lines "$((UNREL_END + 1))" "$((INSERT_AT - 1))" >"${TMP_WORK}.p2"
                        sed_lines "${INSERT_AT}" "" >"${TMP_WORK}.p3"
                        compose_splice "${TMP_WORK}.p1" "${TMP_WORK}.p2" "${TMP_WORK}.section" "${TMP_WORK}.p3" >"${TMP_WORK}"
                elif [ -n "${INSERT_AT}" ]; then
                        # The normal shape: the section lands right after the
                        # ledger (or after the header prose when no ledger
                        # exists yet), before the released stack.
                        sed_lines 1 "$((INSERT_AT - 1))" >"${TMP_WORK}.p1"
                        sed_lines "${INSERT_AT}" "$((ANCH - 1))" >"${TMP_WORK}.p2"
                        sed_lines "$((UNREL_END + 1))" "" >"${TMP_WORK}.p3"
                        compose_splice "${TMP_WORK}.p1" "${TMP_WORK}.section" "${TMP_WORK}.p2" "${TMP_WORK}.p3" >"${TMP_WORK}"
                else
                        # No release section anywhere and no ledger: the section
                        # lands right after the header prose, before the anchor.
                        sed_lines 1 "$((ANCH - 1))" >"${TMP_WORK}.p1"
                        sed_lines "$((UNREL_END + 1))" "" >"${TMP_WORK}.p2"
                        compose_splice "${TMP_WORK}.p1" "${TMP_WORK}.section" "${TMP_WORK}.p2" >"${TMP_WORK}"
                fi
                if [ "${DRY_RUN}" = true ]; then
                        CHANGED=1
                        same "CHANGELOG.md - would splice ## [${NEW}] into the Released area (${SECTION_SOURCE}) (dry run)"
                else
                        mv "${TMP_WORK}" CHANGELOG.md
                        CHANGED=1
                        ok "CHANGELOG.md - ## [${NEW}] spliced into the Released area (${SECTION_SOURCE})"
                fi
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

# --- format hygiene (night-cafe-7b): the bump normalizes its own output.
# The splice copies commit messages verbatim, and GPG-signed release
# commits carry gpg verification lines whose column alignment rides
# multi-space runs into the ledger. Prettier collapses those runs inside
# markdown text, so an unnormalized ledger fails format:check on the
# first CI run after every signed release - CI #695 before v80.5.3, then
# CI #719 after v80.5.5. The writes above now land prettier-clean: run
# --write, then --check fail-closed so a splice that cannot be
# normalized stops at bump time, on the local machine, before any push.
PRETTIER_BIN=""
if [ -x node_modules/.bin/prettier ]; then
        PRETTIER_BIN="node_modules/.bin/prettier"
elif command -v prettier >/dev/null 2>&1; then
        PRETTIER_BIN="prettier"
fi
if [ -z "${PRETTIER_BIN}" ]; then
        warn "prettier unavailable - run 'bun run format' before committing"
elif "${PRETTIER_BIN}" --write CHANGELOG.md >/dev/null 2>&1; then
        if "${PRETTIER_BIN}" --check CHANGELOG.md >/dev/null 2>&1; then
                ok "CHANGELOG.md - prettier clean (bump output normalized in place)"
        else
                die "CHANGELOG.md - still not prettier clean after --write; fix by hand before committing"
        fi
else
        die "CHANGELOG.md - prettier --write failed; run 'bun run format' before committing"
fi

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
