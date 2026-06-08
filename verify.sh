#!/usr/bin/env bash
set -Eeuo pipefail

readonly REQUIRED_BIN="bun"
readonly VERIFY_CMD=("bun" "run" "verify")

require() {
	command -v "$1" >/dev/null 2>&1 || {
		printf 'error: required command not found: %s\n' "$1" >&2
		exit 127
	}
}

main() {
	require "$REQUIRED_BIN"

	printf '%s\n' \
		'Running deep verification:' \
		'  format:check -> check -> lint -> test:run -> build'

	"${VERIFY_CMD[@]}"

	printf '%s\n' 'OK: verify passed'
}

main "$@"
