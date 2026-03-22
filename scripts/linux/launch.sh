#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RUN_DIR="${REPO_ROOT}/.helix/run"
LOG_DIR="${REPO_ROOT}/.helix/logs"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

mkdir -p "${RUN_DIR}" "${LOG_DIR}" "${HELIX_KAFKA_UI_DIR}"

port_from_url() {
  local url="$1"
  echo "${url}" | sed -E 's#.*:([0-9]+).*#\1#'
}

cleanup_pid_file() {
  local pid_file="$1"
  [[ -f "${pid_file}" ]] || return 0

  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -n "${pid}" ]] && ! kill -0 "${pid}" >/dev/null 2>&1; then
    rm -f "${pid_file}"
  fi

  return 0
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
    echo "[launch] Stopping stray listener on port ${port} (PID ${pid})..."
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "${pid}" >/dev/null 2>&1; then
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  done <<< "${pids}"

  return 0
}

require_command() {
  local cmd="$1"
  local message="$2"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[launch] ${message}"
    exit 1
  fi
}

require_command brew "Homebrew not found."
require_command java "java not found."

validate_pid_file_running() {
  local name="$1"
  local pid_file="${RUN_DIR}/${name}.pid"
  if [[ ! -f "${pid_file}" ]]; then
    echo "[launch] ${name} did not create a pid file."
    return 1
  fi

  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]] || ! kill -0 "${pid}" >/dev/null 2>&1; then
    echo "[launch] ${name} failed to stay running."
    if [[ -f "${LOG_DIR}/${name}.log" ]]; then
      echo "[launch] Last ${name}.log lines:"
      tail -n 40 "${LOG_DIR}/${name}.log" || true
    fi
    return 1
  fi

  return 0
}

cleanup_pid_file "${RUN_DIR}/rest.pid"
cleanup_pid_file "${RUN_DIR}/runtime.pid"
cleanup_pid_file "${RUN_DIR}/web.pid"

kill_listener_on_port "$(port_from_url "${HELIX_API_URL}")"
kill_listener_on_port "${HELIX_WEB_PORT}"

if [[ ! -f "${HELIX_KAFKA_UI_JAR}" ]]; then
  echo "[launch] Downloading Kafka UI..."
  curl -L --fail --output "${HELIX_KAFKA_UI_JAR}" \
    "https://github.com/provectus/kafka-ui/releases/download/v0.7.2/kafka-ui-api-v0.7.2.jar"
fi

echo "[launch] Starting RabbitMQ..."
brew services start rabbitmq

echo "[launch] Starting Kafka..."
brew services start kafka

if [[ -f "${HELIX_KAFKA_UI_PID_FILE}" ]] && kill -0 "$(cat "${HELIX_KAFKA_UI_PID_FILE}")" >/dev/null 2>&1; then
  echo "[launch] Kafka UI already running with PID $(cat "${HELIX_KAFKA_UI_PID_FILE}")"
else
  echo "[launch] Starting Kafka UI..."
  env \
    SERVER_PORT="${HELIX_KAFKA_UI_PORT}" \
    KAFKA_CLUSTERS_0_NAME="helix-local" \
    KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS="${HELIX_KAFKA_BOOTSTRAP_SERVERS}" \
    java -jar "${HELIX_KAFKA_UI_JAR}" >"${HELIX_KAFKA_UI_LOG_FILE}" 2>&1 &
  echo $! > "${HELIX_KAFKA_UI_PID_FILE}"
fi

echo "[launch] Waiting for brokers..."
sleep 5

"${SCRIPT_DIR}/store_init_clean_state.sh"

echo "[launch] Building helix-rest production publish..."
"${SCRIPT_DIR}/rest_build.sh"

echo "[launch] Building helix-web production bundle..."
"${SCRIPT_DIR}/web_build.sh"

export ASPNETCORE_ENVIRONMENT=Production

echo "[launch] Starting helix-rest..."
nohup "${SCRIPT_DIR}/rest_start_prod.sh" >"${LOG_DIR}/rest.log" 2>&1 &
echo $! > "${RUN_DIR}/rest.pid"

sleep 4
validate_pid_file_running "rest"

echo "[launch] Starting helix-runtime..."
nohup "${SCRIPT_DIR}/runtime_start.sh" >"${LOG_DIR}/runtime.log" 2>&1 &
echo $! > "${RUN_DIR}/runtime.pid"

sleep 3
validate_pid_file_running "runtime"

echo "[launch] Starting helix-web..."
nohup "${SCRIPT_DIR}/web_start_prod.sh" >"${LOG_DIR}/web.log" 2>&1 &
echo $! > "${RUN_DIR}/web.pid"

sleep 3
validate_pid_file_running "web"

echo "[launch] Helix is starting."
echo "[launch] REST: ${HELIX_API_URL}"
echo "[launch] Web: ${HELIX_WEB_URL}"
echo "[launch] RabbitMQ UI: ${HELIX_RABBITMQ_MANAGEMENT_URL}"
echo "[launch] Kafka UI: ${HELIX_KAFKA_UI_URL}"
echo "[launch] Logs:"
echo "  ${LOG_DIR}/rest.log"
echo "  ${LOG_DIR}/runtime.log"
echo "  ${LOG_DIR}/web.log"
