#!/usr/bin/env bash
# Run the runtime proof harness: pin + verify the browser binary, then
# prove the product's runtime claims against the production build.
# Usage: scripts/proof/run-proof.sh [report-path]
set -euo pipefail

cd "$(dirname "$0")/../.."

bash scripts/proof/download-chrome.sh

REPORT_ARGS=()
if [ -n "${1:-}" ]; then
  REPORT_ARGS=(--report "$1")
fi

exec bun run scripts/proof/run-proof.ts "${REPORT_ARGS[@]}"
