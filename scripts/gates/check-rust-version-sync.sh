#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial

#
# THE RUST VERSION SYNC GATE (night-frontier-Z6, the zelynic
# check-rust-version-sync lineage): the engine toolchain version lives in
# three surfaces that must say the same thing, because each one drives a
# different lane and a drifted surface means a toolchain that builds
# different wasm bytes than the one the maintenance lane validates:
#
#   engine/argon2id/rust-toolchain.toml   channel   - local dev + the CI
#                                                     provenance/clippy lanes
#   engine/argon2id/Cargo.toml            rust-version - the MSRV floor
#   .github/workflows/maintenance.yml     RUST_VERSION - the weekly sweep
#
# Bump all three in the same change (one version, one edit set); this
# gate fails closed when any two disagree.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLCHAIN="$ROOT/engine/argon2id/rust-toolchain.toml"
MANIFEST="$ROOT/engine/argon2id/Cargo.toml"
WORKFLOW="$ROOT/.github/workflows/maintenance.yml"

fail=0
for file in "$TOOLCHAIN" "$MANIFEST" "$WORKFLOW"; do
	if [ ! -f "$file" ]; then
		echo "error: missing version surface: ${file#"$ROOT"/}" >&2
		fail=1
	fi
done
if [ "$fail" -ne 0 ]; then
	exit 1
fi

toolchain="$(sed -n 's/^[[:space:]]*channel[[:space:]]*=[[:space:]]*["\x27]\([^"\x27]*\)["\x27].*$/\1/p' "$TOOLCHAIN" | head -1)"
msrv="$(sed -n 's/^[[:space:]]*rust-version[[:space:]]*=[[:space:]]*["\x27]\([^"\x27]*\)["\x27].*$/\1/p' "$MANIFEST" | head -1)"
# The workflow surface must be the env value itself, not a ${{ }} reference:
# both quote styles and any indentation are tolerated (prettier rewrites the
# quoting when it formats the workflow).
workflow="$(sed -n 's/^[[:space:]]*RUST_VERSION:[[:space:]]*["\x27]\([^"${}]*\)["\x27].*$/\1/p' "$WORKFLOW" | head -1)"

echo "rust-toolchain.toml channel:   ${toolchain:-(missing)}"
echo "Cargo.toml rust-version:       ${msrv:-(missing)}"
echo "maintenance.yml RUST_VERSION:  ${workflow:-(missing)}"

if [ -z "$toolchain" ] || [ -z "$msrv" ] || [ -z "$workflow" ]; then
	echo "error: a version surface is empty - every lane must pin the toolchain explicitly" >&2
	exit 1
fi

if [ "$toolchain" != "$msrv" ] || [ "$toolchain" != "$workflow" ]; then
	echo "error: rust version surfaces disagree - bump all three in the same change" >&2
	exit 1
fi

echo "rust version sync verified: $toolchain across all three surfaces"
