"""High-level portfolio analytics orchestration."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime

from helix_core.market import MarketInput
from helix_core.positions import PositionSnapshot, rebuild_positions_with_realized_pnl
from helix_core.risk import RiskModel, resolve_risk_model
from helix_core.risk.schema import PortfolioRiskSnapshot
from helix_core.trades import Trade
from helix_core.utilities import round2, utc_now
from helix_core.valuation import PnlModel, PortfolioPnlSnapshot, resolve_pnl_model

from .schema import PortfolioAnalytics


def compute_portfolio_pnl(
    portfolio_id: str,
    positions: list[PositionSnapshot],
    *,
    realized_pnl: float = 0.0,
    valuation_ts: datetime | None = None,
) -> PortfolioPnlSnapshot:
    """Aggregate position-level unrealized P&L into portfolio P&L."""
    valuation_time = valuation_ts or utc_now()
    unrealized_pnl = round2(sum(position.unrealized_pnl for position in positions))
    realized_pnl = round2(realized_pnl)
    total_pnl = round2(realized_pnl + unrealized_pnl)
    return PortfolioPnlSnapshot(
        portfolio_id=portfolio_id,
        total_pnl=total_pnl,
        realized_pnl=realized_pnl,
        unrealized_pnl=unrealized_pnl,
        valuation_ts=valuation_time,
    )


def compute_portfolio_risk(
    portfolio_id: str,
    positions: list[PositionSnapshot],
    market_inputs: dict[str, MarketInput],
    *,
    valuation_ts: datetime | None = None,
    risk_model: RiskModel,
) -> PortfolioRiskSnapshot:
    """Compute portfolio risk using the selected risk model."""
    valuation_time = valuation_ts or utc_now()
    return risk_model.compute(
        portfolio_id,
        positions,
        market_inputs,
        valuation_ts=valuation_time,
    )


def compute_portfolio_analytics(
    portfolio_id: str,
    trades: list[Trade],
    market_inputs: dict[str, MarketInput],
    *,
    realized_pnl: float = 0.0,
    valuation_ts: datetime | None = None,
    pnl_model: str | PnlModel | None = None,
    risk_model: str | RiskModel | None = None,
) -> PortfolioAnalytics:
    """Rebuild positions and compute portfolio P&L and risk from trades plus market inputs."""
    valuation_time = valuation_ts or utc_now()
    resolved_pnl_model = resolve_pnl_model(pnl_model)
    resolved_risk_model = resolve_risk_model(risk_model)
    positions, computed_realized_pnl = rebuild_positions_with_realized_pnl(
        trades,
        market_inputs,
        pnl_model=resolved_pnl_model,
    )
    positions = [replace(position, book=position.book or "UNSPECIFIED") for position in positions]
    pnl = compute_portfolio_pnl(
        portfolio_id,
        positions,
        realized_pnl=realized_pnl + computed_realized_pnl,
        valuation_ts=valuation_time,
    )
    risk = compute_portfolio_risk(
        portfolio_id,
        positions,
        market_inputs,
        valuation_ts=valuation_time,
        risk_model=resolved_risk_model,
    )
    return PortfolioAnalytics(
        portfolio_id=portfolio_id,
        positions=positions,
        pnl=pnl,
        risk=risk,
    )
