"""Broker configuration helpers for helix-runtime."""

from __future__ import annotations

import os
from dataclasses import dataclass

from .topology import (
    ALERT_CREATED_TOPIC,
    MARKETDATA_UPDATED_TOPIC,
    PL_UPDATED_TOPIC,
    PORTFOLIO_RECOMPUTE_QUEUE,
    POSITIONS_UPDATED_TOPIC,
    RISK_UPDATED_TOPIC,
    TRADE_COMPUTE_QUEUE,
    TRADE_AMENDED_TOPIC,
    TRADE_CANCELLED_TOPIC,
    TRADE_CREATED_TOPIC,
    TRADE_UPDATED_TOPIC,
)


@dataclass(frozen=True)
class KafkaConfig:
    bootstrap_servers: str
    trade_created_topic: str = TRADE_CREATED_TOPIC
    trade_updated_topic: str = TRADE_UPDATED_TOPIC
    trade_amended_topic: str = TRADE_AMENDED_TOPIC
    trade_cancelled_topic: str = TRADE_CANCELLED_TOPIC
    marketdata_updated_topic: str = MARKETDATA_UPDATED_TOPIC
    positions_updated_topic: str = POSITIONS_UPDATED_TOPIC
    pl_updated_topic: str = PL_UPDATED_TOPIC
    risk_updated_topic: str = RISK_UPDATED_TOPIC
    alert_created_topic: str = ALERT_CREATED_TOPIC
    consumer_group_id: str = "helix-runtime"


@dataclass(frozen=True)
class RabbitMqConfig:
    host: str
    port: int
    username: str
    password: str
    virtual_host: str = "/"
    portfolio_recompute_queue: str = PORTFOLIO_RECOMPUTE_QUEUE
    trade_compute_queue: str = TRADE_COMPUTE_QUEUE


def load_kafka_config_from_env() -> KafkaConfig:
    return KafkaConfig(
        bootstrap_servers=os.environ.get("HELIX_KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
        trade_created_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_CREATED", TRADE_CREATED_TOPIC),
        trade_updated_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_UPDATED", TRADE_UPDATED_TOPIC),
        trade_amended_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_AMENDED", TRADE_AMENDED_TOPIC),
        trade_cancelled_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_CANCELLED", TRADE_CANCELLED_TOPIC),
        marketdata_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_MARKETDATA_UPDATED",
            MARKETDATA_UPDATED_TOPIC,
        ),
        positions_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_POSITIONS_UPDATED",
            POSITIONS_UPDATED_TOPIC,
        ),
        pl_updated_topic=os.environ.get("HELIX_KAFKA_TOPIC_PL_UPDATED", PL_UPDATED_TOPIC),
        risk_updated_topic=os.environ.get("HELIX_KAFKA_TOPIC_RISK_UPDATED", RISK_UPDATED_TOPIC),
        alert_created_topic=os.environ.get("HELIX_KAFKA_TOPIC_ALERT_CREATED", ALERT_CREATED_TOPIC),
        consumer_group_id=os.environ.get("HELIX_KAFKA_CONSUMER_GROUP", "helix-runtime"),
    )


def load_rabbitmq_config_from_env() -> RabbitMqConfig:
    return RabbitMqConfig(
        host=os.environ.get("HELIX_RABBITMQ_HOST", "localhost"),
        port=int(os.environ.get("HELIX_RABBITMQ_PORT", "5672")),
        username=os.environ.get("HELIX_RABBITMQ_USERNAME", "guest"),
        password=os.environ.get("HELIX_RABBITMQ_PASSWORD", "guest"),
        virtual_host=os.environ.get("HELIX_RABBITMQ_VHOST", "/"),
        portfolio_recompute_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE",
            PORTFOLIO_RECOMPUTE_QUEUE,
        ),
        trade_compute_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE",
            TRADE_COMPUTE_QUEUE,
        ),
    )
