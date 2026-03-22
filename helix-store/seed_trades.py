from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "helix-store" / "helix.db"
SEED_TRADES_PATH = ROOT / "helix-store" / "instrument_seed_trades.json"

BOOK_BY_ASSET_CLASS = {
    "Equity": "Equity",
    "Fixed Income": "Fixed Income",
    "Commodity": "Commodities",
}


def main() -> None:
    trades = json.loads(SEED_TRADES_PATH.read_text(encoding="utf-8"))

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("DELETE FROM trades")
        conn.executemany(
            """
            INSERT INTO trades (
              trade_id, portfolio_id, position_id, instrument_id, instrument_name,
              asset_class, currency, side, quantity, price, notional, trade_timestamp,
              settlement_date, book, status, version, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    trade["trade_id"],
                    trade["portfolio_id"],
                    f"{trade['portfolio_id']}-{trade['instrument_id']}",
                    trade["instrument_id"],
                    trade["instrument_name"],
                    trade["asset_class"],
                    "USD",
                    trade["side"],
                    trade["quantity"],
                    trade["price"],
                    trade["notional"],
                    f"{trade['trade_date']}T09:00:00Z",
                    trade["trade_date"],
                    BOOK_BY_ASSET_CLASS.get(str(trade["asset_class"]), "Fixed Income"),
                    trade["status"],
                    trade["version"],
                    f"{trade['trade_date']}T09:00:00Z",
                    f"{trade['trade_date']}T09:00:00Z",
                )
                for trade in trades
            ],
        )
        conn.commit()


if __name__ == "__main__":
    main()
