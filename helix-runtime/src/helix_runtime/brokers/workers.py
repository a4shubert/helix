"""Long-running Kafka and RabbitMQ consumer loops for helix-runtime."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from helix_runtime.application.processors import (
    PortfolioPlComputeProcessor,
    PortfolioRiskComputeProcessor,
    PositionPlComputeProcessor,
    TradeComputeProcessor,
)
from helix_runtime.infrastructure.sqlite_store import SqliteHelixStore

from .adapters import KafkaUpdatePublisher, RabbitMqTaskPublisher
from .config import KafkaConfig, RabbitMqConfig
from .payloads import RabbitMqTask


def _parse_task_payload(body: bytes | str | dict[str, Any]) -> RabbitMqTask:
    if isinstance(body, bytes):
        data = json.loads(body.decode("utf-8"))
    elif isinstance(body, str):
        data = json.loads(body)
    else:
        data = body

    requested_at = str(data["requestedAt"])
    if requested_at.endswith("Z"):
        requested_at = requested_at[:-1] + "+00:00"

    return RabbitMqTask(
        task_id=str(data["taskId"]),
        task_type=str(data["taskType"]),
        portfolio_id=str(data["portfolioId"]),
        requested_at=datetime.fromisoformat(requested_at).astimezone(UTC),
        source_event_id=str(data["sourceEventId"]) if data.get("sourceEventId") else None,
    )


class RabbitMqTaskWorker:
    """Consume RabbitMQ tasks and dispatch them to runtime processors."""

    def __init__(self, db_path: str, config: RabbitMqConfig, kafka_config: KafkaConfig) -> None:
        self._db_path = db_path
        self._config = config
        self._kafka_config = kafka_config

    def run(self, *, queue_names: tuple[str, ...] | None = None, max_tasks: int | None = None) -> int:
        try:
            import pika
        except ImportError as exc:
            raise RuntimeError(
                "RabbitMQ worker support requires 'pika'. "
                "Install helix-runtime with broker extras."
            ) from exc

        store = SqliteHelixStore(self._db_path)
        publisher = KafkaUpdatePublisher(self._kafka_config)
        task_publisher = RabbitMqTaskPublisher(self._config)
        position_pl_processor = PositionPlComputeProcessor(store, publisher, task_publisher, self._config)
        portfolio_pl_processor = PortfolioPlComputeProcessor(store, publisher)
        portfolio_risk_processor = PortfolioRiskComputeProcessor(store, publisher)
        trade_compute_processor = TradeComputeProcessor(store, publisher)
        target_queues = queue_names or (
            self._config.trade_compute_queue,
            self._config.position_pl_compute_queue,
            self._config.portfolio_pl_compute_queue,
            self._config.portfolio_risk_compute_queue,
        )

        credentials = pika.PlainCredentials(self._config.username, self._config.password)
        parameters = pika.ConnectionParameters(
            host=self._config.host,
            port=self._config.port,
            virtual_host=self._config.virtual_host,
            credentials=credentials,
        )
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        channel.basic_qos(prefetch_count=1)

        for queue in target_queues:
            channel.queue_declare(queue=queue, durable=True)

        print(
            f"[helix-runtime] RabbitMQ worker listening on {self._config.host}:{self._config.port} "
            f"queues={', '.join(target_queues)}"
        )

        processed = 0

        def callback(ch, method, _properties, body):
            nonlocal processed
            task = _parse_task_payload(body)
            try:
                if method.routing_key == self._config.position_pl_compute_queue:
                    result = position_pl_processor.process(task)
                    print(
                        "[helix-runtime] processed rabbitmq task "
                        f"task_id={result.task_id} task_type={result.task_type} "
                        f"portfolio_id={result.portfolio_id} snapshots={len(result.snapshot_ids)} "
                        f"published={len(result.published_events)}"
                    )
                elif method.routing_key == self._config.portfolio_pl_compute_queue:
                    result = portfolio_pl_processor.process(task)
                    print(
                        "[helix-runtime] processed rabbitmq task "
                        f"task_id={result.task_id} task_type={result.task_type} "
                        f"portfolio_id={result.portfolio_id} snapshots={len(result.snapshot_ids)} "
                        f"published={len(result.published_events)}"
                    )
                elif method.routing_key == self._config.portfolio_risk_compute_queue:
                    result = portfolio_risk_processor.process(task)
                    print(
                        "[helix-runtime] processed rabbitmq task "
                        f"task_id={result.task_id} task_type={result.task_type} "
                        f"portfolio_id={result.portfolio_id} snapshots={len(result.snapshot_ids)} "
                        f"published={len(result.published_events)}"
                    )
                elif method.routing_key == self._config.trade_compute_queue:
                    result = trade_compute_processor.process(task)
                    print(
                        "[helix-runtime] processed rabbitmq task "
                        f"task_id={result['task_id']} task_type={result['task_type']} "
                        f"portfolio_id={result['portfolio_id']} trade_id={result['trade_id']} "
                        f"notional={result['notional']}"
                    )
                else:
                    raise ValueError(
                        f"No task handler registered for queue '{method.routing_key}'."
                    )
                ch.basic_ack(delivery_tag=method.delivery_tag)
                processed += 1
                if max_tasks is not None and processed >= max_tasks:
                    ch.stop_consuming()
            except Exception as exc:
                print(
                    f"[helix-runtime] task processing failed for queue "
                    f"'{method.routing_key}': {exc}"
                )
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                if max_tasks is not None:
                    ch.stop_consuming()

        for queue in target_queues:
            channel.basic_consume(queue=queue, on_message_callback=callback)

        try:
            channel.start_consuming()
        finally:
            if connection.is_open:
                connection.close()

        return processed
