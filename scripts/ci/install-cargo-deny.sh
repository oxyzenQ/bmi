#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial

#
# THE DIGEST-PINNED SCANNER INSTALLER (night-supply-1).
#
# cargo-deny is the structural dependency-policy scanner the CI lanes
# run (bans, sources, advisories). This script is its one install path
# and the one place to bump the pin: the version and the tarball digest
# are committed constants, computed once at pin time and double-checked
# against the upstream .sha256 then - so a compromised release can never
# rewrite its own checksum into the lane. Every run verifies the exact
# downloaded bytes against the committed digest before the binary is
# trusted; a red match is a supply-chain alarm, not an install error.
#
# Bump procedure: download the new release tarball, verify it against
# the upstream .sha256 file, replace both constants below in the same
# commit, and let the whole gate suite review the diff.

set -euo pipefail

CARGO_DENY_VERSION="0.20.2"
CARGO_DENY_SHA256="9f12ed4c49936e09b48bf862b595cde2fe64fcbd9d74dfacac6131ca824c8d5f"
TARGET="x86_64-unknown-linux-musl"
BIN_DIR="${CARGO_HOME:-$HOME/.cargo}/bin"
BIN="$BIN_DIR/cargo-deny"

if "$BIN" --version 2>/dev/null | grep -q "$CARGO_DENY_VERSION"; then
	echo "cargo-deny ${CARGO_DENY_VERSION} already present"
	exit 0
fi

TARBALL="cargo-deny-${CARGO_DENY_VERSION}-${TARGET}.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL --retry 3 --retry-all-errors --retry-delay 5 --connect-timeout 15 \
	-o "$TMP/$TARBALL" \
	"https://github.com/EmbarkStudios/cargo-deny/releases/download/${CARGO_DENY_VERSION}/${TARBALL}"

printf '%s  %s\n' "$CARGO_DENY_SHA256" "$TMP/$TARBALL" | sha256sum -c -

mkdir -p "$BIN_DIR"
tar -xzf "$TMP/$TARBALL" -C "$TMP" "cargo-deny-${CARGO_DENY_VERSION}-${TARGET}/cargo-deny"
install -m 755 "$TMP/cargo-deny-${CARGO_DENY_VERSION}-${TARGET}/cargo-deny" "$BIN"

"$BIN" --version
