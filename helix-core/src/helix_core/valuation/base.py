"""Shared valuation model abstractions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from helix_core.market import MarketInput
from helix_core.trades import Trade


@dataclass(frozen=True)
class PositionValuation:
    """Valuation result for one instrument after processing its trades."""

    signed_quantity: float
    carrying_price: float
    realized_pnl: float
    unrealized_pnl: float


class PnlModel(Protocol):
    """Contract for trade-to-position P&L valuation models."""

    name: str

    def value(self, trades: list[Trade], market_input: MarketInput) -> PositionValuation:
        """Value one instrument's ordered trade history against current market."""
