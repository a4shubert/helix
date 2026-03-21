#!/usr/bin/env bash
set -euo pipefail

# Run the app in Development using the launch profile "HelixRest".

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROJECT_DIR="${REPO_ROOT}/helix-rest/HelixRest"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

cd "${PROJECT_DIR}"
ASPNETCORE_ENVIRONMENT=Development dotnet run --launch-profile "HelixRest"
