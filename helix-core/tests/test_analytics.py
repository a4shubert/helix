from __future__ import annotations

import unittest
from datetime import UTC, date, datetime

from helix_core import MarketInput, Trade, compute_portfolio_analytics


def make_trade(
    *,
    trade_id: str,
    side: str,
    quantity: float,
    price: float,
    trade_timestamp: str,
) -> Trade:
    return Trade(
        trade_id=trade_id,
        portfolio_id="PF-TEST",
        position_id="PF-TEST-POS-001",
        instrument_id="AAPL",
        instrument_name="Apple Inc",
        asset_class="Equity",
        currency="USD",
        side=side,
        quantity=quantity,
        price=price,
        trade_timestamp=datetime.fromisoformat(trade_timestamp.replace("Z", "+00:00")),
        settlement_date=date(2026, 3, 24),
        book="Equity",
        status="processed",
        version=1,
    )


class AnalyticsRealizedPnlTests(unittest.TestCase):
    def test_long_position_realizes_pnl_on_partial_sell(self) -> None:
        trades = [
            make_trade(
                trade_id="TRD-1",
                side="BUY",
                quantity=100.0,
                price=10.0,
                trade_timestamp="2026-03-21T09:00:00Z",
            ),
            make_trade(
                trade_id="TRD-2",
                side="SELL",
                quantity=40.0,
                price=12.0,
                trade_timestamp="2026-03-21T09:05:00Z",
            ),
        ]
        market_inputs = {
            "AAPL": MarketInput(
                instrument_id="AAPL",
                market_price=11.0,
                risk_weight=0.25,
                market_data_timestamp=datetime(2026, 3, 21, 8, 59, tzinfo=UTC),
            )
        }

        analytics = compute_portfolio_analytics("PF-TEST", trades, market_inputs)

        self.assertEqual(len(analytics.positions), 1)
        position = analytics.positions[0]
        self.assertEqual(position.quantity, 60.0)
        self.assertEqual(position.direction, "LONG")
        self.assertEqual(position.average_cost, 10.0)
        self.assertEqual(position.unrealized_pnl, 60.0)
        self.assertEqual(analytics.pnl.realized_pnl, 80.0)
        self.assertEqual(analytics.pnl.total_pnl, 140.0)

    def test_short_position_realizes_pnl_on_partial_buyback(self) -> None:
        trades = [
            make_trade(
                trade_id="TRD-1",
                side="SELL",
                quantity=100.0,
                price=10.0,
                trade_timestamp="2026-03-21T09:00:00Z",
            ),
            make_trade(
                trade_id="TRD-2",
                side="BUY",
                quantity=40.0,
                price=8.0,
                trade_timestamp="2026-03-21T09:05:00Z",
            ),
        ]
        market_inputs = {
            "AAPL": MarketInput(
                instrument_id="AAPL",
                market_price=9.0,
                risk_weight=0.25,
                market_data_timestamp=datetime(2026, 3, 21, 8, 59, tzinfo=UTC),
            )
        }

        analytics = compute_portfolio_analytics("PF-TEST", trades, market_inputs)

        self.assertEqual(len(analytics.positions), 1)
        position = analytics.positions[0]
        self.assertEqual(position.quantity, 60.0)
        self.assertEqual(position.direction, "SHORT")
        self.assertEqual(position.average_cost, 10.0)
        self.assertEqual(position.unrealized_pnl, 60.0)
        self.assertEqual(analytics.pnl.realized_pnl, 80.0)
        self.assertEqual(analytics.pnl.total_pnl, 140.0)


if __name__ == "__main__":
    unittest.main()
