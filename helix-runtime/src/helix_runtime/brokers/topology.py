"""Shared broker topic and queue names for Helix."""

from __future__ import annotations

TRADE_CREATED_TOPIC = "trade.created"
TRADE_UPDATED_TOPIC = "trade.updated"
TRADE_AMENDED_TOPIC = "trade.amended"
TRADE_CANCELLED_TOPIC = "trade.cancelled"
MARKETDATA_UPDATED_TOPIC = "marketdata.updated"
POSITIONS_UPDATED_TOPIC = "positions.updated"
PL_UPDATED_TOPIC = "pl.updated"
RISK_UPDATED_TOPIC = "risk.updated"
ALERT_CREATED_TOPIC = "alert.created"

KAFKA_TOPICS = (
    TRADE_CREATED_TOPIC,
    TRADE_UPDATED_TOPIC,
    TRADE_AMENDED_TOPIC,
    TRADE_CANCELLED_TOPIC,
    MARKETDATA_UPDATED_TOPIC,
    POSITIONS_UPDATED_TOPIC,
    PL_UPDATED_TOPIC,
    RISK_UPDATED_TOPIC,
    ALERT_CREATED_TOPIC,
)

PORTFOLIO_RECOMPUTE_QUEUE = "portfolio.recompute"
TRADE_COMPUTE_QUEUE = "trade.compute"

RABBITMQ_QUEUES = (
    PORTFOLIO_RECOMPUTE_QUEUE,
    TRADE_COMPUTE_QUEUE,
)
