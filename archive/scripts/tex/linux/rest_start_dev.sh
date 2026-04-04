#!/usr/bin/env bash
set -euo pipefail

# Run the app in Development using the launch profile "HelixRest".

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
PROJECT_DIR="${REPO_ROOT}/helix-rest/HelixRest"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

DOTNET_BIN="${HOME}/.dotnet/dotnet"
if [[ ! -x "${DOTNET_BIN}" ]]; then
  DOTNET_BIN="$(command -v dotnet)"
fi
DOTNET_VERSION="$("${DOTNET_BIN}" --version)"
DOTNET_MAJOR="${DOTNET_VERSION%%.*}"
if [[ "${DOTNET_MAJOR}" -lt 10 ]]; then
  echo "[rest_start_dev] .NET SDK 10.x required, resolved ${DOTNET_VERSION} via ${DOTNET_BIN}."
  echo "[rest_start_dev] Ensure ~/.dotnet is first in PATH or install .NET 10 SDK."
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  while IFS= read -r port; do
    [[ -z "${port}" ]] && continue
    if lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "[rest_start_dev] Port ${port} is already in use."
      echo "[rest_start_dev] Listener PID(s):"
      lsof -tiTCP:"${port}" -sTCP:LISTEN | xargs -I{} ps -p {} -o pid= -o command=
      echo "[rest_start_dev] Stop the existing process or change ASPNETCORE_URLS."
      exit 1
    fi
  done < <(
    echo "${ASPNETCORE_URLS}" \
      | tr ';,' '\n' \
      | sed -E 's#.*:([0-9]+).*#\1#' \
      | grep -E '^[0-9]+$' \
      | sort -u
  )
fi

cd "${PROJECT_DIR}"
ASPNETCORE_ENVIRONMENT=Development "${DOTNET_BIN}" run --launch-profile "HelixRest"
