"""Protocols for runtime persistence and event publication boundaries."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from helix_core import (
    MarketInput,
    PortfolioAnalytics,
    PortfolioPnlSnapshot,
    PortfolioRiskSnapshot,
    PositionSnapshot,
    Trade,
)

from .models import PersistedPortfolioSnapshots


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
    ) -> PersistedPortfolioSnapshots:
        """Persist recomputed positions, P&L, and risk snapshots."""

    def save_positions(
        self,
        portfolio_id: str,
        positions: list[PositionSnapshot],
        *,
        valuation_ts: datetime,
        source_event_id: str,
    ) -> list[str]:
        """Persist only position snapshots."""

    def load_latest_positions(
        self,
        portfolio_id: str,
    ) -> list[PositionSnapshot]:
        """Load the latest persisted position snapshots for a portfolio."""

    def save_pnl(
        self,
        pnl: PortfolioPnlSnapshot,
        *,
        market_data_as_of_ts: datetime,
    ) -> str:
        """Persist only the P&L snapshot."""

    def save_risk(
        self,
        risk: PortfolioRiskSnapshot,
        *,
        market_data_as_of_ts: datetime,
    ) -> str:
        """Persist only the risk snapshot."""

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
