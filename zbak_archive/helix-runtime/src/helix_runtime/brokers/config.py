"""Broker configuration helpers for helix-runtime."""

from __future__ import annotations

import os
from dataclasses import dataclass

from .topology import (
    PORTFOLIO_PL_COMPUTE_QUEUE,
    PORTFOLIO_PL_UPDATED_TOPIC,
    PORTFOLIO_RISK_COMPUTE_QUEUE,
    PORTFOLIO_RISK_UPDATED_TOPIC,
    POSITION_PL_COMPUTE_QUEUE,
    POSITION_PL_UPDATED_TOPIC,
    POSITION_UPDATED_TOPIC,
    TRADE_COMPUTE_QUEUE,
    TRADE_UPDATED_TOPIC,
)


@dataclass(frozen=True)
class KafkaConfig:
    bootstrap_servers: str
    trade_updated_topic: str = TRADE_UPDATED_TOPIC
    position_updated_topic: str = POSITION_UPDATED_TOPIC
    position_pl_updated_topic: str = POSITION_PL_UPDATED_TOPIC
    portfolio_pl_updated_topic: str = PORTFOLIO_PL_UPDATED_TOPIC
    portfolio_risk_updated_topic: str = PORTFOLIO_RISK_UPDATED_TOPIC


@dataclass(frozen=True)
class RabbitMqConfig:
    host: str
    port: int
    username: str
    password: str
    virtual_host: str = "/"
    trade_compute_queue: str = TRADE_COMPUTE_QUEUE
    position_pl_compute_queue: str = POSITION_PL_COMPUTE_QUEUE
    portfolio_pl_compute_queue: str = PORTFOLIO_PL_COMPUTE_QUEUE
    portfolio_risk_compute_queue: str = PORTFOLIO_RISK_COMPUTE_QUEUE


def load_kafka_config_from_env() -> KafkaConfig:
    return KafkaConfig(
        bootstrap_servers=os.environ.get("HELIX_KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
        trade_updated_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_UPDATED", TRADE_UPDATED_TOPIC),
        position_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_POSITION_UPDATED",
            POSITION_UPDATED_TOPIC,
        ),
        position_pl_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_POSITION_PL_UPDATED",
            POSITION_PL_UPDATED_TOPIC,
        ),
        portfolio_pl_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_PORTFOLIO_PL_UPDATED",
            PORTFOLIO_PL_UPDATED_TOPIC,
        ),
        portfolio_risk_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_PORTFOLIO_RISK_UPDATED",
            PORTFOLIO_RISK_UPDATED_TOPIC,
        ),
    )


def load_rabbitmq_config_from_env() -> RabbitMqConfig:
    return RabbitMqConfig(
        host=os.environ.get("HELIX_RABBITMQ_HOST", "localhost"),
        port=int(os.environ.get("HELIX_RABBITMQ_PORT", "5672")),
        username=os.environ.get("HELIX_RABBITMQ_USERNAME", "guest"),
        password=os.environ.get("HELIX_RABBITMQ_PASSWORD", "guest"),
        virtual_host=os.environ.get("HELIX_RABBITMQ_VHOST", "/"),
        trade_compute_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE",
            TRADE_COMPUTE_QUEUE,
        ),
        position_pl_compute_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_POSITION_PL_COMPUTE",
            POSITION_PL_COMPUTE_QUEUE,
        ),
        portfolio_pl_compute_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_PORTFOLIO_PL_COMPUTE",
            PORTFOLIO_PL_COMPUTE_QUEUE,
        ),
        portfolio_risk_compute_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_PORTFOLIO_RISK_COMPUTE",
            PORTFOLIO_RISK_COMPUTE_QUEUE,
        ),
    )
