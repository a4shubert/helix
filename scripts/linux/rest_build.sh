#!/usr/bin/env bash
set -euo pipefail

# Production build helper for HelixRest.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROJECT_PATH="${REPO_ROOT}/helix-rest/HelixRest/HelixRest.csproj"
PUBLISH_DIR="${REPO_ROOT}/helix-rest/publish"

source "${SCRIPT_DIR}/env.sh"

cd "${REPO_ROOT}"

echo "[rest_build] Cleaning..."
dotnet clean "${PROJECT_PATH}"

echo "[rest_build] Restoring packages..."
dotnet restore "${PROJECT_PATH}"

echo "[rest_build] Publishing Release build..."
dotnet publish "${PROJECT_PATH}" -c Release -o "${PUBLISH_DIR}"

echo "[rest_build] Done. To run:"
echo "  cd ${PUBLISH_DIR} && HELIX_DB_PATH=${HELIX_DB_PATH} ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT} dotnet HelixRest.dll"
