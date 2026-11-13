#!/usr/bin/env bash
# Cosmic Dragon gatekeeper — runs the full BMI Stellar verification gate.
# Mirrors .github/workflows/ci.yml so what passes locally passes in CI.
#
# Usage:
#   ./scripts/build.sh check-all       # full gate (everything CI runs)
#   ./scripts/build.sh check-all -q    # full gate, essentials-only output
#   ./scripts/build.sh quick           # skip slow crypto/history tests (test:fast)
#   ./scripts/build.sh audit           # only the audit-* + format steps
#   ./scripts/build.sh test            # only vitest:run
#   ./scripts/build.sh build           # only vite build
#
# Exit non-zero if any step fails. Output is streamed.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Resolve bun from common install locations (handles CI + local + dev shells).
if command -v bun >/dev/null 2>&1; then
  BUN_BIN="bun"
elif [ -x "$HOME/.bun/bin/bun" ]; then
  BUN_BIN="$HOME/.bun/bin/bun"
  export PATH="$HOME/.bun/bin:$PATH"
else
  echo "error: bun not found. Install from https://bun.sh (project pins bun@1.3.11)." >&2
  exit 1
fi

# Argument parsing, the zelynic build.sh shape: one command plus the
# optional -q/--quiet flag. An extra positional argument fails loud
# instead of being silently ignored, so a mistyped invocation can
# never quietly run the wrong gate.
MODE=""
QUIET=0
for arg in "$@"; do
  case "$arg" in
    -q|--quiet)
      QUIET=1
      ;;
    "")
      ;;
    *)
      if [ -n "$MODE" ]; then
        echo "error: unexpected extra argument '$arg'. Run './scripts/build.sh help' for usage." >&2
        exit 2
      fi
      MODE="$arg"
      ;;
  esac
done
MODE="${MODE:-check-all}"

# Read the version from package.json (single source of truth) the way
# the zelynic build script reads Cargo.toml: no hardcoded version string
# lives in this file, so a bump can never drift from the banner.
BMI_VERSION="$("$BUN_BIN" -p "require('./package.json').version")"
readonly BMI_VERSION

# The depth signature (night-signature-1): the canonical attribution
# string from src/lib/utils/signature.ts, printed on -V/--version and
# enforced at every recorded surface by scripts/gates/check-signature.ts.
readonly BMI_SIGNATURE="rezky_nightky (oxyzenQ) 2026"

run_step() {
  local label="$1"; shift
  if [ "$QUIET" -eq 1 ]; then
    # Quiet mode, the zelynic -q contract: essentials only, per-step
    # OK / FAIL verdict lines, no banners and no streamed step output.
    # A failed step still prints the tail of its log so the failure
    # stays diagnosable without a re-run.
    local log status
    log="$(mktemp)"
    if "$@" >"$log" 2>&1; then
      status=0
      echo "[OK]   $label"
    else
      status=1
      echo "[FAIL] $label"
      tail -n 20 "$log"
    fi
    rm -f "$log"
    [ "$status" -eq 0 ] || exit 1
  else
    echo ""
    echo "=== $label ==="
    "$@"
  fi
}

doctor_ok()   { echo "  │  [OK]   $1"; }
doctor_warn() { echo "  │  [WARN]  $1"; }
doctor_fail() { echo "  │  [FAIL]  $1"; }

show_version() {
  echo "BMI Stellar build script v${BMI_VERSION} (bmi-stellar)"
  echo "Signature: ${BMI_SIGNATURE}"
}

