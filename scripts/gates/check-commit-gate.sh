#!/usr/bin/env bash
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# COMMIT GATE (night-improve-5)
#
# .githooks/pre-commit is a one-line shim that exec's this script, so
# the shell lints treat the hook like every other gate script. The
# contract: the same gates CI enforces and the gates a contributor
# runs before a commit stay one family - this file runs the CHEAP
# ones at commit time; the expensive lane (type-check, lint, tests,
# build) belongs to ./scripts/build.sh check-all and the ci.yml
# workflow. Every check here is fail-closed; the actions-pin health
# report is advisory (a remote fact never blocks a local commit).

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
	echo "FAIL: commit gate - not inside a git work tree"
	exit 1
}
cd "$ROOT" || exit 1

FAILED=0

run_gate() {
	local label="$1"
	shift
	if "$@" >/tmp/bmi-commit-gate-last.log 2>&1; then
		echo "  [OK]   $label"
	else
		echo "  [FAIL] $label"
		sed -n '1,5p' /tmp/bmi-commit-gate-last.log
		FAILED=1
	fi
}

echo "commit gate:"

run_gate "scripts loc cap (1000)" bash scripts/gates/check-scripts-loc.sh
run_gate "permissions (644/755)" bash scripts/gates/check-permissions.sh

if [ -f scripts/gates/check-name-case.py ] && command -v python3 >/dev/null 2>&1; then
	run_gate "name-case law" python3 scripts/gates/check-name-case.py
fi

BUN_BIN=""
if command -v bun >/dev/null 2>&1; then
	BUN_BIN="bun"
elif [ -x "$HOME/.bun/bin/bun" ]; then
	BUN_BIN="$HOME/.bun/bin/bun"
	export PATH="$HOME/.bun/bin:$PATH"
fi
if [ -n "$BUN_BIN" ]; then
	run_gate "loc ratchet (600/1000)" "$BUN_BIN" run audit:loc
	run_gate "version surfaces" "$BUN_BIN" run audit:version-sync
else
	echo "  [SKIP] loc ratchet + version surfaces (bun not installed)"
fi

# Advisory by design: warn mode never fails, the shape verdict prints.
if bash scripts/gates/check-actions-pins.sh >/tmp/bmi-commit-gate-pins.log 2>&1; then
	if grep -q "WARNING" /tmp/bmi-commit-gate-pins.log; then
		echo "  [WARN] actions pins - heal with scripts/ci/actions-version-sweep.sh --apply"
	else
		echo "  [OK]   actions pins (40-hex SHA everywhere)"
	fi
else
	echo "  [FAIL] actions pins (strict rule failed)"
	FAILED=1
fi
rm -f /tmp/bmi-commit-gate-pins.log /tmp/bmi-commit-gate-last.log

echo ""
if [ "$FAILED" -eq 0 ]; then
	echo "OK: commit gate - fast gates green (the full lane is ./scripts/build.sh check-all)"
	exit 0
fi
echo "FAIL: commit gate - the tree is not committable in this state"
exit 1
