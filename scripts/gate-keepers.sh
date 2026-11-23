#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial

#
# BMI STELLAR GATE-KEEPERS (night-improve-5)
#
# The wholesale non-code lane, the zelynic gate-keepers.sh discipline:
# numbered sections, one concern each, counters that name their skips,
# and one verdict. A partial run can never masquerade as a full one -
# every skipped section is counted and named (a missing tool is a
# named skip, never a silent pass).
#
# The code lane (type-check, lint, tests, build) lives in
# scripts/build.sh check-all and the ci.yml workflow; this lane owns
# everything around the code. Commit-time enforcement rides
# .githooks/pre-commit -> scripts/gates/check-commit-gate.sh.
#
# Usage: scripts/gate-keepers.sh [--fix-all]
#
#   --fix-all  the auto-heal lane: gates that can normalize the tree
#              (the documentation disclaimer injector) run their
#              normalizing mode instead of their verifying mode. The
#              plain run is a verifier - it never mutates a byte.

set -uo pipefail

PASS=0
FAIL=0
SKIP=0
FAILED_SECTIONS=()
SKIPPED_SECTIONS=()

# --fix-all: the auto-heal lane (see the usage block above).
FIX_ALL=false
for arg in "$@"; do
        case "$arg" in
        --fix-all) FIX_ALL=true ;;
        *)
                echo "usage: scripts/gate-keepers.sh [--fix-all]" >&2
                exit 2
                ;;
        esac
done

header() { echo ""; echo "=== $1 ==="; }
pass() { PASS=$((PASS + 1)); echo "[OK]   $1"; }
fail() {
        FAIL=$((FAIL + 1))
        FAILED_SECTIONS+=("$1")
        echo "[FAIL] $2"
}
skip() {
        SKIP=$((SKIP + 1))
        SKIPPED_SECTIONS+=("$1")
        echo "[SKIP] $2"
}

# ── [0] pre-commit hook (self-install) ──────────────────────────────────────

header "[0] pre-commit hook (self-install)"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        hooks_path="$(git config --local core.hooksPath 2>/dev/null || true)"
        if [ "$hooks_path" = ".githooks" ]; then
                pass "pre-commit hook already wired (core.hooksPath=.githooks)"
        else
                if git config --local core.hooksPath .githooks; then
                        pass "pre-commit hook wired (core.hooksPath=.githooks)"
                else
                        fail "pre-commit hook" "git config core.hooksPath failed"
                fi
        fi
else
        skip "pre-commit hook" "not inside a git work tree"
fi

# ── [1] bash -n (syntax) ────────────────────────────────────────────────────

header "[1] bash -n (syntax)"
sh_files="$(find scripts -name '*.sh' -type f 2>/dev/null; echo verify.sh; [ -f .githooks/pre-commit ] && echo .githooks/pre-commit)"
# The list is one path per line by construction; read it into an array so
# every expansion stays quoted (shellcheck SC2086) without losing the
# word-split the loop needs.
readarray -t sh_array <<<"$sh_files"
syn_failed=0
syn_count=0
for f in "${sh_array[@]}"; do
        syn_count=$((syn_count + 1))
        if ! bash -n "$f" 2>/dev/null; then
                echo "       syntax error: $f"
                syn_failed=$((syn_failed + 1))
        fi
done
if [ "$syn_failed" -eq 0 ]; then
        pass "bash -n clean across ${syn_count} script(s)"
else
        fail "bash -n" "${syn_failed} script(s) with syntax errors"
fi

# ── [2] shellcheck ──────────────────────────────────────────────────────────

header "[2] shellcheck"
if command -v shellcheck >/dev/null 2>&1; then
        if shellcheck -x "${sh_array[@]}" 2>/dev/null; then
                pass "shellcheck clean"
        else
                fail "shellcheck" "findings above (run: shellcheck -x <file>)"
        fi
else
        skip "shellcheck" "shellcheck not installed - install it so this section stops skipping"
fi

# ── [3] yamllint ────────────────────────────────────────────────────────────

header "[3] yamllint"
if command -v yamllint >/dev/null 2>&1; then
        if yamllint -c .yamllint --strict .github/ 2>/dev/null; then
                pass "yamllint clean (--strict) across .github/"
        else
                fail "yamllint" "findings above (yamllint -c .yamllint --strict .github/)"
        fi
