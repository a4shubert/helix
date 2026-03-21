from __future__ import annotations

import json
import os
import re
import sqlite3
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("HELIX_DB_PATH", str(ROOT / "helix-store" / "helix.db")))
MOCK_TS_PATH = ROOT / "helix-web" / "src" / "lib" / "mock" / "portfolio.ts"
DASHBOARD_TSX_PATH = ROOT / "helix-web" / "src" / "components" / "dashboard" / "PortfolioDashboard.tsx"
TRADES_JSON_PATH = ROOT / "helix-web" / "src" / "lib" / "mock" / "trades.json"
MARKET_DATA_SEED_PATH = ROOT / "helix-store" / "market_data_snapshot_seed.json"
BOOK_BY_ASSET_CLASS = {
    "Equity": "Equity",
    "Rates": "Fixed Income",
    "Credit": "Fixed Income",
    "FX": "Fixed Income",
    "Commodity": "Commodities",
}


def load_mock_portfolios() -> dict[str, object]:
    ts_text = MOCK_TS_PATH.read_text(encoding="utf-8")
    match = re.search(
        r"export const mockPortfolioDashboards = (\{.*\}) as const satisfies",
        ts_text,
        re.DOTALL,
    )
    if not match:
        raise RuntimeError("Could not extract mockPortfolioDashboards from helix-web mock file.")

    object_literal = match.group(1)

    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tmp:
        tmp.write("const data = ")
        tmp.write(object_literal)
        tmp.write(";\nprocess.stdout.write(JSON.stringify(data));\n")
        tmp_path = Path(tmp.name)

    try:
        result = subprocess.run(
            ["node", str(tmp_path)],
            check=True,
            capture_output=True,
            text=True,
        )
    finally:
        tmp_path.unlink(missing_ok=True)

    return json.loads(result.stdout)


def load_portfolio_names() -> dict[str, str]:
    text = DASHBOARD_TSX_PATH.read_text(encoding="utf-8")
    matches = re.findall(r'key: "(PF-\d+)",\s+label: "([^"]+)"', text)
    if matches:
        return {key: label for key, label in matches}
    return {
        "PF-001": "Equity",
        "PF-002": "Fixed Income",
        "PF-003": "Commodities",
    }


def metric_lookup(metrics: list[dict[str, object]]) -> dict[str, float]:
    return {str(item["label"]): float(item["value"]) for item in metrics}


def load_mock_trades() -> list[dict[str, object]]:
    return json.loads(TRADES_JSON_PATH.read_text(encoding="utf-8"))


def load_market_data_rows() -> list[dict[str, object]]:
    return json.loads(MARKET_DATA_SEED_PATH.read_text(encoding="utf-8"))


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
    mock_dashboards = load_mock_portfolios()
    portfolio_names = load_portfolio_names()
    mock_trades = load_mock_trades()
    market_data_rows = load_market_data_rows()
    instruments, books, desks = build_reference_data(mock_trades)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")

        for table in [
            "market_data_snapshot",
            "instrument",
            "book",
            "desk",
            "position_snapshot",
            "pnl_snapshot",
            "risk_snapshot",
            "trades",
            "scenario_position",
            "scenario_result",
            "scenario_run",
            "report",
            "alert",
            "audit_log",
            "portfolio",
        ]:
            conn.execute(f"DELETE FROM {table}")

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

        for portfolio_id, dashboard in mock_dashboards.items():
            portfolio_payload = dashboard["portfolio"]
            positions = portfolio_payload["positions"]
            as_of = portfolio_payload["asOf"]

            conn.execute(
                """
                INSERT INTO portfolio (portfolio_id, name, status, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    portfolio_id,
                    portfolio_names.get(portfolio_id, portfolio_id),
                    "active",
                    as_of,
                ),
            )

            pnl_metrics = metric_lookup(dashboard["pnlMetrics"])
            conn.execute(
                """
                INSERT INTO pnl_snapshot (
                  snapshot_id, portfolio_id, total_pnl, realized_pnl, unrealized_pnl,
                  valuation_ts, market_data_as_of_ts, position_as_of_ts
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"PNL-{portfolio_id}-{as_of}",
                    portfolio_id,
                    pnl_metrics["Total P&L"],
                    pnl_metrics["Realized P&L"],
                    pnl_metrics["Unrealized P&L"],
                    as_of,
                    as_of,
                    as_of,
                ),
            )

            risk_metrics = metric_lookup(dashboard["riskMetrics"])
            conn.execute(
                """
                INSERT INTO risk_snapshot (
                  snapshot_id, portfolio_id, delta, gamma, var_95, stress_loss,
                  valuation_ts, market_data_as_of_ts, position_as_of_ts
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"RISK-{portfolio_id}-{as_of}",
                    portfolio_id,
                    risk_metrics["Delta Exposure"],
                    risk_metrics["Gamma"],
                    risk_metrics["VaR (95%)"],
                    risk_metrics["Stress Loss"],
                    as_of,
                    as_of,
                    as_of,
                ),
            )

        for portfolio_id, dashboard in mock_dashboards.items():
            portfolio_payload = dashboard["portfolio"]
            positions = portfolio_payload["positions"]
            as_of = portfolio_payload["asOf"]

            for position in positions:
                conn.execute(
                    """
                    INSERT INTO position_snapshot (
                      snapshot_id, portfolio_id, position_id, instrument_id, instrument_name,
                      asset_class, currency, quantity, direction, average_cost,
                      last_update_ts, market_price, market_data_ts, notional,
                      market_value, book, desk, as_of_ts, source_event_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"POSITION-{position['positionId']}-{as_of}",
                        position["portfolioId"],
                        position["positionId"],
                        position["instrumentId"],
                        position["instrumentName"],
                        position["assetClass"],
                        position["currency"],
                        position["quantity"],
                        position["direction"],
                        position["averageCost"],
                        position["lastUpdateTs"],
                        position["marketPrice"],
                        position["marketDataTs"],
                        position["notional"],
                        position["marketValue"],
                        position["book"],
                        position["desk"],
                        as_of,
                        None,
                    ),
                )

        for trade in mock_trades:
            conn.execute(
                """
                    INSERT INTO trades (
                      trade_id, portfolio_id, position_id, instrument_id, instrument_name,
                      asset_class, currency, side, quantity, price, notional, trade_timestamp,
                      settlement_date, book, desk, status, version,
                      created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                    trade["trade_id"],
                    trade["portfolio_id"],
                    trade["position_id"],
                    trade["instrument_id"],
                    trade["instrument_name"],
                    trade["asset_class"],
                    "USD",
                    trade["side"],
                    trade["quantity"],
                    trade["price"],
                    trade["notional"],
                    trade["trade_timestamp"],
                    trade["settlement_date"],
                    trade["book"],
                    trade["desk"],
                    trade["status"],
                    trade["version"],
                    trade["created_at"],
                    trade["updated_at"],
                ),
            )

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

        conn.commit()


if __name__ == "__main__":
    main()
