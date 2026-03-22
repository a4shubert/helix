"""Broker configuration helpers for helix-runtime."""

from __future__ import annotations

import os
from dataclasses import dataclass

from .topology import (
    PL_UPDATED_TOPIC,
    PORTFOLIO_COMPUTE_QUEUE,
    PORTFOLIO_UPDATED_TOPIC,
    RISK_UPDATED_TOPIC,
    TRADE_COMPUTE_QUEUE,
    TRADE_UPDATED_TOPIC,
)


@dataclass(frozen=True)
class KafkaConfig:
    bootstrap_servers: str
    trade_updated_topic: str = TRADE_UPDATED_TOPIC
    portfolio_updated_topic: str = PORTFOLIO_UPDATED_TOPIC
    pl_updated_topic: str = PL_UPDATED_TOPIC
    risk_updated_topic: str = RISK_UPDATED_TOPIC


@dataclass(frozen=True)
class RabbitMqConfig:
    host: str
    port: int
    username: str
    password: str
    virtual_host: str = "/"
    portfolio_compute_queue: str = PORTFOLIO_COMPUTE_QUEUE
    trade_compute_queue: str = TRADE_COMPUTE_QUEUE


def load_kafka_config_from_env() -> KafkaConfig:
    return KafkaConfig(
        bootstrap_servers=os.environ.get("HELIX_KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
        trade_updated_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_UPDATED", TRADE_UPDATED_TOPIC),
        portfolio_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_PORTFOLIO_UPDATED",
            PORTFOLIO_UPDATED_TOPIC,
        ),
        pl_updated_topic=os.environ.get("HELIX_KAFKA_TOPIC_PL_UPDATED", PL_UPDATED_TOPIC),
        risk_updated_topic=os.environ.get("HELIX_KAFKA_TOPIC_RISK_UPDATED", RISK_UPDATED_TOPIC),
    )


def load_rabbitmq_config_from_env() -> RabbitMqConfig:
    return RabbitMqConfig(
        host=os.environ.get("HELIX_RABBITMQ_HOST", "localhost"),
        port=int(os.environ.get("HELIX_RABBITMQ_PORT", "5672")),
        username=os.environ.get("HELIX_RABBITMQ_USERNAME", "guest"),
        password=os.environ.get("HELIX_RABBITMQ_PASSWORD", "guest"),
        virtual_host=os.environ.get("HELIX_RABBITMQ_VHOST", "/"),
        portfolio_compute_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_PORTFOLIO_COMPUTE",
            PORTFOLIO_COMPUTE_QUEUE,
        ),
        trade_compute_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE",
            TRADE_COMPUTE_QUEUE,
        ),
    )
