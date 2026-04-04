#!/usr/bin/env bash
set -euo pipefail

# Start the combined Helix runtime service.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
RUNTIME_DIR="${REPO_ROOT}/helix-runtime"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

PYTHON_BIN="${RUNTIME_DIR}/.venv/bin/python"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    echo "[runtime_start] Python not found. Create the runtime environment first."
    exit 1
  fi
fi

echo "[runtime_start] Starting helix-runtime service..."
cd "${REPO_ROOT}"
PYTHONPATH="${REPO_ROOT}/helix-core/src:${REPO_ROOT}/helix-runtime/src" \
  "${PYTHON_BIN}" -m helix_runtime.cli run-service --db-path "${HELIX_DB_PATH}"
