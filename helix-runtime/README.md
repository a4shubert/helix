# helix-runtime

Asynchronous runtime and worker library for the Helix platform.

## Purpose

`helix-runtime` is the orchestration layer that reacts to accepted trades, rebuilds
portfolio state through `helix-core`, persists refreshed snapshots, and publishes
follow-up update events.

The first implemented path is:

1. Consume `trade.created`
2. Load the affected portfolio trades and latest market inputs from `helix-store`
3. Call `helix-core.compute_portfolio_analytics(...)`
4. Persist refreshed `position_snapshot`, `pnl_snapshot`, and `risk_snapshot`
5. Mark the triggering trade as `processed`
6. Publish `portfolio.updated`, `pnl.updated`, and `risk.updated`

## Modules

- `helix_runtime.processor.TradeCreatedProcessor`
  - application service for the `trade.created` flow
- `helix_runtime.sqlite_store.SqliteHelixStore`
  - SQLite-backed store adapter over `helix.db`
- `helix_runtime.publisher`
  - simple publisher implementations for local development and tests

## RabbitMQ and Kafka Roles

Use Kafka for domain events that other services may replay or subscribe to:

- `trade.created`
- `portfolio.updated`
- `pnl.updated`
- `risk.updated`

Use RabbitMQ for operational work queues where point-to-point delivery is a better
fit than event history:

- `positions.build`
- `pl.compute`
- `risk.compute`

That split keeps business events auditable in Kafka while letting RabbitMQ handle
worker-style jobs cleanly.

## Local Use

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 - <<'PY'
from datetime import UTC, datetime

from helix_runtime import InMemoryEventPublisher, SqliteHelixStore, TradeCreatedEvent, TradeCreatedProcessor

store = SqliteHelixStore("helix-store/helix.db")
publisher = InMemoryEventPublisher()
processor = TradeCreatedProcessor(store, publisher)

result = processor.process(
    TradeCreatedEvent(
        trade_id="TRD-POS-001-01",
        portfolio_id="PF-001",
        occurred_at=datetime.now(UTC),
    )
)

print(result)
print(publisher.published)
PY
```

Or through the runtime CLI:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli process-trade-created \
  --db-path helix-store/helix.db \
  --portfolio-id PF-001 \
  --trade-id TRD-POS-001-01 \
  --occurred-at 2026-03-21T12:00:00Z
```

## Runtime Worker Modes

`helix-runtime` can now run as an actual long-lived worker:

- Kafka consumer for `trade.created`
- RabbitMQ worker for operational task queues

Run the Kafka consumer:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli run-kafka-trade-consumer \
  --db-path helix-store/helix.db
```

Run the RabbitMQ worker:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli run-rabbitmq-worker \
  --db-path helix-store/helix.db
```

Run the combined runtime service:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli run-service \
  --db-path helix-store/helix.db
```

For controlled local testing, both support bounded runs:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli run-kafka-trade-consumer \
  --db-path helix-store/helix.db \
  --max-messages 1

PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli run-rabbitmq-worker \
  --db-path helix-store/helix.db \
  --max-tasks 1
```

## Next Broker Adapters

The next concrete integration points should be:

- Kafka consumer for `trade.created`
  - deserialize the event
  - call `TradeCreatedProcessor.process(...)`
- Kafka producer for `portfolio.updated`, `pnl.updated`, and `risk.updated`
  - replace `LoggingEventPublisher`
- RabbitMQ worker for operational jobs
  - submit/consume tasks like `positions.build`
  - use the same processor/store primitives rather than duplicating business logic

## Broker Adapters

`helix-runtime` now includes concrete broker-facing adapters:

- [brokers.py](/Users/alexandershubert/git/helix/helix-runtime/src/helix_runtime/brokers.py)
  - `KafkaUpdatePublisher`
  - `RabbitMqTaskPublisher`
- [config.py](/Users/alexandershubert/git/helix/helix-runtime/src/helix_runtime/config.py)
  - env-based Kafka and RabbitMQ settings
- [events.py](/Users/alexandershubert/git/helix/helix-runtime/src/helix_runtime/events.py)
  - JSON payload builders/parsers aligned with the README event contracts

These adapters are optional and require broker extras:

```bash
pip install -e ./helix-runtime[brokers]
```

The processor itself still does not depend on Kafka or RabbitMQ. That separation is
intentional: the broker layer only transports messages, while the application logic
stays in `TradeCreatedProcessor`.

## Broker-Oriented CLI

Build a README-aligned `trade.created` payload:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli build-trade-created-message \
  --portfolio-id PF-001 \
  --trade-id TRD-POS-001-01 \
  --occurred-at 2026-03-21T12:00:00Z
```

Process a `trade.created` JSON file as if it came from Kafka:

```bash
PYTHONPATH=helix-core/src:helix-runtime/src python3 -m helix_runtime.cli process-trade-created-message \
  --db-path helix-store/helix.db \
  --message-file /path/to/trade-created.json
```
