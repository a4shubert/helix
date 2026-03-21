#!/usr/bin/env bash
# Common environment setup for local Helix runs.

if [ -n "${BASH_SOURCE:-}" ]; then
  _SRC="${BASH_SOURCE[0]}"
elif [ -n "${ZSH_VERSION:-}" ]; then
  _SRC="${(%):-%N}"
else
  _SRC="$0"
fi
SCRIPT_DIR="$(cd "$(dirname "${_SRC}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export HELIX_DB_PATH="${HELIX_DB_PATH:-${REPO_ROOT}/helix-store/helix.db}"
export HELIX_API_URL="${HELIX_API_URL:-http://localhost:5057}"
export ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://localhost:5057}"
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Production}"
export HELIX_WEB_URL="${HELIX_WEB_URL:-http://localhost:3001}"
export HELIX_WEB_PORT="${HELIX_WEB_PORT:-3001}"

echo "[env] HELIX_DB_PATH=${HELIX_DB_PATH}"
echo "[env] HELIX_API_URL=${HELIX_API_URL}"
echo "[env] ASPNETCORE_URLS=${ASPNETCORE_URLS}"
echo "[env] ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT}"
echo "[env] HELIX_WEB_URL=${HELIX_WEB_URL}"
echo "[env] HELIX_WEB_PORT=${HELIX_WEB_PORT}"
