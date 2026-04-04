"""Shared utility helpers for helix_core."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal


def round2(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def sign(value: float) -> float:
    if value > 0:
        return 1.0
    if value < 0:
        return -1.0
    return 0.0


def utc_now() -> datetime:
    return datetime.now(UTC)


def position_id_for_instrument(portfolio_id: str, instrument_id: str) -> str:
    return f"{portfolio_id}-POS-{instrument_id}"
