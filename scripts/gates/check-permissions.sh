#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# PERMISSION GUARD (night-improve-5)
#
# The owner's file-mode law: tracked files stay 644, executables 755.
# A 755 bit on a non-executable is how accidental-agnostic tree drift
# starts (a filesystem that marks everything +x leaks into the index on
# the first careless git add). The guard walks the git index - the
# committed truth, not this machine's mount flags - and demands
# shebang parity for every 755: a file may carry the exec bit only if
# it actually executes via a #! line.
#
# Usage: scripts/gates/check-permissions.sh

set -euo pipefail

FAILED=0
CHECKED=0

while read -r mode _hash _stage path; do
	CHECKED=$((CHECKED + 1))
	case "$mode" in
	100644 | 120000) ;; # the legal file default; symlinks pass
	100755)
		if [ -f "$path" ] && ! head -c 2 "$path" | grep -q '#!'; then
			echo "FAIL ${path}: mode 755 without a shebang (files stay 644; executables carry a #! line)"
			FAILED=$((FAILED + 1))
		fi
		;;
	*)
		echo "FAIL ${path}: unexpected git file mode ${mode}"
		FAILED=$((FAILED + 1))
		;;
	esac
done < <(git ls-files -s)

if [ "$FAILED" -gt 0 ]; then
	echo ""
	echo "FAIL: ${FAILED} file(s) violate the 644/755 shebang-parity law."
	echo "Fix: chmod 644 <file> for plain files; keep 755 only for scripts"
	echo "with a shebang (then re-stage with git add)."
	exit 1
fi

echo "Permission guard passed: ${CHECKED} tracked file(s), 644 files / 755 shebang executables."
exit 0
