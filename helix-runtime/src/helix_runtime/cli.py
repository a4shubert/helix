"""Command-line entrypoints for Helix runtime workflows."""

from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Sequence

from .consumers import KafkaTradeCreatedConsumer, RabbitMqTaskWorker
from .config import load_kafka_config_from_env, load_rabbitmq_config_from_env
from .publisher import InMemoryEventPublisher, LoggingEventPublisher
from .service import RuntimeService, RuntimeServiceConfig
from .sqlite_store import SqliteHelixStore
from .models import TradeCreatedEvent
from .processor import TradeCreatedProcessor
from .events import build_trade_created_payload, parse_trade_created_payload


def _parse_datetime(raw: str) -> datetime:
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Helix runtime command-line tools.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    process_trade = subparsers.add_parser(
        "process-trade-created",
        help="Process a trade.created event against the SQLite store.",
    )
    process_trade.add_argument("--trade-id", required=True, help="Accepted trade identifier.")
    process_trade.add_argument("--portfolio-id", required=True, help="Affected portfolio identifier.")
    process_trade.add_argument(
        "--occurred-at",
        default=None,
        help="Event timestamp in ISO 8601 format. Defaults to current UTC time.",
    )
    process_trade.add_argument(
        "--db-path",
        default=os.environ.get("HELIX_DB_PATH", "helix-store/helix.db"),
        help="Path to the Helix SQLite database.",
    )
    process_trade.add_argument(
        "--publisher",
        choices=("log", "memory"),
        default="log",
        help="Publisher implementation to use during local processing.",
    )

    parse_trade = subparsers.add_parser(
        "process-trade-created-message",
        help="Process a Kafka-style trade.created JSON envelope.",
    )
    parse_trade.add_argument(
        "--message-file",
        required=True,
        help="Path to a JSON file containing the trade.created event payload.",
    )
    parse_trade.add_argument(
        "--db-path",
        default=os.environ.get("HELIX_DB_PATH", "helix-store/helix.db"),
        help="Path to the Helix SQLite database.",
    )
    parse_trade.add_argument(
        "--publisher",
        choices=("log", "memory"),
        default="log",
        help="Publisher implementation to use during local processing.",
    )

    build_message = subparsers.add_parser(
        "build-trade-created-message",
        help="Build a README-aligned trade.created JSON envelope.",
    )
    build_message.add_argument("--trade-id", required=True, help="Accepted trade identifier.")
    build_message.add_argument("--portfolio-id", required=True, help="Affected portfolio identifier.")
    build_message.add_argument(
        "--occurred-at",
        default=None,
        help="Event timestamp in ISO 8601 format. Defaults to current UTC time.",
    )

    kafka_consumer = subparsers.add_parser(
        "run-kafka-trade-consumer",
        help="Run the long-lived Kafka consumer for trade.created.",
    )
    kafka_consumer.add_argument(
        "--db-path",
        default=os.environ.get("HELIX_DB_PATH", "helix-store/helix.db"),
        help="Path to the Helix SQLite database.",
    )
    kafka_consumer.add_argument(
        "--max-messages",
        type=int,
        default=None,
        help="Optional cap on messages to process before exiting.",
    )

    rabbit_worker = subparsers.add_parser(
        "run-rabbitmq-worker",
        help="Run the long-lived RabbitMQ task worker.",
    )
    rabbit_worker.add_argument(
        "--db-path",
        default=os.environ.get("HELIX_DB_PATH", "helix-store/helix.db"),
        help="Path to the Helix SQLite database.",
    )
    rabbit_worker.add_argument(
        "--queue",
        action="append",
        dest="queues",
        default=None,
        help="Optional queue name to listen on. May be specified multiple times.",
    )
    rabbit_worker.add_argument(
        "--max-tasks",
        type=int,
        default=None,
        help="Optional cap on tasks to process before exiting.",
    )

    service = subparsers.add_parser(
        "run-service",
        help="Run the combined helix-runtime service with Kafka and RabbitMQ workers.",
    )
    service.add_argument(
        "--db-path",
        default=os.environ.get("HELIX_DB_PATH", "helix-store/helix.db"),
        help="Path to the Helix SQLite database.",
    )

    return parser


