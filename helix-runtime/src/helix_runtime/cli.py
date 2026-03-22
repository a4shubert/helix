"""Command-line entrypoints for Helix runtime workflows."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Sequence

from .application.service import RuntimeService, RuntimeServiceConfig
from .brokers.adapters import RabbitMqTaskPublisher
from .brokers.config import load_kafka_config_from_env, load_rabbitmq_config_from_env
from .brokers.payloads import RabbitMqTask
from .brokers.workers import RabbitMqTaskWorker


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
        help="Run the long-lived helix-runtime RabbitMQ worker service.",
    )
    service.add_argument(
        "--db-path",
        default=os.environ.get("HELIX_DB_PATH", "helix-store/helix.db"),
        help="Path to the Helix SQLite database.",
    )

    replay = subparsers.add_parser(
        "replay-trades",
        help="Clear live snapshots and rebuild them by replaying all trades through Kafka and RabbitMQ.",
    )
    replay.add_argument(
        "--db-path",
        default=os.environ.get("HELIX_DB_PATH", "helix-store/helix.db"),
        help="Path to the Helix SQLite database.",
    )
    replay.add_argument(
        "--skip-rabbitmq",
        action="store_true",
        help="Skip RabbitMQ position.pl.compute and trade.compute task publishing during replay.",
    )

    return parser


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


def _reset_live_snapshots(db_path: Path) -> dict[str, int]:
    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON;")
        counts = {
            "position": connection.execute("SELECT COUNT(*) FROM position").fetchone()[0],
            "pnl": connection.execute("SELECT COUNT(*) FROM pnl").fetchone()[0],
            "risk": connection.execute("SELECT COUNT(*) FROM risk").fetchone()[0],
        }

        connection.execute("DELETE FROM position")
        connection.execute("DELETE FROM pnl")
        connection.execute("DELETE FROM risk")
        connection.execute(
            """
            UPDATE trades
            SET status = 'accepted', updated_at = created_at
            WHERE status IN ('accepted', 'processed')
            """
        )
        connection.commit()

    return counts


def _load_replay_trades(db_path: Path) -> list[tuple[str, str, datetime]]:
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT trade_id, portfolio_id, trade_timestamp
            FROM trades
            WHERE status IN ('accepted', 'processed')
            ORDER BY trade_timestamp, created_at, trade_id
            """
        ).fetchall()

    return [
        (str(trade_id), str(portfolio_id), _parse_datetime(str(trade_timestamp)))
        for trade_id, portfolio_id, trade_timestamp in rows
    ]


def _replay_trades(args: argparse.Namespace) -> int:
    db_path = Path(args.db_path).resolve()
    rabbitmq_config = load_rabbitmq_config_from_env()

    cleared_counts = _reset_live_snapshots(db_path)
    trades = _load_replay_trades(db_path)

    queued_revalues: list[dict[str, object]] = []
    queued_trade_computes: list[dict[str, object]] = []
    if not args.skip_rabbitmq:
        task_publisher = RabbitMqTaskPublisher(rabbitmq_config)
        from uuid import uuid4
        for portfolio_id in sorted({portfolio_id for _, portfolio_id, _ in trades}):
            task = RabbitMqTask(
                task_id=f"TASK-{uuid4().hex[:12].upper()}",
                task_type=rabbitmq_config.position_pl_compute_queue,
                portfolio_id=portfolio_id,
                requested_at=datetime.now(UTC),
            )
            queued_revalues.append(
                task_publisher.publish_task(
                    rabbitmq_config.position_pl_compute_queue,
                    task,
                )
            )
        for trade_id, portfolio_id, _occurred_at in trades:
            task = RabbitMqTask(
                task_id=f"TASK-{uuid4().hex[:12].upper()}",
                task_type=rabbitmq_config.trade_compute_queue,
                portfolio_id=portfolio_id,
                requested_at=datetime.now(UTC),
                source_event_id=trade_id,
            )
            queued_trade_computes.append(
                task_publisher.publish_task(
                    rabbitmq_config.trade_compute_queue,
                    task,
                )
            )

    print(
        json.dumps(
            {
                "cleared": cleared_counts,
                "replayed_trade_count": len(trades),
                "rabbitmq_queue": None
                if args.skip_rabbitmq
                else rabbitmq_config.position_pl_compute_queue,
                "revalue_tasks": queued_revalues,
                "trade_compute_queue": None
                if args.skip_rabbitmq
                else rabbitmq_config.trade_compute_queue,
                "trade_compute_tasks": queued_trade_computes,
            },
            indent=2,
        )
    )
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "run-rabbitmq-worker":
        return _run_rabbitmq_worker(args)
    if args.command == "run-service":
        return _run_service(args)
    if args.command == "replay-trades":
        return _replay_trades(args)

    parser.error(f"Unsupported command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
