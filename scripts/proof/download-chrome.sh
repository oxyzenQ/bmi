#!/usr/bin/env bash
# Download and verify the pinned chrome-headless-shell build for the
# runtime proof harness.
#
# Chrome for Testing publishes no per-build checksum file, so the binary
# pin lives here: the ZIP_SHA256 below was recorded from the official
# storage.googleapis.com artifact at adoption time and is verified on
# every install, fail-closed, the same way the repo pins its gate tools
# and its provenance digests. A re-pin is a visible diff.
set -euo pipefail

VERSION="158.0.8127.36"
ZIP_SHA256="2d3a23017323c54fd457a678e4351f895c4076d8050e39d5aa6247f93448b73a"
BASE_URL="https://storage.googleapis.com/chrome-for-testing-public/${VERSION}/linux64"
OUT_DIR="$(cd "$(dirname "$0")" && pwd)/.chrome"
ZIP_PATH="${OUT_DIR}/chrome-headless-shell-linux64.zip"
BIN_PATH="${OUT_DIR}/chrome-headless-shell-linux64/chrome-headless-shell"

if [ -x "${BIN_PATH}" ]; then
  echo "chrome-headless-shell ${VERSION} already present"
  exit 0
fi

mkdir -p "${OUT_DIR}"
echo "downloading chrome-headless-shell ${VERSION}..."
curl -fsSL --retry 3 -o "${ZIP_PATH}" "${BASE_URL}/chrome-headless-shell-linux64.zip"

echo "verifying SHA256 against the recorded pin..."
ACTUAL_SHA="$(sha256sum "${ZIP_PATH}" | awk '{print $1}')"
if [ "${ACTUAL_SHA}" != "${ZIP_SHA256}" ]; then
  echo "SHA256 mismatch: expected ${ZIP_SHA256}, got ${ACTUAL_SHA}" >&2
  rm -f "${ZIP_PATH}"
  exit 1
fi
echo "SHA256 verified: ${ACTUAL_SHA}"

unzip -q -o "${ZIP_PATH}" -d "${OUT_DIR}"
rm -f "${ZIP_PATH}"
chmod 755 "${BIN_PATH}"
echo "chrome-headless-shell ready: ${BIN_PATH}"
