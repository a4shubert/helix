"""Concrete Kafka and RabbitMQ adapters for Helix runtime."""

from __future__ import annotations

import json
from dataclasses import dataclass

from .config import KafkaConfig, RabbitMqConfig
from .events import RabbitMqTask, build_portfolio_update_payload, kafka_topic_for_update
from .models import PortfolioUpdateEvent


class KafkaUpdatePublisher:
    """Publish update events to Kafka as JSON payloads."""

    def __init__(self, config: KafkaConfig) -> None:
        self._config = config
        self._producer = None

    def publish(self, topic: str, payload: dict[str, object]) -> None:
        producer = self._get_producer()
        producer.send(topic, value=payload)
        producer.flush()

    def publish_update(self, event: PortfolioUpdateEvent) -> None:
        topic = kafka_topic_for_update(event, self._config)
        payload = build_portfolio_update_payload(event)
        self.publish(topic, payload)

    def _get_producer(self):
        if self._producer is None:
            try:
                from kafka import KafkaProducer
            except ImportError as exc:
                raise RuntimeError(
                    "Kafka support requires the optional dependency "
                    "'kafka-python'. Install helix-runtime with broker extras."
                ) from exc

            self._producer = KafkaProducer(
                bootstrap_servers=self._config.bootstrap_servers.split(","),
                value_serializer=lambda value: json.dumps(value).encode("utf-8"),
            )
        return self._producer


@dataclass(frozen=True)
class PublishedRabbitMqTask:
    queue: str
    payload: dict[str, object]


class RabbitMqTaskPublisher:
    """Publish operational tasks to RabbitMQ queues."""

    def __init__(self, config: RabbitMqConfig) -> None:
        self._config = config

    def publish_task(self, queue: str, task: RabbitMqTask) -> PublishedRabbitMqTask:
        payload = task.to_payload()
        channel = self._open_channel()
        channel.queue_declare(queue=queue, durable=True)
        channel.basic_publish(
            exchange="",
            routing_key=queue,
            body=json.dumps(payload).encode("utf-8"),
            properties=self._properties(),
        )
        return PublishedRabbitMqTask(queue=queue, payload=payload)

    def _open_channel(self):
        try:
            import pika
        except ImportError as exc:
            raise RuntimeError(
                "RabbitMQ support requires the optional dependency "
                "'pika'. Install helix-runtime with broker extras."
            ) from exc

        credentials = pika.PlainCredentials(self._config.username, self._config.password)
        parameters = pika.ConnectionParameters(
            host=self._config.host,
            port=self._config.port,
            virtual_host=self._config.virtual_host,
            credentials=credentials,
        )
        connection = pika.BlockingConnection(parameters)
        return connection.channel()

    @staticmethod
    def _properties():
        import pika

        return pika.BasicProperties(delivery_mode=2, content_type="application/json")
