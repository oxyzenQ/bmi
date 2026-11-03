#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# ACTIONS VERSION SWEEP (night-improve-2)
#
# The zelynic-aligned GitHub Actions pin engine: every version-shaped
# `uses:` ref in .github/workflows/*.yml is healed to the latest release
# commit SHA (annotated tags peeled through the git objects API), with
# the release tag preserved as a trailing comment:
#
#   uses: actions/checkout@<40-hex sha> # v5.1.2, SHA pin
#
# Two modes:
#   --dry-run  report only: one HEAL note line per moved pin plus the
#              stable verdict line "sweep verdict: N healed, N kept,
#              N skipped (mode: dry-run)"
#   --apply    rewrite the workflow files in place, then prove the
#              writes stayed inside .github/workflows/ (the guard
#              below fails closed on any out-of-bounds change)
#
# Honesty rules (never touched): local `./...` refs, `docker://` refs,
# branch-style refs, pins already at the latest release commit, and
# repos whose latest release cannot be resolved (reported as skipped).
#
# Network: the GitHub API is read through GITHUB_TOKEN when set (the
# anonymous 60/h ceiling covers this repo's ~10-action surface, but a
# token keeps the weekly lane safe from quota resets). API reads carry
# the dated X-GitHub-Api-Version header.
#
# Usage:
#   bash scripts/ci/actions-version-sweep.sh --dry-run
#   bash scripts/ci/actions-version-sweep.sh --apply

set -euo pipefail

MODE="${1:-}"
case "$MODE" in
--dry-run | --apply) ;;
*)
        echo "usage: bash scripts/ci/actions-version-sweep.sh --dry-run|--apply" >&2
        exit 2
        ;;
esac

API_ROOT="https://api.github.com"
API_STATUS=""

api_json() {
        # api_json <path> - "<status>\n<body>" on a single stream, so the status
        # survives the command substitution that captures it (a subshell cannot
        # hand back a variable, only its stdout).
        local path="$1"
        local args=(-sS --connect-timeout 5 --max-time 15 -w '\n%{http_code}' -H "X-GitHub-Api-Version: 2022-11-28")
        if [ -n "${GITHUB_TOKEN:-}" ]; then
                args+=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
        fi
        local out status
        out="$(curl "${args[@]}" "${API_ROOT}${path}" 2>/dev/null || true)"
        status="${out##*$'\n'}"
        status="${status:-000}"
        printf '%s\n%s\n' "$status" "${out%$'\n'*}"
}

api_call() {
        # api_call <path> <body-var> - HTTP status into API_STATUS and the body
        # into <body-var>, both in the CALLER's shell (api_json's output is
        # captured here, not by the caller, so no state is lost to a subshell).
        local path="$1" var="$2" out
        out="$(api_json "$path")"
        API_STATUS="${out%%$'\n'*}"
        printf -v "$var" '%s' "${out#*$'\n'}"
}

json_field() {
        # json_field <body> <python expr> - one field out of a JSON document.
        printf '%s' "$1" | python3 -c "import json,sys
try:
    doc = json.load(sys.stdin)
    expr = $2
    print(expr)
except Exception:
    print('')" 2>/dev/null
}

