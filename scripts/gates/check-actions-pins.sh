#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial

#
# ACTIONS-PIN GATE (night-improve-2)
#
# The commit-time shape check for GitHub Actions pins: every version-shaped
# `uses:` line in .github/workflows/*.yml must be pinned to a full 40-hex
# commit SHA. A floating tag (`@v4`) lets upstream rewrite the code this
# repository executes with privileges; a SHA pin plus the release-tag
# comment (`# v4.39.1, SHA pin`) keeps the version readable and the code
# immutable. The heal engine is scripts/ci/actions-version-sweep.sh
# (--dry-run to read, --apply to move the pins). This gate is the
# freshness seat: after the shape pass it runs the sweep's dry-run and
# re-reads every pin against the live releases - advisory by default
# (a network fact never blocks a commit; an unreachable or
# rate-limited API yields no verdict, never a block), a WARNING that
# names the heal command when pins are behind. Strict mode blocks on
# it (opt-in).
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
# --apply is the repair lane the zelynic gates share: shape check first,
# then the sweep engine's apply lane heals every stale release pin in
# one command. A repair command never blocks: it reports, heals, and
# hands the rewritten workflows back for review and commit.
#
# Usage: scripts/gates/check-actions-pins.sh [--apply]

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

APPLY=0
if [ "$#" -gt 0 ]; then
	if [ "$1" = "--apply" ]; then
		APPLY=1
	else
		echo "ACTIONS-PIN GATE: unknown argument '$1' (supported: --apply)" >&2
		exit 2
	fi
fi

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

if [ "$VIOLATIONS" -gt 0 ] && [ "$APPLY" -eq 0 ]; then
	if [ "$MODE" = "strict" ]; then
		echo "FAIL: actions pins are not SHA-pinned (strict mode - the run is blocked)."
		exit 1
	fi
	echo "WARNING: actions pins are not SHA-pinned (warn mode - heal with the sweep's --apply)."
	exit 0
fi

if [ "$APPLY" -eq 1 ]; then
	# The repair lane: shape check done, now let the sweep engine heal
	# every stale release pin. A repair command never blocks.
	sweep_out="$(bash scripts/ci/actions-version-sweep.sh --apply 2>&1)" || {
		printf '%s\n' "$sweep_out"
		echo "FAIL: the sweep apply lane aborted - nothing claimed."
		exit 1
	}
	printf '%s\n' "$sweep_out"
	verdict="$(printf '%s\n' "$sweep_out" | grep '^sweep verdict:' || true)"
	healed="$(printf '%s' "$verdict" | sed -n 's/^sweep verdict: \([0-9]*\) healed.*/\1/p')"
	echo ""
	if [ -n "$healed" ] && [ "$healed" -gt 0 ]; then
		echo "healed: ${healed} pin(s) rewritten in .github/workflows/ — review and commit"
	elif [ -n "$verdict" ]; then
		skipped="$(printf '%s' "$verdict" | sed -n 's/^sweep verdict: [0-9]* healed, [0-9]* kept, \([0-9]*\) skipped.*/\1/p')"
		if [ "${skipped:-0}" -eq 0 ]; then
			echo "keep: every release pin sits at its latest release commit"
		else
			echo "no verdict: the release API was unreachable or rate-limited - nothing healed, nothing claimed"
		fi
	else
		echo "no verdict: the sweep answered nothing - nothing healed, nothing claimed"
	fi
	exit 0
fi

# The freshness seat: the sweep's dry-run verdict against the live
# releases. A failing or silent sweep reads as no verdict - the skip
# (no network, no claim; never a block).
if sweep_out="$(bash scripts/ci/actions-version-sweep.sh --dry-run 2>/dev/null)"; then
	verdict="$(printf '%s\n' "$sweep_out" | grep '^sweep verdict:' || true)"
	healed="$(printf '%s' "$verdict" | sed -n 's/^sweep verdict: \([0-9]*\) healed.*/\1/p')"
	skipped="$(printf '%s' "$verdict" | sed -n 's/^sweep verdict: [0-9]* healed, [0-9]* kept, \([0-9]*\) skipped.*/\1/p')"
	if [ -n "$healed" ] && [ "${skipped:-0}" -eq 0 ]; then
		if [ "$healed" -gt 0 ]; then
			echo "  ${verdict}"
			echo ""
			echo "stale pins found — heal with:"
			echo "  bash scripts/gates/check-actions-pins.sh --apply"
			if [ "$MODE" = "strict" ]; then
				echo "FAIL: actions pins are behind their releases (strict mode - the run is blocked)."
				exit 1
			fi
			exit 0
		fi
		echo "OK: every version pin is a 40-hex SHA."
		echo "OK: freshness verdict — ${verdict}"
		exit 0
	fi
fi

echo "OK: every version pin is a 40-hex SHA."
exit 0
