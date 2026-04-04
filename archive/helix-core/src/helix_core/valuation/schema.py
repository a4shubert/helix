"""Valuation snapshot types."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class PortfolioPnlSnapshot:
    portfolio_id: str
    total_pnl: float
    realized_pnl: float
    unrealized_pnl: float
    valuation_ts: datetime
