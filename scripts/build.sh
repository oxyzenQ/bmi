#!/usr/bin/env bash
# Cosmic Dragon gatekeeper — runs the full BMI Stellar verification gate.
# Mirrors .github/workflows/ci.yml so what passes locally passes in CI.
#
# Usage:
#   ./scripts/build.sh check-all       # full gate (everything CI runs)
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

MODE="${1:-check-all}"

run_step() {
  local label="$1"; shift
  echo ""
  echo "=== $label ==="
  "$@"
}

check_all() {
  run_step "format:check"      $BUN_BIN run format:check
  run_step "audit:deps"        $BUN_BIN run audit:deps
  run_step "audit:loc"         $BUN_BIN run audit:loc
  run_step "audit:headers"     $BUN_BIN run audit:headers
  run_step "audit:branding"    $BUN_BIN run audit:branding
  run_step "audit:pwa-offline" $BUN_BIN run audit:pwa-offline
  run_step "type-check"        $BUN_BIN run check
  run_step "lint"              $BUN_BIN run lint
  run_step "test:ci"           $BUN_BIN run test:ci
  run_step "build"             $BUN_BIN run build
}

quick() {
  run_step "format:check"      $BUN_BIN run format:check
  run_step "audit:loc"         $BUN_BIN run audit:loc
  run_step "audit:headers"     $BUN_BIN run audit:headers
  run_step "audit:branding"    $BUN_BIN run audit:branding
  run_step "audit:pwa-offline" $BUN_BIN run audit:pwa-offline
  run_step "type-check"        $BUN_BIN run check
  run_step "lint"              $BUN_BIN run lint
  run_step "test:fast"         $BUN_BIN run test:fast
  run_step "build"             $BUN_BIN run build
}

audit_only() {
  run_step "format:check"      $BUN_BIN run format:check
  run_step "audit:deps"        $BUN_BIN run audit:deps
  run_step "audit:loc"         $BUN_BIN run audit:loc
  run_step "audit:headers"     $BUN_BIN run audit:headers
  run_step "audit:branding"    $BUN_BIN run audit:branding
  run_step "audit:pwa-offline" $BUN_BIN run audit:pwa-offline
}

test_only() {
  run_step "test:ci"           $BUN_BIN run test:ci
}

build_only() {
  run_step "build"             $BUN_BIN run build
}

case "$MODE" in
  check-all|all) check_all ;;
  quick)         quick ;;
  audit)         audit_only ;;
  test)          test_only ;;
  build)         build_only ;;
  -h|--help|help)
    cat <<'USAGE'
Usage: scripts/build.sh <mode>

Modes:
  check-all  Full CI gate (default). 10 steps: format + 5 audits + type-check + lint + test:ci + build.
  quick      Same as check-all but uses test:fast (skips crypto/history-io slow tests).
  audit      Only format:check + the 5 audit-* scripts.
  test       Only vitest test:ci.
  build      Only vite production build.
USAGE
    ;;
  *)
    echo "error: unknown mode '$MODE'. Run './scripts/build.sh help' for usage." >&2
    exit 2
    ;;
esac

echo ""
echo "✓ build.sh $MODE — all steps passed."
