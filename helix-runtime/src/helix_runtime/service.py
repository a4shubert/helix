"""Combined runtime service for running all long-lived Helix workers."""

from __future__ import annotations

import queue
import threading
import time
from dataclasses import dataclass

from .config import KafkaConfig, RabbitMqConfig
from .consumers import KafkaTradeCreatedConsumer, RabbitMqTaskWorker


@dataclass(frozen=True)
class RuntimeServiceConfig:
    db_path: str
    kafka: KafkaConfig
    rabbitmq: RabbitMqConfig


class RuntimeService:
    """Run Kafka and RabbitMQ worker loops together as one local service."""

    def __init__(self, config: RuntimeServiceConfig) -> None:
        self._config = config

    def run(self) -> None:
        errors: queue.Queue[BaseException] = queue.Queue()

        kafka_consumer = KafkaTradeCreatedConsumer(self._config.db_path, self._config.kafka)
        rabbit_worker = RabbitMqTaskWorker(
            self._config.db_path,
            self._config.rabbitmq,
            self._config.kafka,
        )

        threads = [
            threading.Thread(
                target=self._run_named,
                args=("kafka-trade-consumer", kafka_consumer.run, errors),
                daemon=True,
            ),
            threading.Thread(
                target=self._run_named,
                args=("rabbitmq-worker", rabbit_worker.run, errors),
                daemon=True,
            ),
        ]

        for thread in threads:
            thread.start()

        print("[helix-runtime] service started: kafka-trade-consumer + rabbitmq-worker")

        try:
            while True:
                for thread in threads:
                    if not thread.is_alive():
                        raise RuntimeError(f"Runtime worker thread '{thread.name}' stopped unexpectedly.")
                try:
                    error = errors.get_nowait()
                except queue.Empty:
                    time.sleep(0.5)
                    continue
                raise error
        except KeyboardInterrupt:
            print("[helix-runtime] service stopping on keyboard interrupt")

    @staticmethod
    def _run_named(
        worker_name: str,
        target,
        errors: queue.Queue[BaseException],
    ) -> None:
        threading.current_thread().name = worker_name
        try:
            target()
        except BaseException as exc:
            errors.put(exc)
