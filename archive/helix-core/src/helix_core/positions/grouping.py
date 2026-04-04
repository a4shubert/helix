"""Portfolio trade grouping helpers."""

from __future__ import annotations

from collections import defaultdict

from helix_core.trades import Trade


def group_trades_by_instrument(trades: list[Trade]) -> dict[tuple[str, str], list[Trade]]:
    grouped: dict[tuple[str, str], list[Trade]] = defaultdict(list)
    for trade in trades:
        grouped[(trade.portfolio_id, trade.instrument_id)].append(trade)
    return grouped
