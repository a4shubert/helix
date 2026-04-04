#!/usr/bin/env bash
set -euo pipefail

# Start Jupyter Notebook for Helix platform notebooks using the runtime environment.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
RUNTIME_DIR="${REPO_ROOT}/helix-runtime"
NOTEBOOK_DIR="${REPO_ROOT}/notebooks"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

PYTHON_BIN="${RUNTIME_DIR}/.venv/bin/python"
JUPYTER_BIN="${RUNTIME_DIR}/.venv/bin/jupyter"

if [[ ! -x "${PYTHON_BIN}" ]] || [[ ! -x "${JUPYTER_BIN}" ]]; then
  echo "[notebook_start] Runtime Jupyter environment not found."
  echo "[notebook_start] Run ./scripts/tex/linux/python_kernels_setup.sh first."
  exit 1
fi

mkdir -p "${NOTEBOOK_DIR}"

if ! "${JUPYTER_BIN}" kernelspec list 2>/dev/null | grep -q "helix-runtime"; then
  echo "[notebook_start] Registering Helix Runtime Jupyter kernel..."
  "${PYTHON_BIN}" -m ipykernel install --user --name helix-runtime --display-name "Helix Runtime"
fi

echo "[notebook_start] Starting Jupyter Notebook in ${NOTEBOOK_DIR}"
cd "${REPO_ROOT}"
PYTHONPATH="${REPO_ROOT}/helix-core/src:${REPO_ROOT}/helix-runtime/src" \
  "${JUPYTER_BIN}" notebook "${NOTEBOOK_DIR}"