doctor() {
  local health=0
  local node_ver node_major bun_ver pinned_bun hooks_path gates workflows

  echo "BMI Stellar doctor - environment diagnostics"
  echo ""
  echo "  ├─ Version: v${BMI_VERSION} (bmi-stellar, from package.json)"
  echo "  ├─ Signature: ${BMI_SIGNATURE}"
  echo "  ├─ OS: $(uname -s) $(uname -m), $(nproc 2>/dev/null || echo '?') cores"

  bun_ver="$("$BUN_BIN" --version)"
  pinned_bun="$(sed -n 's/.*"packageManager": *"bun@\([^"]*\)".*/\1/p' package.json | head -1)"
  if [ "${pinned_bun:-}" = "$bun_ver" ]; then
    doctor_ok "Bun ${bun_ver} matches the packageManager pin"
  else
    doctor_fail "Bun ${bun_ver} != packageManager pin ${pinned_bun:-<none>}"
    health=1
  fi

  if command -v node >/dev/null 2>&1; then
    node_ver="$(node --version)"
    node_major="${node_ver#v}"
    node_major="${node_major%%.*}"
    if [ "$node_major" -ge 22 ] && [ "$node_major" -lt 25 ]; then
      doctor_ok "Node ${node_ver} inside the engines range (>=22 <25)"
    else
      doctor_fail "Node ${node_ver} outside the engines range (>=22 <25)"
      health=1
    fi
  else
    doctor_warn "Node not on PATH (bun-only host; the CI lane installs Node from the engines range)"
  fi

  if [ "$(git config user.name 2>/dev/null || true)" != "" ] && [ "$(git config user.email 2>/dev/null || true)" != "" ]; then
    doctor_ok "Git identity: $(git config user.name) <$(git config user.email)>"
  else
    doctor_fail "Git identity not configured (user.name / user.email)"
    health=1
  fi

  hooks_path="$(git config --local core.hooksPath 2>/dev/null || true)"
  if [ "$hooks_path" = ".githooks" ]; then
    doctor_ok "Pre-commit gate wired (core.hooksPath=.githooks)"
  else
    doctor_warn "Pre-commit gate not wired (core.hooksPath='${hooks_path:-unset}') - run ./scripts/setup.sh"
  fi

  gates="$(find scripts/gates -type f 2>/dev/null | wc -l)"
  workflows="$(find .github/workflows -name '*.yml' -type f 2>/dev/null | wc -l)"
  doctor_ok "Gate inventory: ${gates} gate(s) in scripts/gates/, ${workflows} workflow(s) in .github/workflows/"

  echo "  ├─ Surface checks:"
  if "$BUN_BIN" run audit:version-sync >/dev/null 2>&1; then
    doctor_ok "Version surfaces in sync with package.json v${BMI_VERSION}"
  else
    doctor_fail "Version surfaces disagree with package.json v${BMI_VERSION} (run: bun run audit:version-sync)"
    health=1
  fi
  if bash scripts/gates/check-actions-pins.sh >/tmp/bmi-doctor-pins.log 2>&1; then
    if grep -q "WARNING" /tmp/bmi-doctor-pins.log; then
      doctor_warn "Actions pins: $(grep -c FAIL /tmp/bmi-doctor-pins.log) tag pin(s) - heal with scripts/ci/actions-version-sweep.sh --apply"
    else
      doctor_ok "Actions pins: every version pin is a 40-hex SHA"
    fi
  else
    doctor_fail "Actions pins: gate failed under strict rules"
    health=1
  fi
  rm -f /tmp/bmi-doctor-pins.log

  echo ""
  if [ "$health" -eq 0 ]; then
    echo "[OK] doctor - environment healthy."
  else
    echo "[FAIL] doctor - ${health} failed check(s) above."
  fi
  return "$health"
}

check_all() {
  run_step "format:check"      "$BUN_BIN" run format:check
  run_step "audit:deps"        "$BUN_BIN" run audit:deps
  run_step "audit:loc"         "$BUN_BIN" run audit:loc
  run_step "audit:scripts-loc" bash scripts/gates/check-scripts-loc.sh
  run_step "audit:headers"     "$BUN_BIN" run audit:headers
  run_step "audit:version-sync" "$BUN_BIN" run audit:version-sync
  run_step "audit:branding"    "$BUN_BIN" run audit:branding
  run_step "audit:signature"   "$BUN_BIN" run audit:signature
  run_step "audit:pwa-offline" "$BUN_BIN" run audit:pwa-offline
  run_step "type-check"        "$BUN_BIN" run check
  run_step "lint"              "$BUN_BIN" run lint
  run_step "test:ci"           "$BUN_BIN" run test:ci
  run_step "build"             "$BUN_BIN" run build
}

quick() {
  run_step "format:check"      "$BUN_BIN" run format:check
  run_step "audit:loc"         "$BUN_BIN" run audit:loc
  run_step "audit:scripts-loc" bash scripts/gates/check-scripts-loc.sh
  run_step "audit:headers"     "$BUN_BIN" run audit:headers
  run_step "audit:version-sync" "$BUN_BIN" run audit:version-sync
  run_step "audit:branding"    "$BUN_BIN" run audit:branding
  run_step "audit:signature"   "$BUN_BIN" run audit:signature
  run_step "audit:pwa-offline" "$BUN_BIN" run audit:pwa-offline
  run_step "type-check"        "$BUN_BIN" run check
  run_step "lint"              "$BUN_BIN" run lint
  run_step "test:fast"         "$BUN_BIN" run test:fast
  run_step "build"             "$BUN_BIN" run build
}

audit_only() {
  run_step "format:check"      "$BUN_BIN" run format:check
  run_step "audit:deps"        "$BUN_BIN" run audit:deps
  run_step "audit:loc"         "$BUN_BIN" run audit:loc
  run_step "audit:scripts-loc" bash scripts/gates/check-scripts-loc.sh
  run_step "audit:headers"     "$BUN_BIN" run audit:headers
  run_step "audit:version-sync" "$BUN_BIN" run audit:version-sync
  run_step "audit:branding"    "$BUN_BIN" run audit:branding
  run_step "audit:signature"   "$BUN_BIN" run audit:signature
  run_step "audit:pwa-offline" "$BUN_BIN" run audit:pwa-offline
}

test_only() {
  run_step "test:ci"           "$BUN_BIN" run test:ci
}

build_only() {
  run_step "build"             "$BUN_BIN" run build
}

case "$MODE" in
  check-all|all) check_all ;;
  quick)         quick ;;
  audit)         audit_only ;;
  test)          test_only ;;
  build)         build_only ;;
  -V|--version|version)
    show_version
    exit 0
    ;;
  doctor)
    doctor
    exit $?
    ;;
  -h|--help|help)
    cat <<'USAGE'
Usage: scripts/build.sh <mode>

Modes:
  check-all  Full CI gate (default). 13 steps: format + 8 audits + type-check + lint + test:ci + build.
  quick      Same as check-all but uses test:fast (skips crypto/history-io slow tests).
  audit      Only format:check + the 8 audit-* steps.
  test       Only vitest test:ci.
  build      Only vite production build.
  doctor     Environment diagnostics (bun/node pins, git identity, hooks,
             version surfaces, actions pins) - zelynic-style tree output.
  -V         Print the script version and the depth signature (the
             version reads live from package.json).

Flags:
  -q, --quiet  Essentials only: per-step OK / FAIL verdict lines, no
               banners or streamed step output (the CI shape). A failed
               step prints the tail of its log.

Example:
  ./scripts/build.sh check-all -q
USAGE
    ;;
  *)
    echo "error: unknown mode '$MODE'. Run './scripts/build.sh help' for usage." >&2
    exit 2
    ;;
esac

echo ""
echo "✓ build.sh $MODE — all steps passed."
