#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# SIGNATURE ASSETS GATE
#
# The LTS brand-supply-chain lock: every image under assets/,
# docs/assets/, static/assets/, and static/images/ must match the
# BLAKE3 digest recorded in assets/signature.b3sum, and every signed
# entry must exist. Both directions are enforced, so a swapped,
# re-encoded, or duplicated logo fails the gate, a silently added
# image fails the gate, and a deleted asset fails the gate. The
# digest manifest is regenerated only through the documented refresh
# policy in assets/signature-assets.md (the row moves in the same
# commit as the bytes, so the change is always visible in review).
#
# Tool: b3sum (the BLAKE3 team's canonical CLI). A missing tool is a
# named skip in the gate-keepers lane, never a silent pass.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MANIFEST="assets/signature.b3sum"
SCAN_DIRS=(assets docs/assets static/assets static/images)
EXTENSIONS=(png jpg jpeg webp gif svg avif ico)

if ! command -v b3sum >/dev/null 2>&1; then
        # Resolve the common user-local install location before giving
        # up (the same fallback shape build.sh uses for bun), so a
        # developer-local b3sum counts even when it is not on PATH.
        if [ -x "$HOME/.local/bin/b3sum" ]; then
                PATH="$HOME/.local/bin:$PATH"
        else
                echo "SKIP: b3sum not installed - the signature gate cannot verify (install the BLAKE3 CLI)"
                exit 0
        fi
fi

if [ ! -f "$MANIFEST" ]; then
        echo "FAIL: $MANIFEST is missing - no signed asset state exists"
        exit 1
fi

FAILED=0

# Direction 1: the bytes on disk still match the recorded digests.
if ! b3sum -c "$MANIFEST"; then
        FAILED=1
fi

# Direction 2: every image in the scanned directories is recorded, and
# every recorded path still exists (b3sum -c covers the missing-file
# case; this loop catches the unlisted-newcomer case).
listed="$(mktemp)"
found="$(mktemp)"
trap 'rm -f "$listed" "$found"' EXIT
awk '{print $2}' "$MANIFEST" | sort >"$listed"

patterns=()
for ext in "${EXTENSIONS[@]}"; do
        if [ "${#patterns[@]}" -gt 0 ]; then
                patterns+=(-o)
        fi
        patterns+=(-iname "*.${ext}")
done
for dir in "${SCAN_DIRS[@]}"; do
        if [ -d "$dir" ]; then
                find "$dir" -type f \( "${patterns[@]}" \) -print
        fi
done | sort >"$found"

unlisted="$(comm -13 "$listed" "$found")"
if [ -n "$unlisted" ]; then
        echo "FAIL: image(s) present on disk but missing from $MANIFEST:"
        printf '%s\n' "$unlisted"
        FAILED=1
fi

ghost="$(comm -23 "$listed" "$found")"
if [ -n "$ghost" ]; then
        echo "FAIL: $MANIFEST list(s) image(s) that no longer exist:"
        printf '%s\n' "$ghost"
        FAILED=1
fi

count="$(wc -l <"$MANIFEST" | tr -d ' ')"
if [ "$FAILED" -eq 0 ]; then
        echo "OK: all ${count} signed asset(s) match, nothing unlisted, nothing missing"
        exit 0
fi
exit 1
