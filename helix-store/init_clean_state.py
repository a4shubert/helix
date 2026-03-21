from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("HELIX_DB_PATH", str(ROOT / "helix-store" / "helix.db")))
SCHEMA_PATH = ROOT / "helix-store" / "schema.sql"
MARKET_DATA_SEED_PATH = ROOT / "helix-store" / "market_data_seed.json"
INSTRUMENT_SEED_TRADES_PATH = ROOT / "helix-store" / "instrument_seed_trades.json"

PORTFOLIOS = [
    ("PF-EQ", "Equity"),
    ("PF-FI", "Fixed Income"),
    ("PF-CM", "Commodities"),
]

BOOK_BY_ASSET_CLASS = {
    "Equity": "Equity",
    "Fixed Income": "Fixed Income",
    "Commodity": "Commodities",
}


def load_market_data_rows() -> list[dict[str, object]]:
    return json.loads(MARKET_DATA_SEED_PATH.read_text(encoding="utf-8"))


def load_instrument_seed_trades() -> list[dict[str, object]]:
    return json.loads(INSTRUMENT_SEED_TRADES_PATH.read_text(encoding="utf-8"))


def build_reference_data(
    seed_trades: list[dict[str, object]],
) -> tuple[list[dict[str, object]], list[str]]:
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

    return (
        sorted(instruments.values(), key=lambda value: str(value["instrument_name"])),
        sorted(books),
    )


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    market_data_rows = load_market_data_rows()
    instruments, books = build_reference_data(load_instrument_seed_trades())

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = OFF;")
        for table in [
            "audit",
            "audit_log",
            "risk",
            "risk_snapshot",
            "pnl",
            "pnl_snapshot",
            "position",
            "position_snapshot",
            "trades",
            "book",
            "strategy",
            "instrument",
            "market_data",
            "market_data_snapshot",
            "portfolio",
            "desk",
            "scenario_result",
            "scenario_position",
            "scenario_run",
            "report",
            "alert",
        ]:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.executescript(schema_sql)

        for instrument_id, name in PORTFOLIOS:
            conn.execute(
                """
                INSERT INTO portfolio (portfolio_id, name, status, created_at)
                VALUES (?, ?, 'active', '2026-03-21T09:30:00Z')
                """,
                (instrument_id, name),
            )

        for instrument in instruments:
            conn.execute(
                """
                INSERT INTO instrument (
                  instrument_id, instrument_name, asset_class, currency, active
                )
                VALUES (?, ?, ?, ?, 1)
                """,
                (
                    instrument["instrument_id"],
                    instrument["instrument_name"],
                    instrument["asset_class"],
                    instrument["currency"],
                ),
            )

        for value in books:
            conn.execute("INSERT INTO book (name) VALUES (?)", (value,))

        for row in market_data_rows:
            conn.execute(
                """
                INSERT INTO market_data (instrument_id, price, updated_at)
                VALUES (?, ?, ?)
                """,
                (row["instrument_id"], row["price"], "2026-03-21T08:59:00Z"),
            )

        conn.commit()
        conn.execute("PRAGMA foreign_keys = ON;")


if __name__ == "__main__":
    main()
