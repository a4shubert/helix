#!/usr/bin/env bash
set -euo pipefail

# Production build helper for HelixRest.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROJECT_PATH="${REPO_ROOT}/helix-rest/HelixRest/HelixRest.csproj"
PUBLISH_DIR="${REPO_ROOT}/helix-rest/publish"

source "${SCRIPT_DIR}/env.sh"

DOTNET_BIN="${HOME}/.dotnet/dotnet"
if [[ ! -x "${DOTNET_BIN}" ]]; then
  DOTNET_BIN="$(command -v dotnet)"
fi
DOTNET_VERSION="$("${DOTNET_BIN}" --version)"
DOTNET_MAJOR="${DOTNET_VERSION%%.*}"
if [[ "${DOTNET_MAJOR}" -lt 10 ]]; then
  echo "[rest_build] .NET SDK 10.x required, resolved ${DOTNET_VERSION} via ${DOTNET_BIN}."
  echo "[rest_build] Ensure ~/.dotnet is first in PATH or install .NET 10 SDK."
  exit 1
fi

cd "${REPO_ROOT}"

echo "[rest_build] Cleaning..."
"${DOTNET_BIN}" clean "${PROJECT_PATH}"

echo "[rest_build] Restoring packages..."
"${DOTNET_BIN}" restore "${PROJECT_PATH}"

echo "[rest_build] Publishing Release build..."
"${DOTNET_BIN}" publish "${PROJECT_PATH}" -c Release -o "${PUBLISH_DIR}"

echo "[rest_build] Done. To run:"
echo "  cd ${PUBLISH_DIR} && HELIX_DB_PATH=${HELIX_DB_PATH} ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT} ${DOTNET_BIN} HelixRest.dll"
