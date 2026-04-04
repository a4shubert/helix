"""Shared broker topic and queue names for Helix."""

from __future__ import annotations

TRADE_DELETED_TOPIC = "trade.deleted"
TRADE_UPDATED_TOPIC = "trade.updated"
POSITION_UPDATED_TOPIC = "position.updated"
POSITION_PL_UPDATED_TOPIC = "position.pl.updated"
PORTFOLIO_PL_UPDATED_TOPIC = "portfolio.pl.updated"
PORTFOLIO_RISK_UPDATED_TOPIC = "portfolio.risk.updated"

TRADE_COMPUTE_QUEUE = "trade.compute"
POSITION_PL_COMPUTE_QUEUE = "position.pl.compute"
PORTFOLIO_PL_COMPUTE_QUEUE = "portfolio.pl.compute"
PORTFOLIO_RISK_COMPUTE_QUEUE = "portfolio.risk.compute"

RABBITMQ_QUEUES = (
    TRADE_COMPUTE_QUEUE,
    POSITION_PL_COMPUTE_QUEUE,
    PORTFOLIO_PL_COMPUTE_QUEUE,
    PORTFOLIO_RISK_COMPUTE_QUEUE,
)
