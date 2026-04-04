#!/usr/bin/env bash
set -euo pipefail

# Create Helix Python virtual environments and register Jupyter kernels.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
CORE_DIR="${REPO_ROOT}/helix-core"
RUNTIME_DIR="${REPO_ROOT}/helix-runtime"

PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  echo "[python_kernels_setup] ${PYTHON_BIN} not found."
  exit 1
fi

echo "[python_kernels_setup] Creating helix-core virtualenv..."
"${PYTHON_BIN}" -m venv "${CORE_DIR}/.venv"
"${CORE_DIR}/.venv/bin/python" -m pip install --upgrade pip
"${CORE_DIR}/.venv/bin/python" -m pip install -e "${CORE_DIR}" ipykernel
"${CORE_DIR}/.venv/bin/python" -m ipykernel install --user --name helix-core --display-name "Helix Core"

echo "[python_kernels_setup] Creating helix-runtime virtualenv..."
"${PYTHON_BIN}" -m venv "${RUNTIME_DIR}/.venv"
"${RUNTIME_DIR}/.venv/bin/python" -m pip install --upgrade pip
"${RUNTIME_DIR}/.venv/bin/python" -m pip install -e "${CORE_DIR}" -e "${RUNTIME_DIR}" ipykernel
"${RUNTIME_DIR}/.venv/bin/python" -m ipykernel install --user --name helix-runtime --display-name "Helix Runtime"

echo "[python_kernels_setup] Registered kernels:"
jupyter kernelspec list
