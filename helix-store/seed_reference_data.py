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


def load_seed_trades() -> list[dict[str, object]]:
    return json.loads(SEED_TRADES_PATH.read_text(encoding="utf-8"))


def main() -> None:
    seed_trades = load_seed_trades()

    instruments: dict[str, dict[str, object]] = {}
    books: set[str] = set()

    for trade in seed_trades:
        asset_class = str(trade["asset_class"])
        instrument_id = str(trade["instrument_id"])
        instruments.setdefault(
            instrument_id,
            {
                "instrument_id": instrument_id,
                "instrument_name": str(trade["instrument_name"]),
                "asset_class": asset_class,
                "currency": "USD",
            },
        )
        books.add(BOOK_BY_ASSET_CLASS.get(asset_class, "Fixed Income"))

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM instrument")
        conn.execute("DELETE FROM book")

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
        conn.commit()


if __name__ == "__main__":
    main()
