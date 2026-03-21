"""Domain models for Helix core analytics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True)
class Trade:
    trade_id: str
    portfolio_id: str
    position_id: str
    instrument_id: str
    instrument_name: str
    asset_class: str
    currency: str
    side: str
    quantity: float
    price: float
    contract_multiplier: float
    trade_timestamp: datetime
    settlement_date: date | None
    strategy: str | None
    book: str | None
    desk: str | None
    status: str
    version: int
    parent_trade_id: str | None = None


@dataclass(frozen=True)
class MarketInput:
    instrument_id: str
    market_price: float
    fx_rate: float = 1.0
    risk_weight: float = 0.2
    market_data_timestamp: datetime | None = None


@dataclass(frozen=True)
class PositionSnapshot:
    portfolio_id: str
    position_id: str
    instrument_id: str
    instrument_name: str
    asset_class: str
    currency: str
    quantity: float
    direction: str
    average_cost: float
    contract_multiplier: float
    trade_date: date
    last_update_ts: datetime
    market_price: float
    market_data_ts: datetime | None
    fx_rate: float
    notional: float
    market_value: float
    unrealized_pnl: float
    sector: str | None
    region: str | None
    strategy: str | None
    desk: str | None


@dataclass(frozen=True)
class PortfolioPnlSnapshot:
    portfolio_id: str
    total_pnl: float
    realized_pnl: float
    unrealized_pnl: float
    valuation_ts: datetime


@dataclass(frozen=True)
class PortfolioRiskSnapshot:
    portfolio_id: str
    delta: float
    gamma: float
    var_95: float
    stress_loss: float
    valuation_ts: datetime


@dataclass(frozen=True)
class PortfolioAnalytics:
    portfolio_id: str
    positions: list[PositionSnapshot]
    pnl: PortfolioPnlSnapshot
    risk: PortfolioRiskSnapshot
