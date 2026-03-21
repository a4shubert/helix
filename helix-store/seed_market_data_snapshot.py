from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "helix-store" / "helix.db"
SEED_PATH = ROOT / "helix-store" / "market_data_snapshot_seed.json"


def main() -> None:
    rows = json.loads(SEED_PATH.read_text(encoding="utf-8"))

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = OFF;")
        conn.executescript(
            """
            BEGIN;
            DROP TABLE IF EXISTS market_data_snapshot;
            CREATE TABLE market_data_snapshot (
              snapshot_id TEXT NOT NULL,
              instrument_id TEXT NOT NULL,
              field_name TEXT NOT NULL,
              field_value REAL NOT NULL,
              as_of_ts DATETIME NOT NULL,
              source TEXT NOT NULL,
              PRIMARY KEY (snapshot_id, instrument_id, field_name)
            );
            COMMIT;
            """
        )

        conn.executemany(
            """
            INSERT INTO market_data_snapshot (
              snapshot_id, instrument_id, field_name, field_value, as_of_ts, source
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row["snapshot_id"],
                    row["instrument_id"],
                    row["field_name"],
                    row["field_value"],
                    row["as_of_ts"],
                    row["source"],
                )
                for row in rows
            ],
        )
        conn.commit()


if __name__ == "__main__":
    main()
