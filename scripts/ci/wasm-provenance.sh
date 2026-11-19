#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# BMI STELLAR WASM PROVENANCE (night-enhance-1)
#
# The engine artifact chain: engine/argon2id (Rust, the only Rust seat in
# the tree) -> wasm32-unknown-unknown with simd128 ->
# src/lib/utils/kdf-wasm-embedded.ts (base64 + SHA-256 digest).
#
# verify (default): rebuild the artifact from the committed crate and
#   compare digests three ways - fresh build vs recorded digest, recorded
#   digest vs embedded base64, so neither half of the embedded module can
#   drift from the other. The shipped artifact is the built artifact.
# refresh: rebuild and regenerate the embedded module (the developer flow
#   after an intentional engine change; the diff shows the bytes).
#
# The build is byte-reproducible by construction: the toolchain is pinned
# in engine/argon2id/rust-toolchain.toml and the absolute machine paths
# are remapped to constant virtual paths through RUSTFLAGS, so the same
# committed source produces the same bytes on any machine. This lane
# proves that claim on every push instead of trusting it.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CRATE="$ROOT/engine/argon2id"
EMBEDDED="$ROOT/src/lib/utils/kdf-wasm-embedded.ts"
WASM="$CRATE/target/wasm32-unknown-unknown/release/bmi_stellar_argon2id.wasm"

# THE ARTIFACT SIZE CEILING (night-supply-1, the arrayref tripwire):
# the digest gate proves the embedded bytes are the built bytes, but a
# dependency that injects dead or malicious code could drift BOTH
# consistently - the owner refreshes and the new artifact re-embeds.
# The ceiling makes any significant growth impossible to refresh
# silently: past this budget the refresh refuses, and growing the
# budget becomes a deliberate, reviewable edit of this constant - the
# same trust model as the scanner digest pin.
#
# 45000 -> 50000 (night-frontier-Z6, deliberate): the keystore seat
# adds key custody to the engine - HMAC-SHA256 (the RustCrypto pair,
# sharing no digest machinery with argon2's blake2) plus the custody
# ABI. The engine is ~49.1 KB; the headroom above it is deliberately
# thin so future growth still trips this wire.
WASM_MAX_BYTES=50000

MODE="verify"
for arg in "$@"; do
	case "$arg" in
	--refresh) MODE="refresh" ;;
	*) echo "error: unexpected argument '$arg' (usage: wasm-provenance.sh [--refresh])" >&2; exit 2 ;;
	esac
done

command -v cargo >/dev/null 2>&1 || {
	echo "error: cargo not found - install the pinned toolchain (engine/argon2id/rust-toolchain.toml)" >&2
	exit 1
}

# The remaps must stay identical across machines (that is their purpose):
# the crate path becomes /engine, the cargo registry becomes /rust/registry.
CARGO_REGISTRY_HOME="${CARGO_HOME:-${HOME}/.cargo}"
RUSTFLAGS_VALUE="--remap-path-prefix=${CRATE}=/engine --remap-path-prefix=${CARGO_REGISTRY_HOME}/registry=/rust/registry"
export RUSTFLAGS="${RUSTFLAGS_VALUE}"

echo "building engine/argon2id -> wasm32-unknown-unknown (pinned toolchain, --locked)"
(cd "$CRATE" && cargo build --release --target wasm32-unknown-unknown --locked)

[ -f "$WASM" ] || { echo "error: build produced no wasm artifact" >&2; exit 1; }
DIGEST="$(sha256sum "$WASM" | cut -d' ' -f1)"
B64="$(base64 -w 0 "$WASM")"
SIZE="$(wc -c <"$WASM")"
echo "fresh artifact digest: $DIGEST ($SIZE bytes)"

