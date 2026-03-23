#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
RUN_DIR="${REPO_ROOT}/.helix/run"

port_from_url() {
  local url="$1"
  echo "${url}" | sed -E 's#.*:([0-9]+).*#\1#'
}

kill_listener_on_port() {
  local port="$1"
  [[ -n "${port}" ]] || return 0
  command -v lsof >/dev/null 2>&1 || return 0

  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -u || true)"
  [[ -n "${pids}" ]] || return 0

  while IFS= read -r pid; do
    [[ -n "${pid}" ]] || continue
    echo "[stop] Stopping stray listener on port ${port} (PID ${pid})..."
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "${pid}" >/dev/null 2>&1; then
      echo "[stop] Force stopping stray listener on port ${port} (PID ${pid})..."
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  done <<< "${pids}"

  return 0
}

if [[ -f "${SCRIPT_DIR}/../../tex/linux/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/../../tex/linux/env.sh"
fi

stop_pid_file() {
  local name="$1"
  local pid_file="${RUN_DIR}/${name}.pid"

  if [[ ! -f "${pid_file}" ]]; then
    echo "[stop] ${name}: no pid file"
    return
  fi

  local pid
  pid="$(cat "${pid_file}")"
  if [[ -z "${pid}" ]]; then
    rm -f "${pid_file}"
    echo "[stop] ${name}: empty pid file removed"
    return
  fi

  if kill -0 "${pid}" >/dev/null 2>&1; then
    echo "[stop] Stopping ${name} (PID ${pid})..."
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "${pid}" >/dev/null 2>&1; then
      echo "[stop] Force stopping ${name} (PID ${pid})..."
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  else
    echo "[stop] ${name}: process ${pid} not running"
  fi

  rm -f "${pid_file}"
}

stop_pid_file "web"
stop_pid_file "runtime"
stop_pid_file "rest"

kill_listener_on_port "$(port_from_url "${HELIX_API_URL}")"
kill_listener_on_port "${HELIX_WEB_PORT}"

"${SCRIPT_DIR}/../../tex/linux/brokers_stop.sh"

echo "[stop] Helix stack stopped."
