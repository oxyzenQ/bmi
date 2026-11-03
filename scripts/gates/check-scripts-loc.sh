#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# BMI STELLAR SCRIPTS FILE LOC CHECK (night-improve-7)
#
# Every script under scripts/ (shell AND python, recursive) stays under
# the hard LOC cap, the zelynic scripts budget (RULES.md "Line Count
# Discipline"). A script over the cap SHOULD split into modules; one
# that cannot split the same hour self-declares with a marker comment
# instead of a hardcoded exemption list:
#
#   # LOC_EXEMPT: <one-line justification>
#
# The marker is tracked migration debt: it lives WITH the file it
# exempts, removing it removes the exemption, and the justification is
# visible at the top of the exempt file. No hardcoded file list exists,
# so a new over-cap script fails the day it lands.
#
# Usage: scripts/gates/check-scripts-loc.sh [MAX_LINES]
#   MAX_LINES: override the default limit (default: 1000)

set -euo pipefail

MAX_LINES="${1:-1000}"
FAILED=0
FOUND=0
EXEMPT_VIOLATIONS=0
EXEMPT_MARKER='# LOC_EXEMPT:'

echo "Scripts file line counts (max ${MAX_LINES}):"
echo ""

FILES=$(find scripts -type f \( -name '*.sh' -o -name '*.py' \) 2>/dev/null | sort)

if [ -z "$FILES" ]; then
	echo "No .sh/.py files found under scripts/"
	exit 0
fi

while IFS= read -r f; do
	LINES=$(wc -l <"$f")
	printf "  %5d  %s\n" "$LINES" "$f"
	if [ "$LINES" -gt "$MAX_LINES" ]; then
		if grep -qF "$EXEMPT_MARKER" "$f"; then
			EXEMPT_VIOLATIONS=$((EXEMPT_VIOLATIONS + 1))
			echo "    ^^^ over ${MAX_LINES} (exempt via # LOC_EXEMPT: marker - tracked debt)"
		else
			FAILED=$((FAILED + 1))
			echo "    ^^^ VIOLATES ${MAX_LINES} limit"
			echo "           The policy: split into modules, or declare the honest IOU:"
			echo "               # LOC_EXEMPT: <one-line justification>"
		fi
	fi
	FOUND=$((FOUND + 1))
done <<<"$FILES"

echo ""
echo "Total files: ${FOUND}"
echo "Files over ${MAX_LINES} (exempt via # LOC_EXEMPT: marker): ${EXEMPT_VIOLATIONS}"
echo "Files over ${MAX_LINES} (NOT exempt - BUILD FAIL): ${FAILED}"

if [ "$FAILED" -gt 0 ]; then
	echo ""
	echo "FAIL: ${FAILED} script file(s) exceed ${MAX_LINES} lines without a"
	echo "# LOC_EXEMPT: marker. Split the script into modules, or add the"
	echo "marker with a justification:"
	echo "    # LOC_EXEMPT: <reason this file cannot be split>"
	exit 1
fi

if [ "$EXEMPT_VIOLATIONS" -gt 0 ]; then
	echo ""
	echo "OK (with migration debt): ${EXEMPT_VIOLATIONS} file(s) exceed ${MAX_LINES}"
	echo "but self-declare the exemption via the # LOC_EXEMPT: marker."
	echo "Refactor incrementally - see RULES.md 'Line Count Discipline'."
	exit 0
fi

echo "OK: all script files at or below ${MAX_LINES} lines (no exemptions needed)"
exit 0
