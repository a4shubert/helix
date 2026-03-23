#!/usr/bin/env bash
set -euo pipefail

# Book sample trades directly into Helix and queue runtime processing.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
RUNTIME_DIR="${REPO_ROOT}/helix-runtime"
PYTHON_SCRIPT="${SCRIPT_DIR}/trades.py"

if [[ -f "${SCRIPT_DIR}/../../tex/linux/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/../../tex/linux/env.sh"
fi

PYTHON_BIN="${RUNTIME_DIR}/.venv/bin/python"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    echo "[trades] Python not found. Create the runtime environment first."
    exit 1
  fi
fi

cd "${REPO_ROOT}"
PYTHONPATH="${REPO_ROOT}/helix-core/src:${REPO_ROOT}/helix-runtime/src" \
  "${PYTHON_BIN}" "${PYTHON_SCRIPT}" "$@"
