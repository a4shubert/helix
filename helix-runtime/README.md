# helix-runtime

Asynchronous runtime worker library for the Helix platform.

## Purpose

`helix-runtime` consumes RabbitMQ execution tasks, rebuilds portfolio analytics
through `helix-core`, persists refreshed snapshots to `helix-store`, and then
publishes downstream update events to Kafka.

Current execution path:

1. Consume `portfolio.compute` and `trade.compute` from RabbitMQ
2. Load portfolio trades and market inputs from SQLite
3. Recompute positions, P&L, and risk through `helix-core`
4. Persist `position`, `pnl`, and `risk` snapshots
5. Update trade processing status / notional
6. Publish `portfolio.updated`, `pl.updated`, `risk.updated`, and `trade.updated` to Kafka

## Package Structure

- `helix_runtime.application`
  - runtime models, ports, processors, and service wiring
- `helix_runtime.brokers`
  - broker topology, broker config, payload builders, adapters, and workers
- `helix_runtime.infrastructure`
  - SQLite store adapter

## Broker Model

Current model:

- `helix-rest` persists trades and emits Kafka `trade.created` for audit
- `helix-rest` submits RabbitMQ `portfolio.compute` and `trade.compute` tasks
- `helix-runtime` consumes RabbitMQ tasks and performs the actual compute work
- `helix-runtime` publishes state-change updates to Kafka

Kafka topics actively used by runtime:

- `trade.updated`
- `portfolio.updated`
- `pl.updated`
- `risk.updated`

RabbitMQ queues actively used by runtime:

- `portfolio.compute`
- `trade.compute`

## CLI

Run the RabbitMQ worker directly:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli run-rabbitmq-worker \
  --db-path helix-store/helix.db
```

Run the combined runtime service:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli run-service \
  --db-path helix-store/helix.db
```

Replay trades by clearing live snapshots and re-queuing compute tasks:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli replay-trades \
  --db-path helix-store/helix.db
```

For bounded local testing:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli run-rabbitmq-worker \
  --db-path helix-store/helix.db \
  --max-tasks 1
```

## Broker Adapters

Broker-facing adapters live under:

- [adapters.py](/Users/alexandershubert/git/helix/helix-runtime/src/helix_runtime/brokers/adapters.py)
- [config.py](/Users/alexandershubert/git/helix/helix-runtime/src/helix_runtime/brokers/config.py)
- [payloads.py](/Users/alexandershubert/git/helix/helix-runtime/src/helix_runtime/brokers/payloads.py)
- [workers.py](/Users/alexandershubert/git/helix/helix-runtime/src/helix_runtime/brokers/workers.py)

These adapters are optional and require broker extras:

```bash
pip install -e ./helix-runtime[brokers]
```

The application processors remain broker-agnostic. Kafka and RabbitMQ only
transport tasks and update events.
