"""Market data domain models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class MarketInput:
    instrument_id: str
    market_price: float
    volatility: float
    market_data_timestamp: datetime | None = None
