#!/usr/bin/env bash
set -euo pipefail

# Delete all user-created Kafka topics and all RabbitMQ queues.
# Leaves Kafka internal topics (for example __consumer_offsets) untouched.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${SCRIPT_DIR}/env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/env.sh"
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[brokers_clean] curl not found."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[brokers_clean] python3 not found."
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "[brokers_clean] java not found. Ensure HELIX_JAVA_HOME is valid."
  exit 1
fi

echo "[brokers_clean] Cleaning Kafka topics..."
topics=$(/usr/local/opt/kafka/bin/kafka-topics --bootstrap-server "${HELIX_KAFKA_BOOTSTRAP_SERVERS}" --list | grep -v '^__' || true)
if [[ -n "${topics}" ]]; then
  while IFS= read -r topic; do
    [[ -z "${topic}" ]] && continue
    echo "[brokers_clean] deleting kafka topic ${topic}"
    /usr/local/opt/kafka/bin/kafka-topics \
      --bootstrap-server "${HELIX_KAFKA_BOOTSTRAP_SERVERS}" \
      --delete \
      --topic "${topic}"
  done <<< "${topics}"
else
  echo "[brokers_clean] no user kafka topics found"
fi

echo "[brokers_clean] Cleaning RabbitMQ queues..."
queues=$(curl -s -u guest:guest "${HELIX_RABBITMQ_MANAGEMENT_URL}/api/queues/%2F" | python3 -c 'import json,sys; data=json.load(sys.stdin); print("\n".join(q["name"] for q in data))')
if [[ -n "${queues}" ]]; then
  while IFS= read -r queue; do
    [[ -z "${queue}" ]] && continue
    echo "[brokers_clean] deleting rabbitmq queue ${queue}"
    curl -s -u guest:guest -X DELETE "${HELIX_RABBITMQ_MANAGEMENT_URL}/api/queues/%2F/${queue}" >/dev/null
  done <<< "${queues}"
else
  echo "[brokers_clean] no rabbitmq queues found"
fi

echo "[brokers_clean] Remaining Kafka topics:"
/usr/local/opt/kafka/bin/kafka-topics --bootstrap-server "${HELIX_KAFKA_BOOTSTRAP_SERVERS}" --list | sort
echo "[brokers_clean] Remaining RabbitMQ queues:"
curl -s -u guest:guest "${HELIX_RABBITMQ_MANAGEMENT_URL}/api/queues/%2F" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(len(data)); [print(q["name"]) for q in data]'
