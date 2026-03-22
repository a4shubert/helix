#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

PYTHON_BIN="python3"
if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  echo "[store_init_clean_state] python3 not found."
  exit 1
fi

echo "[store_init_clean_state] Resetting SQLite store at ${HELIX_DB_PATH}"
"${PYTHON_BIN}" "${REPO_ROOT}/helix-store/init_clean_state.py"
echo "[store_init_clean_state] Clean state ready."
