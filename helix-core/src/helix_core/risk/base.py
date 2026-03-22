"""Shared risk model abstractions."""

from __future__ import annotations

from typing import Protocol

from helix_core.market import MarketInput
from helix_core.positions import PositionSnapshot
from helix_core.risk.schema import PortfolioRiskSnapshot


class RiskModel(Protocol):
    """Contract for portfolio risk models."""

    name: str

    def compute(
        self,
        portfolio_id: str,
        positions: list[PositionSnapshot],
        market_inputs: dict[str, MarketInput],
        *,
        valuation_ts,
    ) -> PortfolioRiskSnapshot:
        """Compute a portfolio risk snapshot."""
