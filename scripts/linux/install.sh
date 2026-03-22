#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

require_command() {
  local cmd="$1"
  local message="$2"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[install] ${message}"
    exit 1
  fi
}

require_command python3 "python3 not found."
require_command npm "npm not found."
require_command dotnet "dotnet not found."

if command -v brew >/dev/null 2>&1; then
  echo "[install] Ensuring broker prerequisites are installed with Homebrew..."
  brew install kafka rabbitmq openjdk || true
fi

echo "[install] Restoring helix-rest..."
(
  cd "${REPO_ROOT}/helix-rest"
  dotnet restore helix.sln
)

echo "[install] Installing helix-web dependencies..."
(
  cd "${REPO_ROOT}/helix-web"
  npm install
)

echo "[install] Creating helix-core virtual environment..."
python3 -m venv "${REPO_ROOT}/helix-core/.venv"
"${REPO_ROOT}/helix-core/.venv/bin/python" -m pip install --upgrade pip
"${REPO_ROOT}/helix-core/.venv/bin/python" -m pip install -e "${REPO_ROOT}/helix-core"

echo "[install] Creating helix-runtime virtual environment..."
python3 -m venv "${REPO_ROOT}/helix-runtime/.venv"
"${REPO_ROOT}/helix-runtime/.venv/bin/python" -m pip install --upgrade pip
"${REPO_ROOT}/helix-runtime/.venv/bin/python" -m pip install -e "${REPO_ROOT}/helix-core"
"${REPO_ROOT}/helix-runtime/.venv/bin/python" -m pip install -e "${REPO_ROOT}/helix-runtime[brokers]"

echo "[install] Helix installation complete."
