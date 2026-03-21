"""Broker configuration helpers for helix-runtime."""

from __future__ import annotations

import os
from dataclasses import dataclass

from .broker_names import (
    ALERT_CREATED_TOPIC,
    MARKETDATA_UPDATED_TOPIC,
    PNL_UPDATED_TOPIC,
    PORTFOLIO_FULL_REVALUE_QUEUE,
    PORTFOLIO_UPDATED_TOPIC,
    REBUILD_POSITIONS_QUEUE,
    RECOMPUTE_RISK_FULL_QUEUE,
    REPORT_GENERATE_QUEUE,
    RISK_UPDATED_TOPIC,
    TRADE_AMENDED_TOPIC,
    TRADE_CANCELLED_TOPIC,
    TRADE_CREATED_TOPIC,
)


@dataclass(frozen=True)
class KafkaConfig:
    bootstrap_servers: str
    trade_created_topic: str = TRADE_CREATED_TOPIC
    trade_amended_topic: str = TRADE_AMENDED_TOPIC
    trade_cancelled_topic: str = TRADE_CANCELLED_TOPIC
    marketdata_updated_topic: str = MARKETDATA_UPDATED_TOPIC
    portfolio_updated_topic: str = PORTFOLIO_UPDATED_TOPIC
    pnl_updated_topic: str = PNL_UPDATED_TOPIC
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
    portfolio_full_revalue_queue: str = PORTFOLIO_FULL_REVALUE_QUEUE
    rebuild_positions_queue: str = REBUILD_POSITIONS_QUEUE
    recompute_risk_full_queue: str = RECOMPUTE_RISK_FULL_QUEUE
    report_generate_queue: str = REPORT_GENERATE_QUEUE


def load_kafka_config_from_env() -> KafkaConfig:
    return KafkaConfig(
        bootstrap_servers=os.environ.get("HELIX_KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
        trade_created_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_CREATED", TRADE_CREATED_TOPIC),
        trade_amended_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_AMENDED", TRADE_AMENDED_TOPIC),
        trade_cancelled_topic=os.environ.get("HELIX_KAFKA_TOPIC_TRADE_CANCELLED", TRADE_CANCELLED_TOPIC),
        marketdata_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_MARKETDATA_UPDATED",
            MARKETDATA_UPDATED_TOPIC,
        ),
        portfolio_updated_topic=os.environ.get(
            "HELIX_KAFKA_TOPIC_PORTFOLIO_UPDATED",
            PORTFOLIO_UPDATED_TOPIC,
        ),
        pnl_updated_topic=os.environ.get("HELIX_KAFKA_TOPIC_PNL_UPDATED", PNL_UPDATED_TOPIC),
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
        portfolio_full_revalue_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_PORTFOLIO_FULL_REVALUE",
            PORTFOLIO_FULL_REVALUE_QUEUE,
        ),
        rebuild_positions_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_REBUILD_POSITIONS",
            REBUILD_POSITIONS_QUEUE,
        ),
        recompute_risk_full_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_RECOMPUTE_RISK_FULL",
            RECOMPUTE_RISK_FULL_QUEUE,
        ),
        report_generate_queue=os.environ.get(
            "HELIX_RABBITMQ_QUEUE_REPORT_GENERATE",
            REPORT_GENERATE_QUEUE,
        ),
    )
