#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial

#
# THE RUST DEPENDENCY SWEEP (night-frontier-Z6, the zelynic Dragon Guard
# port): one script is the single source of truth for three consumers —
# the maintenance workflow's update step (default mode), its --check
# verdict twin (the no-write local verdict), and the commit job's
# --print-locks staging (the exact-path staging wall; never a glob).
#
# The walk covers every committed Cargo.toml workspace, excluding target
# trees so cache-restored build output can never join it: a new Rust
# workspace joins the lane without touching the workflow. Every walked
# workspace must carry a committed Cargo.lock — the sweep refuses an
# unlocked workspace instead of silently leaving it stale forever.
#
#   sweep-rust-workspaces.sh              update every lockfile
#   sweep-rust-workspaces.sh --check      no-write verdict (exit 1 = pending updates)
#   sweep-rust-workspaces.sh --print-locks  print every lock path, one per line

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-update}"

case "$MODE" in
	update | --check | --print-locks) ;;
	*)
		echo "error: unexpected argument '$MODE' (usage: sweep-rust-workspaces.sh [--check|--print-locks])" >&2
		exit 2
		;;
esac

command -v cargo >/dev/null 2>&1 || {
	echo "error: cargo not found - install the pinned toolchain (engine/argon2id/rust-toolchain.toml)" >&2
	exit 1
}

CHANGED=0
LOCK_COUNT=0

while IFS= read -r manifest; do
	workspace="$(dirname "$manifest")"
	lock="$workspace/Cargo.lock"
	if [ ! -f "$lock" ]; then
		echo "error: ${manifest#"$ROOT"/} carries no committed Cargo.lock - the sweep refuses an unlocked workspace" >&2
		exit 1
	fi
	LOCK_COUNT=$((LOCK_COUNT + 1))

	if [ "$MODE" = "--print-locks" ]; then
		echo "${lock#"$ROOT"/}"
		continue
	fi

	echo "== workspace: ${manifest#"$ROOT"/} =="
	if [ "$MODE" = "--check" ]; then
		# The no-write verdict twin: --dry-run reports what would move.
		if cargo update --dry-run 2>&1 | grep -qE '^ *Updating|^ *Adding|^ *Removing'; then
			echo "   pending updates (this is the --check verdict)"
			CHANGED=1
		else
			echo "   already current"
		fi
		continue
	fi

	# Default mode: the real sweep. A failed update fails the lane - a
	# sweep never ships half a resolution.
	cargo update --manifest-path "$manifest"
done < <(find "$ROOT" -name Cargo.toml -not -path '*/target/*' -not -path '*/node_modules/*' | sort)

if [ "$MODE" = "--print-locks" ]; then
	exit 0
fi

echo "swept ${LOCK_COUNT} rust workspace(s)"
if [ "$MODE" = "--check" ] && [ "$CHANGED" -ne 0 ]; then
	echo "the rust dependency lane has pending updates"
	exit 1
fi
