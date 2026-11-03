#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# ACTIONS-PIN GATE (night-improve-2)
#
# The commit-time shape check for GitHub Actions pins: every version-shaped
# `uses:` line in .github/workflows/*.yml must be pinned to a full 40-hex
# commit SHA. A floating tag (`@v4`) lets upstream rewrite the code this
# repository executes with privileges; a SHA pin plus the release-tag
# comment (`# v4.39.1, SHA pin`) keeps the version readable and the code
# immutable. The heal engine is scripts/ci/actions-version-sweep.sh
# (--dry-run to read, --apply to move the pins), the same one
# implementation the weekly self-heal workflow drives.
#
# Honesty rules (never flagged): local `./...` refs, `docker://` refs,
# and full SHAs (comment optional - the SHA itself is the lock).
#
# Modes (off | warn | strict; default warn):
#   BMI_ACTIONS_HEALTH=strict <gate>    one-shot blocking run (CI lane)
#   BMI_ACTIONS_HEALTH=off <gate>       silence
# In warn mode a violation prints and exits 0 (a commit is never blocked
# on a shape it can heal with one command); in strict mode it exits 1.
#
# Usage: scripts/gates/check-actions-pins.sh

set -euo pipefail

MODE="warn"
health="${BMI_ACTIONS_HEALTH:-warn}"
case "$health" in
off) exit 0 ;;
warn | strict) MODE="$health" ;;
*)
	echo "ACTIONS-PIN GATE: unknown mode '${BMI_ACTIONS_HEALTH}' (off|warn|strict) - running warn" >&2
	;;
esac

VIOLATIONS=0
CHECKED=0
FAILED=0

echo "Actions-pin gate (mode: ${MODE}):"
echo ""

shopt -s nullglob
files=(.github/workflows/*.yml)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
	echo "No .github/workflows/*.yml in this tree - nothing to check."
	exit 0
fi

for file in "${files[@]}"; do
	lineno=0
	while IFS= read -r line; do
		lineno=$((lineno + 1))
		value="$(printf '%s' "$line" | sed -n 's/^[[:space:]]*-\?[[:space:]]*uses:[[:space:]]*//p')"
		[ -n "$value" ] || continue
		CHECKED=$((CHECKED + 1))
		ref="${value#*@}"
		# The ref ends at the first space; the trailing comment is not
		# part of the ref itself.
		ref="${ref%% *}"
		action="${value%%@*}"

		case "$action" in
		./* | docker://*) continue ;;
		esac

		if [[ ! $ref =~ ^[0-9a-fA-F]{40}$ ]]; then
			FAILED=$((FAILED + 1))
			VIOLATIONS=$((VIOLATIONS + 1))
			echo "FAIL ${file}:${lineno}  ${value}"
			echo "     not a 40-hex SHA pin - heal with:"
			echo "       bash scripts/ci/actions-version-sweep.sh --apply"
		fi
	done <"$file"
done

echo ""
echo "Checked ${CHECKED} uses: line(s) across ${#files[@]} workflow file(s): ${VIOLATIONS} violation(s)."

if [ "$VIOLATIONS" -gt 0 ]; then
	if [ "$MODE" = "strict" ]; then
		echo "FAIL: actions pins are not SHA-pinned (strict mode - the run is blocked)."
		exit 1
	fi
	echo "WARNING: actions pins are not SHA-pinned (warn mode - heal with the sweep's --apply)."
	exit 0
fi

echo "OK: every version pin is a 40-hex SHA."
exit 0
