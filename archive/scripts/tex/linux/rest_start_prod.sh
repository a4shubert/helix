#!/usr/bin/env bash
set -euo pipefail

# Run the published Release build of HelixRest.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
PUBLISH_DIR="${REPO_ROOT}/helix-rest/publish"

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
  echo "[rest_start_prod] .NET SDK 10.x required, resolved ${DOTNET_VERSION} via ${DOTNET_BIN}."
  echo "[rest_start_prod] Ensure ~/.dotnet is first in PATH or install .NET 10 SDK."
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  while IFS= read -r port; do
    [[ -z "${port}" ]] && continue
    if lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "[rest_start_prod] Port ${port} is already in use."
      echo "[rest_start_prod] Listener PID(s):"
      lsof -tiTCP:"${port}" -sTCP:LISTEN | xargs -I{} ps -p {} -o pid= -o command=
      echo "[rest_start_prod] Stop the existing process or change ASPNETCORE_URLS."
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

if [ ! -d "${PUBLISH_DIR}" ]; then
  echo "[rest_start_prod] publish directory not found at ${PUBLISH_DIR}. Run scripts/tex/linux/rest_build.sh first."
  exit 1
fi

cd "${PUBLISH_DIR}"
"${DOTNET_BIN}" HelixRest.dll
