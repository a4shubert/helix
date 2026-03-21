"""Runtime-facing models for Helix event orchestration."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class TradeCreatedEvent:
    """Domain event emitted when a trade has been accepted by the REST layer."""

    trade_id: str
    portfolio_id: str
    occurred_at: datetime


@dataclass(frozen=True)
class PersistedAnalytics:
    """Identifiers of the snapshots written for a recomputed portfolio."""

    portfolio_id: str
    position_snapshot_ids: list[str]
    pnl_snapshot_id: str
    risk_snapshot_id: str
    valuation_ts: datetime
    market_data_as_of_ts: datetime


@dataclass(frozen=True)
class PortfolioUpdateEvent:
    """Event published after analytics have been refreshed."""

    topic: str
    portfolio_id: str
    snapshot_id: str
    occurred_at: datetime


@dataclass(frozen=True)
class TradeProcessingResult:
    """Result returned by the runtime processor for observability/testing."""

    trade_id: str
    portfolio_id: str
    persisted: PersistedAnalytics
    published_events: list[PortfolioUpdateEvent]


@dataclass(frozen=True)
class TaskProcessingResult:
    """Result returned by the runtime processor for RabbitMQ task handling."""

    task_id: str
    task_type: str
    portfolio_id: str
    persisted: PersistedAnalytics
    published_events: list[PortfolioUpdateEvent]
