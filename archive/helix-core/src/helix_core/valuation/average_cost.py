"""Average-cost inventory valuation model."""

from __future__ import annotations

from helix_core.market import MarketInput
from helix_core.trades import Trade
from helix_core.trades.calculations import signed_trade_quantity
from helix_core.utilities import sign

from .base import PositionValuation
from .registry import register_pnl_model


class AverageCostPnlModel:
    """Value inventory using a moving average-cost basis."""

    name = "average_cost"

    def value(self, trades: list[Trade], market_input: MarketInput) -> PositionValuation:
        if not trades:
            return PositionValuation(
                signed_quantity=0.0,
                carrying_price=0.0,
                realized_pnl=0.0,
                unrealized_pnl=0.0,
            )

        signed_quantity = 0.0
        carrying_price = 0.0
        realized_pnl = 0.0

        for trade in trades:
            trade_signed_quantity = signed_trade_quantity(trade)
            trade_sign = sign(trade_signed_quantity)
            current_sign = sign(signed_quantity)
            trade_abs_quantity = abs(trade_signed_quantity)

            if signed_quantity == 0:
                signed_quantity = trade_signed_quantity
                carrying_price = trade.price
                continue

            if current_sign == trade_sign:
                total_abs_quantity = abs(signed_quantity) + trade_abs_quantity
                carrying_price = (
                    (abs(signed_quantity) * carrying_price) + (trade_abs_quantity * trade.price)
                ) / total_abs_quantity
                signed_quantity += trade_signed_quantity
                continue

            closing_quantity = min(abs(signed_quantity), trade_abs_quantity)
            realized_pnl += current_sign * closing_quantity * (trade.price - carrying_price)

            residual_quantity = trade_abs_quantity - closing_quantity
            if residual_quantity == 0:
                signed_quantity += trade_signed_quantity
                if signed_quantity == 0:
                    carrying_price = 0.0
                continue

            signed_quantity = trade_sign * residual_quantity
            carrying_price = trade.price

        unrealized_pnl = signed_quantity * (market_input.market_price - carrying_price)

        return PositionValuation(
            signed_quantity=signed_quantity,
            carrying_price=carrying_price,
            realized_pnl=realized_pnl,
            unrealized_pnl=unrealized_pnl,
        )


register_pnl_model(AverageCostPnlModel())
