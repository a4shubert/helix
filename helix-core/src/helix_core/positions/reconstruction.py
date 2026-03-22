"""Position reconstruction from grouped trades."""

from __future__ import annotations

from helix_core.market import MarketInput
from helix_core.trades import Trade
from helix_core.trades.calculations import mark_to_market
from helix_core.utilities import position_id_for_instrument
from helix_core.valuation import PnlModel

from .grouping import group_trades_by_instrument
from .schema import PositionSnapshot


def rebuild_positions_with_realized_pnl(
    trades: list[Trade],
    market_inputs: dict[str, MarketInput],
    *,
    pnl_model: PnlModel,
) -> tuple[list[PositionSnapshot], float]:
    """Aggregate trades into live positions using the supplied P&L model."""
    grouped = group_trades_by_instrument(trades)

    positions: list[PositionSnapshot] = []
    total_realized_pnl = 0.0

    for (_, _), position_trades in sorted(grouped.items()):
        ordered = sorted(position_trades, key=lambda trade: trade.trade_timestamp)
        first = ordered[0]
        last = ordered[-1]
        market = market_inputs.get(first.instrument_id)
        if market is None:
            raise KeyError(f"Missing market input for instrument '{first.instrument_id}'.")

        valuation = pnl_model.value(ordered, market)
        total_realized_pnl += valuation.realized_pnl
        absolute_quantity = abs(valuation.signed_quantity)
        if absolute_quantity == 0:
            continue

        direction = "LONG" if valuation.signed_quantity >= 0 else "SHORT"
        latest_book = next((trade.book for trade in reversed(ordered) if trade.book), None)

        positions.append(
            PositionSnapshot(
                portfolio_id=first.portfolio_id,
                position_id=position_id_for_instrument(first.portfolio_id, first.instrument_id),
                instrument_id=first.instrument_id,
                instrument_name=last.instrument_name,
                asset_class=last.asset_class,
                currency=last.currency,
                quantity=absolute_quantity,
                direction=direction,
                average_cost=valuation.carrying_price,
                last_update_ts=last.trade_timestamp,
                market_price=market.market_price,
                market_data_ts=market.market_data_timestamp,
                notional=mark_to_market(absolute_quantity, valuation.carrying_price),
                market_value=mark_to_market(absolute_quantity, market.market_price),
                unrealized_pnl=valuation.unrealized_pnl,
                book=latest_book,
            )
        )

    return positions, total_realized_pnl


def rebuild_positions(
    trades: list[Trade],
    market_inputs: dict[str, MarketInput],
    *,
    pnl_model: PnlModel,
) -> list[PositionSnapshot]:
    """Return position snapshots using the supplied P&L model."""
    positions, _ = rebuild_positions_with_realized_pnl(
        trades,
        market_inputs,
        pnl_model=pnl_model,
    )
    return positions
