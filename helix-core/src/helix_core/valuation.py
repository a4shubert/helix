"""Minimal valuation primitives for helix-core."""


def mark_to_market(quantity: float, price: float) -> float:
    """Return the current market value of a position."""
    return quantity * price