else
        skip "yamllint" "yamllint not installed - install it so this section stops skipping"
fi

# ── [4] actionlint ──────────────────────────────────────────────────────────

header "[4] actionlint"
if command -v actionlint >/dev/null 2>&1; then
        if actionlint 2>/dev/null; then
                pass "actionlint clean across .github/workflows/"
        else
                fail "actionlint" "findings above (actionlint)"
        fi
else
        skip "actionlint" "actionlint not installed - install it so this section stops skipping"
fi

# ── [5] codespell ───────────────────────────────────────────────────────────

header "[5] codespell"
if command -v codespell >/dev/null 2>&1; then
        if codespell --config .codespellrc . 2>/dev/null; then
                pass "codespell clean (config .codespellrc)"
        else
                fail "codespell" "findings above (codespell --config .codespellrc .)"
        fi
else
        skip "codespell" "codespell not installed - install it so this section stops skipping"
fi

# ── [6] permission guard (644/755) ──────────────────────────────────────────

header "[6] Permission Guard (644/755)"
if bash scripts/gates/check-permissions.sh; then
        pass "file modes 644, executables 755 with shebang parity"
else
        fail "permission guard" "mode violations above (chmod 644 <file>, or add the shebang)"
fi

# ── [7] scripts LOC cap ─────────────────────────────────────────────────────

header "[7] Scripts LOC Cap (1000)"
if bash scripts/gates/check-scripts-loc.sh; then
        pass "scripts/** inside the 1000-line cap"
else
        fail "scripts loc" "over-cap scripts above (split, or the honest # LOC_EXEMPT: IOU)"
fi

# ── [8] actions-pin shape ───────────────────────────────────────────────────

header "[8] Actions-Pin Shape (strict)"
if BMI_ACTIONS_HEALTH=strict bash scripts/gates/check-actions-pins.sh; then
        pass "every actions version pin is a 40-hex SHA"
else
        fail "actions pins" "floating pins above (heal: scripts/ci/actions-version-sweep.sh --apply)"
fi

# ── [9] version surfaces ────────────────────────────────────────────────────

header "[9] Version Surfaces"
if command -v bun >/dev/null 2>&1 || [ -x "$HOME/.bun/bin/bun" ]; then
        BUN_BIN="bun"
        [ -x "$HOME/.bun/bin/bun" ] && [ -z "$(command -v bun 2>/dev/null || true)" ] && export PATH="$HOME/.bun/bin:$PATH" && BUN_BIN="$HOME/.bun/bin/bun"
        if $BUN_BIN run audit:version-sync >/dev/null 2>&1; then
                pass "version surfaces in sync (package.json, DORMANT.md, README.md)"
        else
                fail "version surfaces" "disagreement above (bun run audit:version-sync)"
        fi
else
        skip "version surfaces" "bun not installed - install it so this section stops skipping"
fi

# ── [10] emoji sweep (repo-wide) ────────────────────────────────────────────

header "[10] Emoji Sweep (repo-wide)"
if python3 - <<'PY'
import subprocess
import sys

RANGES = ((0x1F000, 0x1FAFF), (0xFE0F, 0xFE0F), (0x200D, 0x200D))
# Frozen history keeps its emoji: the changelog and the timestamped
# audit records quote the past as it was - the zelynic frozen-history
# skip-set convention.
FROZEN = {"CHANGELOG.md", "docs/AUDIT-2026-08.md"}
out = subprocess.run(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    check=True,
    capture_output=True,
).stdout
bad = 0
for path in sorted({x.decode("utf-8", "surrogateescape") for x in out.split(b"\0") if x}):
    if path in FROZEN:
        continue
    try:
        text = open(path, "rb").read().decode("utf-8")
    except (OSError, UnicodeDecodeError):
        continue  # binary by construction
    for lineno, line in enumerate(text.splitlines(), 1):
        hits = [f"U+{ord(c):04X}" for c in line if any(lo <= ord(c) <= hi for lo, hi in RANGES)]
        if hits:
            print(f"FAIL {path}:{lineno} {' '.join(hits)}")
            bad += 1
print("emoji sweep: " + ("FAIL" if bad else "PASS") + f" ({bad} line(s) flagged)")
sys.exit(1 if bad else 0)
PY
then
        pass "no emoji outside frozen history"
