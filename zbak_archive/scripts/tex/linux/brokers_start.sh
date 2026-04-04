#!/usr/bin/env bash
set -euo pipefail

# Start local RabbitMQ and Kafka services for Helix development.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

cleanup() {
  if [[ "${_BROKERS_CLEANED_UP:-0}" == "1" ]]; then
    return
  fi
  _BROKERS_CLEANED_UP=1

  if [[ -f "${HELIX_KAFKA_UI_PID_FILE}" ]]; then
    KAFKA_UI_PID="$(cat "${HELIX_KAFKA_UI_PID_FILE}")"
    if kill -0 "${KAFKA_UI_PID}" >/dev/null 2>&1; then
      echo "[brokers_start] Stopping Kafka UI (PID ${KAFKA_UI_PID})..."
      kill "${KAFKA_UI_PID}" || true
      wait "${KAFKA_UI_PID}" 2>/dev/null || true
    fi
    rm -f "${HELIX_KAFKA_UI_PID_FILE}"
  fi

  echo "[brokers_start] Stopping Kafka..."
  brew services stop kafka || true

  echo "[brokers_start] Stopping RabbitMQ..."
  brew services stop rabbitmq || true
}

trap cleanup INT TERM EXIT

mkdir -p "${HELIX_KAFKA_UI_DIR}"

if ! command -v brew >/dev/null 2>&1; then
  echo "[brokers_start] Homebrew not found. Install Homebrew first."
  exit 1
fi

if ! brew list --versions rabbitmq >/dev/null 2>&1; then
  echo "[brokers_start] rabbitmq is not installed. Run: brew install rabbitmq"
  exit 1
fi

if ! brew list --versions kafka >/dev/null 2>&1; then
  echo "[brokers_start] kafka is not installed. Run: brew install kafka"
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "[brokers_start] java not found. Ensure HELIX_JAVA_HOME is valid."
  exit 1
fi

if [[ ! -f "${HELIX_KAFKA_UI_JAR}" ]]; then
  echo "[brokers_start] Installing Provectus Kafka UI JAR..."
  curl -L --fail --output "${HELIX_KAFKA_UI_JAR}" \
    "https://github.com/provectus/kafka-ui/releases/download/v0.7.2/kafka-ui-api-v0.7.2.jar"
fi

echo "[brokers_start] Starting RabbitMQ..."
brew services start rabbitmq

echo "[brokers_start] Starting Kafka..."
brew services start kafka

if [[ -f "${HELIX_KAFKA_UI_PID_FILE}" ]] && kill -0 "$(cat "${HELIX_KAFKA_UI_PID_FILE}")" >/dev/null 2>&1; then
  echo "[brokers_start] Kafka UI already running with PID $(cat "${HELIX_KAFKA_UI_PID_FILE}")"
else
  echo "[brokers_start] Starting Provectus Kafka UI..."
  env \
    SERVER_PORT="${HELIX_KAFKA_UI_PORT}" \
    KAFKA_CLUSTERS_0_NAME="helix-local" \
    KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS="${HELIX_KAFKA_BOOTSTRAP_SERVERS}" \
    java -jar "${HELIX_KAFKA_UI_JAR}" >"${HELIX_KAFKA_UI_LOG_FILE}" 2>&1 &
  echo $! > "${HELIX_KAFKA_UI_PID_FILE}"
fi

echo "[brokers_start] Broker services:"
brew services list | grep -E 'rabbitmq|kafka' || true

echo "[brokers_start] RabbitMQ management UI: ${HELIX_RABBITMQ_MANAGEMENT_URL}"
echo "[brokers_start] Kafka bootstrap servers: ${HELIX_KAFKA_BOOTSTRAP_SERVERS}"
echo "[brokers_start] Kafka UI: ${HELIX_KAFKA_UI_URL}"

# if command -v open >/dev/null 2>&1; then
#   open "${HELIX_RABBITMQ_MANAGEMENT_URL}" || true
#   open "${HELIX_KAFKA_UI_URL}" || true
# elif command -v xdg-open >/dev/null 2>&1; then
#   xdg-open "${HELIX_RABBITMQ_MANAGEMENT_URL}" || true
#   xdg-open "${HELIX_KAFKA_UI_URL}" || true
# fi

echo "[brokers_start] Brokers are running. Press Ctrl+C to stop Kafka, RabbitMQ, and Kafka UI."

while true; do
  sleep 1
done
