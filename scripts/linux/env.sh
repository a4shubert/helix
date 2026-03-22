#!/usr/bin/env bash
# Common environment setup for local Helix runs.

if [ -n "${BASH_SOURCE:-}" ]; then
  _SRC="${BASH_SOURCE[0]}"
elif [ -n "${ZSH_VERSION:-}" ]; then
  _SRC="${(%):-%N}"
else
  _SRC="$0"
fi
SCRIPT_DIR="$(cd "$(dirname "${_SRC}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -x "${HOME}/.dotnet/dotnet" ]]; then
  export DOTNET_ROOT="${HOME}/.dotnet"
  case ":${PATH}:" in
    *":${HOME}/.dotnet:"*) ;;
    *) export PATH="${HOME}/.dotnet:${PATH}" ;;
  esac
  case ":${PATH}:" in
    *":${HOME}/.dotnet/tools:"*) ;;
    *) export PATH="${HOME}/.dotnet/tools:${PATH}" ;;
  esac
fi

export HELIX_DB_PATH="${HELIX_DB_PATH:-${REPO_ROOT}/helix-store/helix.db}"
export HELIX_API_URL="${HELIX_API_URL:-http://localhost:5057}"
export ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://localhost:5057}"
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
export HELIX_WEB_URL="${HELIX_WEB_URL:-http://localhost:3000}"
export HELIX_WEB_PORT="${HELIX_WEB_PORT:-3000}"
export HELIX_KAFKA_BOOTSTRAP_SERVERS="${HELIX_KAFKA_BOOTSTRAP_SERVERS:-localhost:9092}"
export HELIX_RABBITMQ_HOST="${HELIX_RABBITMQ_HOST:-localhost}"
export HELIX_RABBITMQ_PORT="${HELIX_RABBITMQ_PORT:-5672}"
export HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE="${HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE:-portfolio.recompute}"
export HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE="${HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE:-trade.compute}"
export HELIX_RABBITMQ_MANAGEMENT_URL="${HELIX_RABBITMQ_MANAGEMENT_URL:-http://localhost:15672}"
export HELIX_JAVA_HOME="${HELIX_JAVA_HOME:-/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
export HELIX_KAFKA_UI_PORT="${HELIX_KAFKA_UI_PORT:-8080}"
export HELIX_KAFKA_UI_URL="${HELIX_KAFKA_UI_URL:-http://localhost:${HELIX_KAFKA_UI_PORT}}"
export HELIX_KAFKA_UI_DIR="${HELIX_KAFKA_UI_DIR:-${REPO_ROOT}/tools/kafka-ui}"
export HELIX_KAFKA_UI_JAR="${HELIX_KAFKA_UI_JAR:-${HELIX_KAFKA_UI_DIR}/kafka-ui-api.jar}"
export HELIX_KAFKA_UI_PID_FILE="${HELIX_KAFKA_UI_PID_FILE:-${HELIX_KAFKA_UI_DIR}/kafka-ui.pid}"
export HELIX_KAFKA_UI_LOG_FILE="${HELIX_KAFKA_UI_LOG_FILE:-${HELIX_KAFKA_UI_DIR}/kafka-ui.log}"

if [[ -d "${HELIX_JAVA_HOME}" ]]; then
  export JAVA_HOME="${HELIX_JAVA_HOME}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

echo "[env] HELIX_DB_PATH=${HELIX_DB_PATH}"
echo "[env] HELIX_API_URL=${HELIX_API_URL}"
echo "[env] ASPNETCORE_URLS=${ASPNETCORE_URLS}"
echo "[env] ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT}"
echo "[env] HELIX_WEB_URL=${HELIX_WEB_URL}"
echo "[env] HELIX_WEB_PORT=${HELIX_WEB_PORT}"
echo "[env] HELIX_KAFKA_BOOTSTRAP_SERVERS=${HELIX_KAFKA_BOOTSTRAP_SERVERS}"
echo "[env] HELIX_RABBITMQ_HOST=${HELIX_RABBITMQ_HOST}"
echo "[env] HELIX_RABBITMQ_PORT=${HELIX_RABBITMQ_PORT}"
echo "[env] HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE=${HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE}"
echo "[env] HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE=${HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE}"
echo "[env] HELIX_RABBITMQ_MANAGEMENT_URL=${HELIX_RABBITMQ_MANAGEMENT_URL}"
echo "[env] HELIX_JAVA_HOME=${HELIX_JAVA_HOME}"
echo "[env] HELIX_KAFKA_UI_URL=${HELIX_KAFKA_UI_URL}"
echo "[env] HELIX_KAFKA_UI_JAR=${HELIX_KAFKA_UI_JAR}"
if command -v dotnet >/dev/null 2>&1; then
  echo "[env] DOTNET_BIN=$(command -v dotnet)"
  echo "[env] DOTNET_SDK=$(dotnet --version)"
fi