def _process_trade_created(args: argparse.Namespace) -> int:
    db_path = Path(args.db_path).resolve()
    occurred_at = _parse_datetime(args.occurred_at) if args.occurred_at else datetime.now(UTC)
    store = SqliteHelixStore(db_path)
    publisher = LoggingEventPublisher() if args.publisher == "log" else InMemoryEventPublisher()
    processor = TradeCreatedProcessor(store, publisher)

    result = processor.process(
        TradeCreatedEvent(
            trade_id=args.trade_id,
            portfolio_id=args.portfolio_id,
            occurred_at=occurred_at,
        )
    )

    summary = {
        "trade_id": result.trade_id,
        "portfolio_id": result.portfolio_id,
        "valuation_ts": result.persisted.valuation_ts.isoformat(),
        "market_data_as_of_ts": result.persisted.market_data_as_of_ts.isoformat(),
        "position_snapshot_ids": result.persisted.position_snapshot_ids,
        "pnl_snapshot_id": result.persisted.pnl_snapshot_id,
        "risk_snapshot_id": result.persisted.risk_snapshot_id,
        "published_events": [
            {
                "topic": event.topic,
                "portfolio_id": event.portfolio_id,
                "snapshot_id": event.snapshot_id,
                "occurred_at": event.occurred_at.isoformat(),
            }
            for event in result.published_events
        ],
    }
    print(json.dumps(summary, indent=2))
    return 0


def _process_trade_created_message(args: argparse.Namespace) -> int:
    db_path = Path(args.db_path).resolve()
    message_payload = Path(args.message_file).read_text(encoding="utf-8")
    event = parse_trade_created_payload(message_payload)
    store = SqliteHelixStore(db_path)
    publisher = LoggingEventPublisher() if args.publisher == "log" else InMemoryEventPublisher()
    processor = TradeCreatedProcessor(store, publisher)
    result = processor.process(event)
    print(
        json.dumps(
            {
                "trade_id": result.trade_id,
                "portfolio_id": result.portfolio_id,
                "pnl_snapshot_id": result.persisted.pnl_snapshot_id,
                "risk_snapshot_id": result.persisted.risk_snapshot_id,
                "published_event_count": len(result.published_events),
            },
            indent=2,
        )
    )
    return 0


def _build_trade_created_message(args: argparse.Namespace) -> int:
    occurred_at = _parse_datetime(args.occurred_at) if args.occurred_at else datetime.now(UTC)
    payload = build_trade_created_payload(
        TradeCreatedEvent(
            trade_id=args.trade_id,
            portfolio_id=args.portfolio_id,
            occurred_at=occurred_at,
        )
    )
    print(json.dumps(payload, indent=2))
    return 0


def _run_kafka_trade_consumer(args: argparse.Namespace) -> int:
    db_path = str(Path(args.db_path).resolve())
    config = load_kafka_config_from_env()
    consumer = KafkaTradeCreatedConsumer(db_path, config)
    processed = consumer.run(max_messages=args.max_messages)
    print(
        json.dumps(
            {
                "processed_messages": processed,
                "topic": config.trade_created_topic,
            },
            indent=2,
        )
    )
    return 0


def _run_rabbitmq_worker(args: argparse.Namespace) -> int:
    db_path = str(Path(args.db_path).resolve())
    config = load_rabbitmq_config_from_env()
    kafka_config = load_kafka_config_from_env()
    worker = RabbitMqTaskWorker(db_path, config, kafka_config)
    queue_names = tuple(args.queues) if args.queues else None
    processed = worker.run(queue_names=queue_names, max_tasks=args.max_tasks)
    print(
        json.dumps(
            {
                "processed_tasks": processed,
                "queues": list(queue_names or ()),
            },
            indent=2,
        )
    )
    return 0


def _run_service(args: argparse.Namespace) -> int:
    db_path = str(Path(args.db_path).resolve())
    service = RuntimeService(
        RuntimeServiceConfig(
            db_path=db_path,
            kafka=load_kafka_config_from_env(),
            rabbitmq=load_rabbitmq_config_from_env(),
        )
    )
    service.run()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "process-trade-created":
        return _process_trade_created(args)
    if args.command == "process-trade-created-message":
        return _process_trade_created_message(args)
    if args.command == "build-trade-created-message":
        return _build_trade_created_message(args)
    if args.command == "run-kafka-trade-consumer":
        return _run_kafka_trade_consumer(args)
    if args.command == "run-rabbitmq-worker":
        return _run_rabbitmq_worker(args)
    if args.command == "run-service":
        return _run_service(args)

    parser.error(f"Unsupported command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
