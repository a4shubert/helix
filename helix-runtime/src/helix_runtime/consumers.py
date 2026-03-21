"""Long-running Kafka and RabbitMQ consumer loops for helix-runtime."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from .broker_names import RABBITMQ_QUEUES
from .brokers import KafkaUpdatePublisher
from .config import KafkaConfig, RabbitMqConfig
from .events import RabbitMqTask, parse_trade_created_payload
from .processor import PortfolioFullRevalueProcessor, TradeCreatedProcessor
from .sqlite_store import SqliteHelixStore


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
    )


class KafkaTradeCreatedConsumer:
    """Consume trade.created events from Kafka and process them continuously."""

    def __init__(self, db_path: str, config: KafkaConfig) -> None:
        self._db_path = db_path
        self._config = config

    def run(self, *, max_messages: int | None = None) -> int:
        try:
            from kafka import KafkaConsumer
        except ImportError as exc:
            raise RuntimeError(
                "Kafka consumer support requires 'kafka-python'. "
                "Install helix-runtime with broker extras."
            ) from exc

        store = SqliteHelixStore(self._db_path)
        publisher = KafkaUpdatePublisher(self._config)
        processor = TradeCreatedProcessor(store, publisher)
        consumer = KafkaConsumer(
            self._config.trade_created_topic,
            bootstrap_servers=self._config.bootstrap_servers.split(","),
            group_id=self._config.consumer_group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
        )

        print(
            f"[helix-runtime] Kafka consumer listening on topic "
            f"'{self._config.trade_created_topic}' via {self._config.bootstrap_servers}"
        )

        processed = 0
        try:
            for message in consumer:
                try:
                    event = parse_trade_created_payload(message.value)
                except Exception as exc:
                    print(
                        "[helix-runtime] skipped invalid kafka message "
                        f"topic={message.topic} partition={message.partition} "
                        f"offset={message.offset}: {exc}"
                    )
                    continue
                result = processor.process(event)
                processed += 1
                print(
                    "[helix-runtime] processed trade.created "
                    f"trade_id={result.trade_id} portfolio_id={result.portfolio_id} "
                    f"published={len(result.published_events)}"
                )
                if max_messages is not None and processed >= max_messages:
                    break
        finally:
            consumer.close()

        return processed


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
        full_revalue_processor = PortfolioFullRevalueProcessor(store, publisher)
        target_queues = queue_names or RABBITMQ_QUEUES

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
                if method.routing_key == self._config.portfolio_full_revalue_queue:
                    result = full_revalue_processor.process(task)
                    print(
                        "[helix-runtime] processed rabbitmq task "
                        f"task_id={result.task_id} task_type={result.task_type} "
                        f"portfolio_id={result.portfolio_id} published={len(result.published_events)}"
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
