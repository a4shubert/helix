from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "helix-store" / "helix.db"
TRADES_JSON_PATH = ROOT / "helix-web" / "src" / "lib" / "mock" / "trades.json"


def main() -> None:
    trades = json.loads(TRADES_JSON_PATH.read_text(encoding="utf-8"))

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")

        existing_tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }

        if "trade" in existing_tables and "trades" not in existing_tables:
            conn.execute("ALTER TABLE trade RENAME TO trades")

        conn.execute("DELETE FROM trades")
        conn.executemany(
            """
            INSERT INTO trades (
              trade_id, portfolio_id, position_id, instrument_id, instrument_name,
              asset_class, currency, side, quantity, price, contract_multiplier, notional, trade_timestamp,
              settlement_date, strategy, book, desk, status, version,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    trade["trade_id"],
                    trade["portfolio_id"],
                    trade["position_id"],
                    trade["instrument_id"],
                    trade["instrument_name"],
                    trade["asset_class"],
                    trade["currency"],
                    trade["side"],
                    trade["quantity"],
                    trade["price"],
                    trade["contract_multiplier"],
                    trade["notional"],
                    trade["trade_timestamp"],
                    trade["settlement_date"],
                    trade["strategy"],
                    trade["book"],
                    trade["desk"],
                    trade["status"],
                    trade["version"],
                    trade["created_at"],
                    trade["updated_at"],
                )
                for trade in trades
            ],
        )
        conn.commit()


if __name__ == "__main__":
    main()
