from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "helix-store" / "helix.db"
MOCK_TS_PATH = ROOT / "helix-web" / "src" / "lib" / "mock" / "portfolio.ts"
DASHBOARD_TSX_PATH = ROOT / "helix-web" / "src" / "components" / "dashboard" / "PortfolioDashboard.tsx"


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
    if not matches:
        raise RuntimeError("Could not extract portfolio names from PortfolioDashboard.tsx.")
    return {key: label for key, label in matches}


def metric_lookup(metrics: list[dict[str, object]]) -> dict[str, float]:
    return {str(item["label"]): float(item["value"]) for item in metrics}


def main() -> None:
    mock_dashboards = load_mock_portfolios()
    portfolio_names = load_portfolio_names()

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")

        for table in [
            "market_data_snapshot",
            "position_snapshot",
            "pnl_snapshot",
            "risk_snapshot",
            "trade",
            "scenario_position",
            "scenario_result",
            "scenario_run",
            "report",
            "alert",
            "audit_log",
            "portfolio",
        ]:
            conn.execute(f"DELETE FROM {table}")

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

            for position in positions:
                conn.execute(
                    """
                    INSERT INTO position_snapshot (
                      snapshot_id, portfolio_id, position_id, instrument_id, instrument_name,
                      asset_class, currency, quantity, direction, average_cost, trade_date,
                      last_update_ts, market_price, market_data_ts, fx_rate, notional,
                      sector, region, strategy, desk, as_of_ts, source_event_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        position["tradeDate"],
                        position["lastUpdateTs"],
                        position["marketPrice"],
                        position["marketDataTs"],
                        position["fxRate"],
                        position["notional"],
                        position["sector"],
                        position["region"],
                        position["strategy"],
                        position["desk"],
                        as_of,
                        None,
                    ),
                )

                conn.execute(
                    """
                    INSERT INTO market_data_snapshot (
                      snapshot_id, instrument_id, field_name, field_value, as_of_ts, source
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"MD-{position['positionId']}-MARKET_PRICE",
                        position["instrumentId"],
                        "market_price",
                        position["marketPrice"],
                        position["marketDataTs"],
                        "helix-web-mock",
                    ),
                )

                conn.execute(
                    """
                    INSERT INTO market_data_snapshot (
                      snapshot_id, instrument_id, field_name, field_value, as_of_ts, source
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"MD-{position['positionId']}-FX_RATE",
                        position["instrumentId"],
                        "fx_rate",
                        position["fxRate"],
                        position["marketDataTs"],
                        "helix-web-mock",
                    ),
                )

        conn.commit()


if __name__ == "__main__":
    main()
