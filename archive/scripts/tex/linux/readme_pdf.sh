#!/usr/bin/env bash
set -euo pipefail

# Render README.md to README.pdf using pandoc + Prince.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
README_MD="${REPO_ROOT}/README.md"
README_PDF="${REPO_ROOT}/README.pdf"

if ! command -v pandoc >/dev/null 2>&1; then
  echo "[readme_pdf] pandoc not found."
  exit 1
fi

if ! command -v prince >/dev/null 2>&1; then
  echo "[readme_pdf] prince not found."
  exit 1
fi

TEMP_HTML="$(mktemp "${REPO_ROOT}/.helix-readme.XXXXXX.html")"
trap 'rm -f "${TEMP_HTML}"' EXIT

cd "${REPO_ROOT}"

pandoc \
  "${README_MD}" \
  --from gfm \
  --standalone \
  --toc \
  --metadata title="Helix README" \
  --resource-path="${REPO_ROOT}" \
  -o "${TEMP_HTML}"

prince "${TEMP_HTML}" -o "${README_PDF}"

echo "[readme_pdf] Wrote ${README_PDF}"
