"""Portfolio reconstruction and analytics primitives for Helix."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import replace
from datetime import UTC, datetime
from math import sqrt

from .models import (
    MarketInput,
    PortfolioAnalytics,
    PortfolioPnlSnapshot,
    PortfolioRiskSnapshot,
    PositionSnapshot,
    Trade,
)


def mark_to_market(quantity: float, price: float) -> float:
    """Return gross market value for an absolute quantity."""
    return quantity * price


def signed_trade_quantity(trade: Trade) -> float:
    """Return trade quantity with BUY positive and SELL negative."""
    side = trade.side.upper()
    if side == "BUY":
        return trade.quantity
    if side == "SELL":
        return -trade.quantity
    raise ValueError(f"Unsupported trade side: {trade.side}")


def _sign(value: float) -> float:
    if value > 0:
        return 1.0
    if value < 0:
        return -1.0
    return 0.0


def summarize_position_trades(trades: list[Trade]) -> tuple[float, float, float]:
    """Return final signed quantity, average cost, and realized P&L.

    The inventory model is average-cost based:
    - same-direction trades increase inventory and re-average cost
    - opposite-direction trades realize P&L on the closed quantity
    - if the trade flips the position, the residual opens at the trade price
    """
    if not trades:
        return 0.0, 0.0, 0.0

    signed_quantity = 0.0
    average_cost = 0.0
    realized_pnl = 0.0

    for trade in trades:
        trade_signed_quantity = signed_trade_quantity(trade)
        trade_sign = _sign(trade_signed_quantity)
        current_sign = _sign(signed_quantity)
        trade_abs_quantity = abs(trade_signed_quantity)

        if signed_quantity == 0:
            signed_quantity = trade_signed_quantity
            average_cost = trade.price
            continue

        if current_sign == trade_sign:
            total_abs_quantity = abs(signed_quantity) + trade_abs_quantity
            average_cost = (
                (abs(signed_quantity) * average_cost) + (trade_abs_quantity * trade.price)
            ) / total_abs_quantity
            signed_quantity += trade_signed_quantity
            continue

        closing_quantity = min(abs(signed_quantity), trade_abs_quantity)
        realized_pnl += (
            current_sign
            * closing_quantity
            * (trade.price - average_cost)
        )

        residual_quantity = trade_abs_quantity - closing_quantity
        if residual_quantity == 0:
            signed_quantity += trade_signed_quantity
            if signed_quantity == 0:
                average_cost = 0.0
            continue

        signed_quantity = trade_sign * residual_quantity
        average_cost = trade.price

    return signed_quantity, average_cost, realized_pnl


def rebuild_positions(
    trades: list[Trade],
    market_inputs: dict[str, MarketInput],
) -> list[PositionSnapshot]:
    """Aggregate trades into current live positions and mark them with market inputs."""
    grouped: dict[tuple[str, str], list[Trade]] = defaultdict(list)
    for trade in trades:
        grouped[(trade.portfolio_id, trade.position_id)].append(trade)

    positions: list[PositionSnapshot] = []

    for (_, _), position_trades in sorted(grouped.items()):
        ordered = sorted(position_trades, key=lambda trade: trade.trade_timestamp)
        first = ordered[0]
        last = ordered[-1]
        market = market_inputs.get(first.instrument_id)
        if market is None:
            raise KeyError(f"Missing market input for instrument '{first.instrument_id}'.")

        total_signed_quantity, average_cost, _ = summarize_position_trades(ordered)
        absolute_quantity = abs(total_signed_quantity)
        if absolute_quantity == 0:
            continue

        direction = "LONG" if total_signed_quantity >= 0 else "SHORT"
        notional = mark_to_market(absolute_quantity, average_cost)
        market_value = mark_to_market(absolute_quantity, market.market_price)
        unrealized_pnl = (
            total_signed_quantity
            * (market.market_price - average_cost)
        )

        positions.append(
            PositionSnapshot(
                portfolio_id=first.portfolio_id,
                position_id=first.position_id,
                instrument_id=first.instrument_id,
                instrument_name=first.instrument_name,
                asset_class=first.asset_class,
                currency=first.currency,
                quantity=absolute_quantity,
                direction=direction,
                average_cost=average_cost,
                last_update_ts=last.trade_timestamp,
                market_price=market.market_price,
                market_data_ts=market.market_data_timestamp,
                notional=notional,
                market_value=market_value,
                unrealized_pnl=unrealized_pnl,
                book=first.book,
            )
        )

    return positions


def compute_portfolio_pnl(
    portfolio_id: str,
    positions: list[PositionSnapshot],
    *,
    realized_pnl: float = 0.0,
    valuation_ts: datetime | None = None,
) -> PortfolioPnlSnapshot:
    """Aggregate position-level unrealized P&L into portfolio P&L."""
    valuation_time = valuation_ts or datetime.now(UTC)
    unrealized_pnl = sum(position.unrealized_pnl for position in positions)
    total_pnl = realized_pnl + unrealized_pnl
    return PortfolioPnlSnapshot(
        portfolio_id=portfolio_id,
        total_pnl=total_pnl,
        realized_pnl=realized_pnl,
        unrealized_pnl=unrealized_pnl,
        valuation_ts=valuation_time,
    )


def compute_portfolio_risk(
    portfolio_id: str,
    positions: list[PositionSnapshot],
    market_inputs: dict[str, MarketInput],
    *,
    valuation_ts: datetime | None = None,
) -> PortfolioRiskSnapshot:
    """Compute simple deterministic portfolio risk aggregates.

    This is intentionally lightweight but internally consistent:
    - delta is signed gross exposure in base currency
    - gamma is a scaled signed convexity proxy
    - var_95 uses a one-day normal approximation from risk_weight
    """
    valuation_time = valuation_ts or datetime.now(UTC)

    delta = 0.0
    gamma = 0.0
    variance = 0.0

    for position in positions:
        market = market_inputs[position.instrument_id]
        signed_quantity_value = position.quantity if position.direction == "LONG" else -position.quantity
        signed_exposure = (
            signed_quantity_value
            * position.market_price
        )
        gross_market_value = position.market_value

        delta += signed_exposure
        gamma += signed_quantity_value * 0.1
        variance += (gross_market_value * market.risk_weight) ** 2

    var_95 = 1.65 * sqrt(variance)

    return PortfolioRiskSnapshot(
        portfolio_id=portfolio_id,
        delta=delta,
        gamma=gamma,
        var_95=var_95,
        valuation_ts=valuation_time,
    )


def compute_portfolio_analytics(
    portfolio_id: str,
    trades: list[Trade],
    market_inputs: dict[str, MarketInput],
    *,
    realized_pnl: float = 0.0,
    valuation_ts: datetime | None = None,
) -> PortfolioAnalytics:
    """Rebuild positions and compute portfolio P&L and risk from trades plus market inputs."""
    valuation_time = valuation_ts or datetime.now(UTC)
    grouped: dict[tuple[str, str], list[Trade]] = defaultdict(list)
    for trade in trades:
        grouped[(trade.portfolio_id, trade.position_id)].append(trade)

    computed_realized_pnl = 0.0
    for position_trades in grouped.values():
        ordered = sorted(position_trades, key=lambda trade: trade.trade_timestamp)
        _, _, position_realized_pnl = summarize_position_trades(ordered)
        computed_realized_pnl += position_realized_pnl

    positions = rebuild_positions(trades, market_inputs)
    positions = [replace(position, book=position.book or "UNSPECIFIED") for position in positions]
    pnl = compute_portfolio_pnl(
        portfolio_id,
        positions,
        realized_pnl=realized_pnl + computed_realized_pnl,
        valuation_ts=valuation_time,
    )
    risk = compute_portfolio_risk(
        portfolio_id,
        positions,
        market_inputs,
        valuation_ts=valuation_time,
    )
    return PortfolioAnalytics(
        portfolio_id=portfolio_id,
        positions=positions,
        pnl=pnl,
        risk=risk,
    )
