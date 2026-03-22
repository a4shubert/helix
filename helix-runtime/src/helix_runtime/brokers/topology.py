"""Shared broker topic and queue names for Helix."""

from __future__ import annotations

TRADE_DELETED_TOPIC = "trade.deleted"
TRADE_UPDATED_TOPIC = "trade.updated"
PORTFOLIO_UPDATED_TOPIC = "portfolio.updated"
PL_UPDATED_TOPIC = "pl.updated"
RISK_UPDATED_TOPIC = "risk.updated"

PORTFOLIO_COMPUTE_QUEUE = "portfolio.compute"
TRADE_COMPUTE_QUEUE = "trade.compute"

RABBITMQ_QUEUES = (
    PORTFOLIO_COMPUTE_QUEUE,
    TRADE_COMPUTE_QUEUE,
)
