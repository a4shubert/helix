#!/usr/bin/env python3
"""Book sample trades directly into Helix and queue runtime processing."""

from __future__ import annotations

import argparse
import sqlite3
import time
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from random import Random

from helix_runtime import TradeBookingRequest, book_trade, default_db_path, utc_now


PREFERRED_INSTRUMENTS = {
    "PF-EQ": ["AAPL", "NVDA", "ADBE"],
    "PF-FI": ["US10Y", "US30Y", "GER10Y"],
    "PF-CM": ["XAUUSD", "CL1", "HG1"],
}

BOOK_BY_PORTFOLIO = {
    "PF-EQ": "EQ-789",
    "PF-FI": "FI-175",
    "PF-CM": "CM-987",
}

BUY_SELL_PATTERN = ["BUY", "BUY", "SELL", "BUY", "SELL", "BUY", "SELL", "BUY", "SELL", "BUY"]

QUANTITIES_BY_PORTFOLIO = {
    "PF-EQ": [10, 15, 20, 25, 30, 12, 18, 22, 28, 35],
    "PF-FI": [100, 150, 200, 125, 175, 225, 140, 190, 240, 160],
    "PF-CM": [4, 6, 8, 5, 7, 9, 6, 10, 8, 12],
}

PRICE_MOVE_BPS = [-180, -95, -35, 20, 65, 110, -70, 45, 150, -120]


@dataclass(frozen=True)
class InstrumentSeed:
    instrument_id: str
    instrument_name: str
    market_price: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send sample Helix trades through RabbitMQ-backed direct booking.")
    parser.add_argument(
        "--db-path",
        default=str(default_db_path()),
        help="Path to the Helix SQLite database.",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=10,
        help="Number of trades to book for each portfolio.",
    )
    parser.add_argument(
        "--t",
        type=int,
        default=0,
        help="Delay between trade submissions in milliseconds.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible trade generation.",
    )
    return parser.parse_args()


def load_instruments(db_path: Path, portfolio_id: str) -> list[InstrumentSeed]:
    preferred = PREFERRED_INSTRUMENTS[portfolio_id]
    placeholders = ", ".join("?" for _ in preferred)
    with sqlite3.connect(db_path) as connection:
      connection.row_factory = sqlite3.Row
      rows = connection.execute(
          f"""
          SELECT i.instrument_id, i.instrument_name, m.price
          FROM instrument i
          JOIN market_data m ON m.instrument_id = i.instrument_id
          WHERE i.instrument_id IN ({placeholders})
            AND i.active = 1
          """,
          preferred,
      ).fetchall()

    by_id = {str(row["instrument_id"]): row for row in rows}
    missing = [instrument_id for instrument_id in preferred if instrument_id not in by_id]
    if missing:
        raise RuntimeError(f"Missing seeded instruments for {portfolio_id}: {', '.join(missing)}")

    return [
        InstrumentSeed(
            instrument_id=instrument_id,
            instrument_name=str(by_id[instrument_id]["instrument_name"]),
            market_price=float(by_id[instrument_id]["price"]),
        )
        for instrument_id in preferred
    ]


def build_request(
    *,
    portfolio_id: str,
    index: int,
    instruments: list[InstrumentSeed],
    randomizer: Random,
) -> TradeBookingRequest:
    instrument = instruments[index % len(instruments)]
    quantity_pattern = QUANTITIES_BY_PORTFOLIO[portfolio_id]
    side = BUY_SELL_PATTERN[index % len(BUY_SELL_PATTERN)]
    quantity = float(quantity_pattern[index % len(quantity_pattern)])
    move_bps = PRICE_MOVE_BPS[index % len(PRICE_MOVE_BPS)] + randomizer.randint(-10, 10)
    price = round(instrument.market_price * (1 + move_bps / 10_000), 2)
    settlement_date = (utc_now() + timedelta(days=1)).date().isoformat()

    return TradeBookingRequest(
        portfolio_id=portfolio_id,
        instrument_id=instrument.instrument_id,
        side=side,
        quantity=quantity,
        price=price,
        settlement_date=settlement_date,
        book=BOOK_BY_PORTFOLIO[portfolio_id],
    )


def book_trades(db_path: Path, n: int, delay_ms: int, seed: int) -> None:
    randomizer = Random(seed)
    booked_count = 0

    for portfolio_id in ("PF-CM", "PF-EQ", "PF-FI"):
        instruments = load_instruments(db_path, portfolio_id)
        print(f"[trades] {portfolio_id}: using {[instrument.instrument_id for instrument in instruments]}")

        for index in range(n):
            request = build_request(
                portfolio_id=portfolio_id,
                index=index,
                instruments=instruments,
                randomizer=randomizer,
            )
            booked = book_trade(request, db_path=db_path)
            booked_count += 1
            print(
                f"[trades] booked {booked.trade_id} "
                f"{request.portfolio_id} {request.side} {request.quantity:g} {request.instrument_id} @ {request.price:.2f}"
            )
            if delay_ms > 0:
                time.sleep(delay_ms / 1000)

    print(f"[trades] completed: {booked_count} trades queued")


def main() -> int:
    args = parse_args()
    book_trades(
        db_path=Path(args.db_path).resolve(),
        n=args.n,
        delay_ms=args.t,
        seed=args.seed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
