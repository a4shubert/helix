#!/usr/bin/env bash
set -euo pipefail

# Run the Next.js production server (requires prior web_build).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
WEB_DIR="${REPO_ROOT}/helix-web"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[web_start_prod] npm not found. Please install Node.js/npm first."
  exit 1
fi

if [[ ! -d "${WEB_DIR}" ]]; then
  echo "[web_start_prod] ${WEB_DIR} not found. Did you clone the repo?"
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -tiTCP:"${HELIX_WEB_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[web_start_prod] Port ${HELIX_WEB_PORT} is already in use."
    echo "[web_start_prod] Listener PID(s):"
    lsof -tiTCP:"${HELIX_WEB_PORT}" -sTCP:LISTEN | xargs -I{} ps -p {} -o pid= -o command=
    echo "[web_start_prod] Stop the existing process or change HELIX_WEB_PORT."
    exit 1
  fi
fi

cd "${WEB_DIR}"
if [[ ! -d node_modules ]]; then
  echo "[web_start_prod] Installing dependencies..."
  npm install
fi

if [[ ! -d .next ]]; then
  if [[ "${HELIX_WEB_REBUILD:-0}" == "1" ]]; then
    echo "[web_start_prod] .next not found. Running build (HELIX_WEB_REBUILD=1)..."
    npm run build
  else
    echo "[web_start_prod] .next not found. Run scripts/tex/linux/web_build.sh first."
    echo "[web_start_prod] Or set HELIX_WEB_REBUILD=1 to build automatically."
    exit 1
  fi
fi

echo "[web_start_prod] Starting Next.js production server on port ${HELIX_WEB_PORT}..."
npm run start -- --port "${HELIX_WEB_PORT}"
