"""Risk domain models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class PortfolioRiskSnapshot:
    portfolio_id: str
    delta: float
    gross_exposure: float
    net_exposure: float
    var_95: float
    valuation_ts: datetime