repo_of() {
        # repo_of <action-ref> - the owner/repo pair of an action path
        # (github/codeql-action/init resolves to github/codeql-action).
        local action="$1" owner remainder
        owner="${action%%/*}"
        remainder="${action#*/}"
        case "$remainder" in
        */*) printf '%s/%s\n' "$owner" "${remainder%%/*}" ;;
        *) printf '%s\n' "$action" ;;
        esac
}

resolve_release_commit() {
        # resolve_release_commit <repo> - "<tag> <sha>" of the latest release
        # on stdout; empty on any failure (the caller records a skip).
        local repo="$1" tag ref_body obj_sha obj_type tag_body
        api_call "/repos/${repo}/releases/latest" body
        [ "$API_STATUS" = "200" ] || return 1
        tag="$(json_field "$body" 'doc.get("tag_name", "")')"
        [ -n "$tag" ] || return 1
        api_call "/repos/${repo}/git/ref/tags/${tag}" ref_body
        [ "$API_STATUS" = "200" ] || return 1
        obj_sha="$(json_field "$ref_body" 'doc["object"]["sha"]')"
        obj_type="$(json_field "$ref_body" 'doc["object"]["type"]')"
        [ -n "$obj_sha" ] || return 1
        if [ "$obj_type" = "tag" ]; then
                # Annotated tag: the ref names the tag object; peel to the commit.
                api_call "/repos/${repo}/git/tags/${obj_sha}" tag_body
                [ "$API_STATUS" = "200" ] || return 1
                obj_sha="$(json_field "$tag_body" 'doc["object"]["sha"]')"
                [ -n "$obj_sha" ] || return 1
        fi
        printf '%s %s\n' "$tag" "$obj_sha"
}

HEALED=0
KEPT=0
SKIPPED=0
EDIT_FILE="$(mktemp)"
RESOLVED="$(mktemp)"
trap 'rm -f "$EDIT_FILE" "$RESOLVED"' EXIT

shopt -s nullglob
files=(.github/workflows/*.yml)
shopt -u nullglob
if [ "${#files[@]}" -eq 0 ]; then
        echo "sweep verdict: 0 healed, 0 kept, 0 skipped (mode: ${MODE#--}; no workflow files)"
        exit 0
fi

for file in "${files[@]}"; do
        lineno=0
        while IFS= read -r line; do
                lineno=$((lineno + 1))
                value="$(printf '%s' "$line" | sed -n 's/^[[:space:]]*-\?[[:space:]]*uses:[[:space:]]*//p')"
                [ -n "$value" ] || continue
                action="${value%%@*}"
                # The ref ends at the first space: everything after it is the
                # "# vX.Y.Z, SHA pin" comment, never part of the ref itself.
                ref="${value#*@}"
                ref="${ref%% *}"

                case "$action" in
                ./* | docker://*)
                        SKIPPED=$((SKIPPED + 1))
                        continue
                        ;;
                esac
                case "$action" in
                */*) ;;
                *)
                        SKIPPED=$((SKIPPED + 1))
                        continue
                        ;;
                esac

                if [[ $ref =~ ^[0-9a-fA-F]{40}$ ]]; then
                        # A SHA pin: current only when the commented release tag still
                        # resolves to this exact commit. A bare SHA (no comment) is
                        # left alone - its version is unknowable without guessing.
                        comment="${line#*#}"
                        if [ "$comment" = "$line" ]; then
                                KEPT=$((KEPT + 1))
                                continue
                        fi
                        cur_tag="$(printf '%s' "$comment" | sed -n 's/^[[:space:]]*\(v[0-9][0-9.]*\).*/\1/p')"
                        if [ -z "$cur_tag" ]; then
                                KEPT=$((KEPT + 1))
                                continue
                        fi
                        cache_key="$(repo_of "$action")"
                        resolved="$(grep -F "${cache_key} " "$RESOLVED" | head -1 | cut -d' ' -f2- || true)"
                        if [ -z "$resolved" ]; then
                                resolved="$(resolve_release_commit "$cache_key" || true)"
                                if [ -n "$resolved" ]; then
                                        printf '%s %s\n' "$cache_key" "$resolved" >>"$RESOLVED"
                                fi
                        fi
                        if [ -z "$resolved" ]; then
                                echo "SWEEP: ${action} (${file}:${lineno}) — unresolvable latest release, pin kept"
                                SKIPPED=$((SKIPPED + 1))
                                continue
                        fi
                        new_tag="${resolved%% *}"
                        new_sha="${resolved##* }"
                        if [ "$new_sha" = "$ref" ]; then
                                KEPT=$((KEPT + 1))
                                continue
                        fi
                        prefix="${line%%uses:*}uses: "
                        new_line="${prefix}${action}@${new_sha}  # ${new_tag}, SHA pin"
                        printf '%s\t%s\t%s\n' "$file" "$lineno" "$new_line" >>"$EDIT_FILE"
                        echo "SWEEP: ${action} (${file}:${lineno}) — ${cur_tag} -> ${new_tag}, SHA ${ref:0:12} -> ${new_sha:0:12} HEAL"
                        HEALED=$((HEALED + 1))
                elif [[ $ref =~ ^v[0-9]+(\.[0-9]+)*$ ]]; then
                        # A tag pin: heal to the latest release commit SHA.
                        cache_key="$(repo_of "$action")"
                        resolved="$(grep -F "${cache_key} " "$RESOLVED" | head -1 | cut -d' ' -f2- || true)"
                        if [ -z "$resolved" ]; then
                                resolved="$(resolve_release_commit "$cache_key" || true)"
                                if [ -n "$resolved" ]; then
                                        printf '%s %s\n' "$cache_key" "$resolved" >>"$RESOLVED"
                                fi
                        fi
                        if [ -z "$resolved" ]; then
                                echo "SWEEP: ${action} (${file}:${lineno}) — unresolvable latest release, pin kept"
                                SKIPPED=$((SKIPPED + 1))
                                continue
                        fi
                        new_tag="${resolved%% *}"
                        new_sha="${resolved##* }"
                        prefix="${line%%uses:*}uses: "
                        new_line="${prefix}${action}@${new_sha}  # ${new_tag}, SHA pin"
                        printf '%s\t%s\t%s\n' "$file" "$lineno" "$new_line" >>"$EDIT_FILE"
                        echo "SWEEP: ${action} (${file}:${lineno}) — ${ref} -> ${new_tag}, SHA ${new_sha:0:12} HEAL"
                        HEALED=$((HEALED + 1))
                else
                        SKIPPED=$((SKIPPED + 1))
                fi
        done <"$file"
done

if [ "$MODE" = "--apply" ] && [ "$HEALED" -gt 0 ]; then
        while IFS=$'\t' read -r file lineno new_line; do
                awk -v ln="$lineno" -v repl="$new_line" '
                        NR == ln { print repl; next }
                        { print }
                ' "$file" >"${file}.sweep-tmp"
                mv "${file}.sweep-tmp" "$file"
        done <"$EDIT_FILE"

        # Fail-closed guard: the apply's writes must stay inside
        # .github/workflows/ or the tree is restored to HEAD.
        offender="$(git diff --name-only | grep -Ev '^\.github/workflows/[A-Za-z0-9_.-]+\.yml$' || true)"
        if [ -n "$offender" ]; then
                echo "FAIL: the apply touched tracked files outside .github/workflows/:" >&2
                printf '%s\n' "$offender" >&2
                git checkout -- .github/workflows/
                exit 1
        fi
fi

echo "sweep verdict: ${HEALED} healed, ${KEPT} kept, ${SKIPPED} skipped (mode: ${MODE#--})"
