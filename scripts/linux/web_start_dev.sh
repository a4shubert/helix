#!/usr/bin/env bash
set -euo pipefail

# Start the Next.js dev server for the Helix web UI.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WEB_DIR="${REPO_ROOT}/helix-web"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[web_start_dev] npm not found. Please install Node.js/npm first."
  exit 1
fi

if [[ ! -d "${WEB_DIR}" ]]; then
  echo "[web_start_dev] ${WEB_DIR} not found. Did you clone the repo?"
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -tiTCP:"${HELIX_WEB_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[web_start_dev] Port ${HELIX_WEB_PORT} is already in use."
    echo "[web_start_dev] Listener PID(s):"
    lsof -tiTCP:"${HELIX_WEB_PORT}" -sTCP:LISTEN | xargs -I{} ps -p {} -o pid= -o command=
    echo "[web_start_dev] Stop the existing process or change HELIX_WEB_PORT."
    exit 1
  fi
fi

cd "${WEB_DIR}"
if [[ ! -d node_modules ]]; then
  echo "[web_start_dev] Installing dependencies..."
  npm install
fi

echo "[web_start_dev] Starting Next.js dev server on port ${HELIX_WEB_PORT}..."
npm run dev -- --port "${HELIX_WEB_PORT}"
