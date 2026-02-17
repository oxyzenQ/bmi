#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
	echo "bun is not installed or not on PATH" >&2
	exit 127
fi

echo "Running local deep verification (check -> lint -> test:run -> build)..."
bun run verify

echo "OK: verify passed"