else
        fail "emoji sweep" "emoji codepoints above - the CI names and the prose stay plain text"
fi

# ── [11] name-case rule ─────────────────────────────────────────────────────

header "[11] Name-Case Rule (check-name-case.py)"
if [ -f scripts/gates/check-name-case.py ] && command -v python3 >/dev/null 2>&1; then
        if python3 scripts/gates/check-name-case.py 2>&1; then
                pass "the project name is in a legal family everywhere (BRANDING 2.1)"
        else
                fail "name-case" "wrong-case name found (see the file:line:token list above)"
        fi
elif [ ! -f scripts/gates/check-name-case.py ]; then
        skip "name-case" "check-name-case.py not found - skipping"
else
        skip "name-case" "python3 not installed - skipping"
fi

# ── [12] signature assets (BLAKE3) ──────────────────────────────────────

header "[12] Signature Assets (b3sum)"
if command -v b3sum >/dev/null 2>&1 || [ -x "$HOME/.local/bin/b3sum" ]; then
        if bash scripts/gates/check-signature-assets.sh 2>&1; then
                pass "every brand asset matches its recorded BLAKE3 digest"
        else
                fail "signature assets" "digest or inventory mismatch above (refresh the row in the same commit as the bytes)"
        fi
else
        skip "signature assets" "b3sum not installed - install the BLAKE3 CLI so this section stops skipping"
fi

# ── [13] provenance generator (python oracle) ────────────────────────────

header "[13] Provenance Generator (generate-provenance-words.py --check)"
if command -v python3 >/dev/null 2>&1; then
        if python3 scripts/release/generate-provenance-words.py --check 2>&1; then
                pass "committed provenance block matches the generator and the D3 signature verifies (RFC 8032 reference)"
        else
                fail "provenance generator" "the committed constants or the D3 signature drifted - regenerate and paste the block"
        fi
else
        skip "provenance generator" "python3 not installed - install it so this section stops skipping"
fi

# ── [14] rust version sync ──────────────────────────────────────────────

header "[13] Rust Version Sync (check-rust-version-sync.sh)"
if bash scripts/gates/check-rust-version-sync.sh 2>&1; then
        pass "the engine toolchain version agrees across all three surfaces"
else
        fail "rust version sync" "rust-toolchain.toml, Cargo.toml rust-version, and the maintenance workflow disagree above - bump all three in the same change"
fi

# ── [15] documentation disclaimer ──────────────────────────────────────

header "[14] Documentation Disclaimer (inject-disclaimer.sh)"
# The bottom-block law (night-dragon-2S, the zejtron port): every
# living .md carries the stale-data disclaimer as its final block -
# PLACEMENT is the verdict, marker presence never was. A misplaced
# block is relocated, the BMI-STELLAR legacy marker migrates to the
# house marker, and CHANGELOG.md / docs/archive/ stay frozen.
# --fix-all normalizes; the plain run verifies and points at the
# one-command fix.
if [ "${FIX_ALL}" = true ]; then
        if bash scripts/gates/inject-disclaimer.sh; then
                pass "documentation disclaimer (normalized)"
        else
                fail "documentation disclaimer (auto-fix failed)" "bash scripts/gates/inject-disclaimer.sh failed"
        fi
else
        if bash scripts/gates/inject-disclaimer.sh --check; then
                pass "every living .md carries the bottom disclaimer block"
        else
                fail "documentation disclaimer" "a living .md is missing or carries a misplaced block (run: bash scripts/gates/inject-disclaimer.sh)"
        fi
fi

# ── summary ─────────────────────────────────────────────────────────────────

echo ""
echo "  Gatekeeper Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped"
if [ "${#SKIPPED_SECTIONS[@]}" -gt 0 ]; then
        echo "  skipped sections: ${SKIPPED_SECTIONS[*]}"
fi
if [ "${#FAILED_SECTIONS[@]}" -gt 0 ]; then
        echo "  failed sections:  ${FAILED_SECTIONS[*]}"
fi
echo ""
if [ "$FAIL" -gt 0 ]; then
        echo "COMMIT BLOCKED: ${FAIL} check(s) failed."
        exit 1
fi
echo "All checks passed - safe to commit."
exit 0
