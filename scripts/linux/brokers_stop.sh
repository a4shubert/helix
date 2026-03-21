#!/usr/bin/env bash
set -euo pipefail

# Stop local RabbitMQ and Kafka services for Helix development.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "[brokers_stop] Homebrew not found. Install Homebrew first."
  exit 1
fi

if [[ -f "${HELIX_KAFKA_UI_PID_FILE}" ]]; then
  KAFKA_UI_PID="$(cat "${HELIX_KAFKA_UI_PID_FILE}")"
  if kill -0 "${KAFKA_UI_PID}" >/dev/null 2>&1; then
    echo "[brokers_stop] Stopping Kafka UI (PID ${KAFKA_UI_PID})..."
    kill "${KAFKA_UI_PID}" || true
  fi
  rm -f "${HELIX_KAFKA_UI_PID_FILE}"
fi

echo "[brokers_stop] Stopping Kafka..."
brew services stop kafka || true

echo "[brokers_stop] Stopping RabbitMQ..."
brew services stop rabbitmq || true

echo "[brokers_stop] Broker services:"
brew services list | grep -E 'rabbitmq|kafka' || true