size_ceiling_check() {
	local what="$1" bytes="$2"
	if [ "$bytes" -gt "$WASM_MAX_BYTES" ]; then
		echo "error: ${what} is ${bytes} bytes, past the ${WASM_MAX_BYTES}-byte ceiling" >&2
		echo "the engine artifact grew beyond the committed budget - review what moved before raising WASM_MAX_BYTES" >&2
		exit 1
	fi
}
size_ceiling_check "the fresh artifact" "$SIZE"

if [ "$MODE" = "refresh" ]; then
	TMP="${EMBEDDED}.tmp"
	{
		echo '// Copyright (C) 2026 rezky_nightky'
		echo '// SPDX-License-Identifier: AGPL-3.0-only'
		echo '// GENERATED FILE - do not edit by hand.'
		echo '// Source of truth: engine/argon2id (Rust crate, wasm32-unknown-unknown + simd128).'
		echo '// Rebuild and refresh: bash scripts/ci/wasm-provenance.sh --refresh'
		echo '// CI verifies this artifact against the crate on every push (wasm-provenance job).'
		echo "// Artifact SHA-256: ${DIGEST}"
		echo '// Toolchain: pinned by engine/argon2id/rust-toolchain.toml; crates pinned by Cargo.lock.'
		echo ''
		echo '/** The engine artifact digest (SHA-256 of the wasm bytes). */'
		# The assignment wraps onto the next line exactly the way prettier
		# formats it (printWidth 100), so the generated file is stable under
		# the format:check gate and the verify-mode parser below.
		echo 'export const ARGON2ID_WASM_SHA256 ='
		printf "\t'%s';\n" "$DIGEST"
		echo ''
		echo '/** The engine artifact itself, base64-encoded (decode, then WebAssembly.instantiate). */'
		echo 'export const ARGON2ID_WASM_BASE64 ='
		printf "\t'%s';\n" "$B64"
	} >"$TMP"
	mv "$TMP" "$EMBEDDED"
	echo "refreshed $EMBEDDED"
	exit 0
fi

# verify mode: the recorded digest and the embedded bytes must both agree
# with the fresh build - two independent drift checks in one lane. The
# parser reads the quoted value from the line after each export marker,
# so the check is whitespace-shape tolerant.
value_after() {
	awk -v marker="$1" '
		$0 ~ marker { getline; gsub(/^[ \t]*[\x27"]|[ \t]*;$/, ""); gsub(/[\x27"]$/, ""); print; exit }
	' "$EMBEDDED"
}
RECORDED="$(value_after '^export const ARGON2ID_WASM_SHA256 =')"
[ -n "$RECORDED" ] || { echo "error: no recorded digest in $EMBEDDED" >&2; exit 1; }
if [ "$RECORDED" != "$DIGEST" ]; then
	echo "error: recorded digest $RECORDED != fresh build $DIGEST" >&2
	echo "the embedded module is stale or the crate changed - run wasm-provenance.sh --refresh in the same change" >&2
	exit 1
fi

EMBEDDED_B64="$(value_after '^export const ARGON2ID_WASM_BASE64 =')"
[ -n "$EMBEDDED_B64" ] || { echo "error: no embedded base64 in $EMBEDDED" >&2; exit 1; }
EMBEDDED_DIGEST="$(printf '%s' "$EMBEDDED_B64" | base64 -d | sha256sum | cut -d' ' -f1)"
if [ "$EMBEDDED_DIGEST" != "$DIGEST" ]; then
	echo "error: embedded bytes digest $EMBEDDED_DIGEST != fresh build $DIGEST" >&2
	echo "the embedded base64 does not decode to the recorded artifact" >&2
	exit 1
fi
EMBEDDED_SIZE="$(printf '%s' "$EMBEDDED_B64" | base64 -d | wc -c)"
size_ceiling_check "the embedded artifact" "$EMBEDDED_SIZE"

echo "wasm provenance verified: fresh build == recorded digest == embedded bytes, $SIZE bytes under the $WASM_MAX_BYTES-byte ceiling"
