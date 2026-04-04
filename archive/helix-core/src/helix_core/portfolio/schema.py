"""Portfolio domain models."""

from __future__ import annotations

from dataclasses import dataclass

from helix_core.positions.schema import PositionSnapshot
from helix_core.risk.schema import PortfolioRiskSnapshot
from helix_core.valuation.schema import PortfolioPnlSnapshot


@dataclass(frozen=True)
class PortfolioAnalytics:
    portfolio_id: str
    positions: list[PositionSnapshot]
    pnl: PortfolioPnlSnapshot
    risk: PortfolioRiskSnapshot
