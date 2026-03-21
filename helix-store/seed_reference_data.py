from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "helix-store" / "helix.db"
TRADES_JSON_PATH = ROOT / "helix-web" / "src" / "lib" / "mock" / "trades.json"
BOOK_BY_ASSET_CLASS = {
    "Equity": "Equity",
    "Rates": "Fixed Income",
    "Credit": "Fixed Income",
    "FX": "Fixed Income",
    "Commodity": "Commodities",
}


def load_trades() -> list[dict[str, object]]:
    return json.loads(TRADES_JSON_PATH.read_text(encoding="utf-8"))


def main() -> None:
    trades = load_trades()

    instruments: dict[str, dict[str, object]] = {}
    books: set[str] = set()
    desks: set[str] = set()

    for trade in trades:
        instrument_id = str(trade["instrument_id"])
        instruments.setdefault(
            instrument_id,
            {
                "instrument_id": instrument_id,
                "instrument_name": str(trade["instrument_name"]),
                "asset_class": str(trade["asset_class"]),
                "currency": "USD",
            },
        )
        books.add(BOOK_BY_ASSET_CLASS.get(str(trade["asset_class"]), "Fixed Income"))
        desks.add(str(trade["desk"]))

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS instrument (
              instrument_id TEXT PRIMARY KEY,
              instrument_name TEXT NOT NULL,
              asset_class TEXT NOT NULL,
              currency TEXT NOT NULL,
              active INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        conn.execute("CREATE TABLE IF NOT EXISTS book (name TEXT PRIMARY KEY)")
        conn.execute("CREATE TABLE IF NOT EXISTS desk (name TEXT PRIMARY KEY)")

        for table in ["instrument", "book", "desk"]:
            conn.execute(f"DELETE FROM {table}")

        conn.executemany(
            """
            INSERT INTO instrument (
              instrument_id, instrument_name, asset_class, currency, active
            ) VALUES (?, ?, ?, ?, 1)
            """,
            [
                (
                    instrument["instrument_id"],
                    instrument["instrument_name"],
                    instrument["asset_class"],
                    instrument["currency"],
                )
                for instrument in sorted(instruments.values(), key=lambda value: str(value["instrument_name"]))
            ],
        )
        conn.executemany(
            "INSERT INTO book (name) VALUES (?)",
            [(value,) for value in sorted(books)],
        )
        conn.executemany(
            "INSERT INTO desk (name) VALUES (?)",
            [(value,) for value in sorted(desks)],
        )
        conn.commit()


if __name__ == "__main__":
    main()
