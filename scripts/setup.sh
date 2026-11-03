#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# BMI STELLAR SETUP (night-improve-5)
#
# One-command bring-up, the zelynic setup.sh discipline: three phases,
# each must pass, idempotent on re-run.
#   phase 1/3  toolchain - bun present, matching the packageManager pin
#   phase 2/3  dependencies - frozen-lockfile install (what CI enforces)
#   phase 3/3  commit gate wiring - core.hooksPath=.githooks
# It ends with the doctor verdict and the menu.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ok() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; }
die() {
	echo "[FAIL] $1" >&2
	exit 1
}

echo "BMI Stellar setup - bring-up in three phases"
echo ""

# ── phase 1/3: toolchain ────────────────────────────────────────────────────

echo "phase 1/3: toolchain"
BUN_BIN=""
if command -v bun >/dev/null 2>&1; then
	BUN_BIN="bun"
elif [ -x "$HOME/.bun/bin/bun" ]; then
	BUN_BIN="$HOME/.bun/bin/bun"
	export PATH="$HOME/.bun/bin:$PATH"
else
	die "bun not found. Install it (https://bun.sh) - the project pins the version in package.json#packageManager."
fi

BUN_VERSION="$("$BUN_BIN" --version)"
PINNED_BUN="$(sed -n 's/.*"packageManager": *"bun@\([^"]*\)".*/\1/p' package.json | head -1)"
if [ "${PINNED_BUN:-}" = "$BUN_VERSION" ]; then
	ok "bun ${BUN_VERSION} matches the packageManager pin"
else
	warn "bun ${BUN_VERSION} != the packageManager pin ${PINNED_BUN:-<none>}"
	warn "CI installs the pinned version; align locally with: bun upgrade ${PINNED_BUN}"
fi
echo ""

# ── phase 2/3: dependencies ─────────────────────────────────────────────────

echo "phase 2/3: dependencies (frozen lockfile)"
if "$BUN_BIN" install --frozen-lockfile; then
	ok "bun install --frozen-lockfile"
else
	die "the frozen install failed - the lockfile and the registry disagree. Read the error above; fix and re-run ./scripts/setup.sh (idempotent)."
fi
echo ""

# ── phase 3/3: commit gate wiring ───────────────────────────────────────────

echo "phase 3/3: commit gate wiring"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	hooks_path="$(git config --local core.hooksPath 2>/dev/null || true)"
	if [ "$hooks_path" = ".githooks" ]; then
		ok "pre-commit gate already wired (core.hooksPath=.githooks)"
	else
		git config --local core.hooksPath .githooks
		ok "pre-commit gate wired (core.hooksPath=.githooks)"
	fi
else
	die "not inside a git work tree - run this from a clone of the repository."
fi
echo ""

# ── the menu ────────────────────────────────────────────────────────────────

echo "setup complete. The menu:"
echo "  ./scripts/build.sh check-all   full CI gate (the canonical entry point)"
echo "  ./scripts/build.sh quick       the fast lane (test:fast)"
echo "  ./scripts/gate-keepers.sh      the wholesale non-code lane"
echo "  ./scripts/build.sh doctor      environment diagnostics"
echo "  ./scripts/build.sh -V          the version banner"
