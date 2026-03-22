#!/usr/bin/env bash
set -euo pipefail

# Run the published Release build of HelixRest.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PUBLISH_DIR="${REPO_ROOT}/helix-rest/publish"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

DOTNET_BIN="${HOME}/.dotnet/dotnet"
if [[ ! -x "${DOTNET_BIN}" ]]; then
  DOTNET_BIN="$(command -v dotnet)"
fi

if [ ! -d "${PUBLISH_DIR}" ]; then
  echo "[rest_start_prod] publish directory not found at ${PUBLISH_DIR}. Run scripts/linux/rest_build.sh first."
  exit 1
fi

cd "${PUBLISH_DIR}"
"${DOTNET_BIN}" HelixRest.dll
