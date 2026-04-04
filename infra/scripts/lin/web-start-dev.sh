#!/usr/bin/env bash

set -euo pipefail

PORT=3001
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
WEB_DIR="${REPO_ROOT}/web"

if [[ ! -d "${WEB_DIR}" ]]; then
  echo "web directory not found: ${WEB_DIR}" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found on PATH." >&2
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:${PORT} -sTCP:LISTEN || true)"
  if [[ -n "${PIDS}" ]]; then
    echo "Stopping process(es) on port ${PORT}: ${PIDS}"
    kill ${PIDS}
  fi
fi

cd "${WEB_DIR}"
exec npm run dev
