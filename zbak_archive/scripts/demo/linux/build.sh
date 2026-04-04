#!/usr/bin/env bash
set -euo pipefail

# Build helix-rest and helix-web production artifacts without starting the stack.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ -f "${SCRIPT_DIR}/../../tex/linux/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/../../tex/linux/env.sh"
fi

cd "${REPO_ROOT}"

echo "[build] Building helix-rest production publish..."
"${SCRIPT_DIR}/../../tex/linux/rest_build.sh"

echo "[build] Building helix-web production bundle..."
"${SCRIPT_DIR}/../../tex/linux/web_build.sh"

echo "[build] Done."
