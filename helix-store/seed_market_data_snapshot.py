from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "helix-store" / "helix.db"
SEED_PATH = ROOT / "helix-store" / "market_data_seed.json"


def main() -> None:
    rows = json.loads(SEED_PATH.read_text(encoding="utf-8"))

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM market_data")
        conn.executemany(
            """
            INSERT INTO market_data (instrument_id, price, updated_at)
            VALUES (?, ?, ?)
            """,
            [(row["instrument_id"], row["price"], "2026-03-21T08:59:00Z") for row in rows],
        )
        conn.commit()


if __name__ == "__main__":
    main()
