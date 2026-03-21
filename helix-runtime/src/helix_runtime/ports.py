"""Protocols for runtime persistence and event publication boundaries."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from helix_core import MarketInput, PortfolioAnalytics, Trade

from .models import PersistedAnalytics


class StoreGateway(Protocol):
    """Persistence boundary used by the runtime service."""

    def get_trade(self, trade_id: str) -> Trade:
        """Load a single trade by identifier."""

    def get_portfolio_trades(
        self,
        portfolio_id: str,
        *,
        statuses: tuple[str, ...] | None = None,
    ) -> list[Trade]:
        """Load all trades participating in the portfolio state rebuild."""

    def get_market_inputs_for_portfolio(self, portfolio_id: str) -> dict[str, MarketInput]:
        """Load the latest market inputs needed for portfolio analytics."""

    def save_portfolio_analytics(
        self,
        analytics: PortfolioAnalytics,
        *,
        market_data_as_of_ts: datetime,
        source_event_id: str,
    ) -> PersistedAnalytics:
        """Persist recomputed positions, P&L, and risk snapshots."""

    def update_trade_status(
        self,
        trade_id: str,
        status: str,
        *,
        updated_at: datetime,
        notional: float | None = None,
    ) -> None:
        """Update the processing lifecycle status of a trade."""


class EventPublisher(Protocol):
    """Publication boundary used after analytics persistence succeeds."""

    def publish(self, topic: str, payload: dict[str, object]) -> None:
        """Publish a domain event payload."""
