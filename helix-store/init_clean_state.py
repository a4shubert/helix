from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("HELIX_DB_PATH", str(ROOT / "helix-store" / "helix.db")))
SCHEMA_PATH = ROOT / "helix-store" / "schema.sql"
MARKET_DATA_SEED_PATH = ROOT / "helix-store" / "market_data_snapshot_seed.json"
TRADES_JSON_PATH = ROOT / "helix-web" / "src" / "lib" / "mock" / "trades.json"

PORTFOLIOS = [
    ("PF-001", "Equity"),
    ("PF-002", "Fixed Income"),
    ("PF-003", "Commodities"),
]

BOOK_BY_ASSET_CLASS = {
    "Equity": "Equity",
    "Rates": "Fixed Income",
    "Credit": "Fixed Income",
    "FX": "Fixed Income",
    "Commodity": "Commodities",
}


def load_market_data_rows() -> list[dict[str, object]]:
    return json.loads(MARKET_DATA_SEED_PATH.read_text(encoding="utf-8"))


def load_mock_trades() -> list[dict[str, object]]:
    return json.loads(TRADES_JSON_PATH.read_text(encoding="utf-8"))


def build_reference_data(
    mock_trades: list[dict[str, object]],
) -> tuple[list[dict[str, object]], list[str], list[str]]:
    instruments: dict[str, dict[str, object]] = {}
    books: set[str] = set()
    desks: set[str] = set()

    for trade in mock_trades:
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

    return (
        sorted(instruments.values(), key=lambda value: str(value["instrument_name"])),
        sorted(books),
        sorted(desks),
    )


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    market_data_rows = load_market_data_rows()
    instruments, books, desks = build_reference_data(load_mock_trades())

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = OFF;")
        for table in [
            "audit_log",
            "alert",
            "report",
            "scenario_result",
            "scenario_position",
            "scenario_run",
            "risk_snapshot",
            "pnl_snapshot",
            "position_snapshot",
            "trades",
            "desk",
            "book",
            "instrument",
            "market_data_snapshot",
            "portfolio",
        ]:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.executescript(schema_sql)

        market_count = conn.execute("SELECT COUNT(*) FROM market_data_snapshot").fetchone()[0]
        if market_count == 0:
            for row in market_data_rows:
                conn.execute(
                    """
                    INSERT INTO market_data_snapshot (
                      snapshot_id, instrument_id, field_name, field_value, as_of_ts, source
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["snapshot_id"],
                        row["instrument_id"],
                        row["field_name"],
                        row["field_value"],
                        row["as_of_ts"],
                        row["source"],
                    ),
                )

        for portfolio_id, name in PORTFOLIOS:
            conn.execute(
                """
                INSERT INTO portfolio (portfolio_id, name, status, created_at)
                VALUES (?, ?, 'active', '2026-03-21T09:30:00Z')
                """,
                (portfolio_id, name),
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
        for value in desks:
            conn.execute("INSERT INTO desk (name) VALUES (?)", (value,))

        conn.commit()
        conn.execute("PRAGMA foreign_keys = ON;")


if __name__ == "__main__":
    main()
