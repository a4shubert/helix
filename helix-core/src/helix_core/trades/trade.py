"""Trade domain models."""

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
    trade_timestamp: datetime
    settlement_date: date | None
    book: str | None
    status: str
    version: int
