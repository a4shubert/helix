"""Lot-based valuation models such as FIFO and LIFO."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from helix_core.market import MarketInput
from helix_core.trades import Trade
from helix_core.trades.calculations import signed_trade_quantity
from helix_core.utilities import sign

from .base import PositionValuation
from .registry import register_pnl_model


@dataclass
class InventoryLot:
    signed_quantity: float
    unit_cost: float


class LotBasedPnlModel:
    lot_selection: str = "fifo"

    def value(self, trades: list[Trade], market_input: MarketInput) -> PositionValuation:
        lots: deque[InventoryLot] = deque()
        realized_pnl = 0.0

        for trade in trades:
            residual_quantity = signed_trade_quantity(trade)
            trade_sign = sign(residual_quantity)

            while residual_quantity != 0 and lots and sign(lots[0].signed_quantity) != trade_sign:
                open_lot = lots[0] if self.lot_selection == "fifo" else lots[-1]
                open_sign = sign(open_lot.signed_quantity)
                closing_quantity = min(abs(open_lot.signed_quantity), abs(residual_quantity))
                realized_pnl += open_sign * closing_quantity * (trade.price - open_lot.unit_cost)

                open_lot.signed_quantity -= open_sign * closing_quantity
                residual_quantity += open_sign * closing_quantity

                if open_lot.signed_quantity == 0:
                    if self.lot_selection == "fifo":
                        lots.popleft()
                    else:
                        lots.pop()

            if residual_quantity != 0:
                lots.append(InventoryLot(signed_quantity=residual_quantity, unit_cost=trade.price))

        signed_quantity = sum(lot.signed_quantity for lot in lots)
        absolute_quantity = sum(abs(lot.signed_quantity) for lot in lots)
        carrying_price = (
            sum(abs(lot.signed_quantity) * lot.unit_cost for lot in lots) / absolute_quantity
            if absolute_quantity
            else 0.0
        )
        unrealized_pnl = signed_quantity * (market_input.market_price - carrying_price)

        return PositionValuation(
            signed_quantity=signed_quantity,
            carrying_price=carrying_price,
            realized_pnl=realized_pnl,
            unrealized_pnl=unrealized_pnl,
        )


class FifoPnlModel(LotBasedPnlModel):
    """Value inventory by closing the oldest open lots first."""

    name = "fifo"
    lot_selection = "fifo"


class LifoPnlModel(LotBasedPnlModel):
    """Value inventory by closing the newest open lots first."""

    name = "lifo"
    lot_selection = "lifo"


register_pnl_model(FifoPnlModel())
register_pnl_model(LifoPnlModel())
