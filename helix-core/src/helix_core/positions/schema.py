"""Position snapshot definitions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


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
    last_update_ts: datetime
    market_price: float
    market_data_ts: datetime | None
    notional: float
    market_value: float
    unrealized_pnl: float
    book: str | None
