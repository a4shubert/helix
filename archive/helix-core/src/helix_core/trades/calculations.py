"""Pure trade-level calculations."""

from __future__ import annotations

from .trade import Trade


def mark_to_market(quantity: float, price: float) -> float:
    """Return gross market value for an absolute quantity."""
    return quantity * price


def compute_trade_notional(quantity: float, price: float) -> float:
    """Return trade notional for a single execution."""
    return quantity * price


def signed_trade_quantity(trade: Trade) -> float:
    """Return trade quantity with BUY positive and SELL negative."""
    side = trade.side.upper()
    if side == "BUY":
        return trade.quantity
    if side == "SELL":
        return -trade.quantity
    raise ValueError(f"Unsupported trade side: {trade.side}")
