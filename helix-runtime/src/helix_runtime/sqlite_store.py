"""SQLite-backed runtime store adapter."""

from __future__ import annotations

import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import UTC, date, datetime
from pathlib import Path

from helix_core import MarketInput, PortfolioAnalytics, Trade

from .models import PersistedAnalytics


DEFAULT_RISK_WEIGHT_BY_ASSET_CLASS = {
    "Rates": 0.08,
    "FX": 0.12,
    "Equity": 0.25,
    "Commodity": 0.30,
    "Credit": 0.18,
}


def _parse_datetime(raw: str | None) -> datetime | None:
    if raw is None:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _parse_date(raw: str | None) -> date | None:
    if raw is None:
        return None
    return date.fromisoformat(raw)


def _isoformat_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _snapshot_suffix(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


class SqliteHelixStore:
    """Read/write portfolio state from the Helix SQLite store."""

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = Path(db_path)

    @contextmanager
    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON;")
        try:
            yield connection
        finally:
            connection.close()

    def get_trade(self, trade_id: str) -> Trade:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM trades WHERE trade_id = ?",
                (trade_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Trade '{trade_id}' was not found.")
        return self._row_to_trade(row)

    def get_portfolio_trades(
        self,
        portfolio_id: str,
        *,
        statuses: tuple[str, ...] | None = None,
    ) -> list[Trade]:
        where = ["portfolio_id = ?"]
        params: list[object] = [portfolio_id]
        if statuses:
            placeholders = ", ".join("?" for _ in statuses)
            where.append(f"status IN ({placeholders})")
            params.extend(statuses)

        query = (
            "SELECT * FROM trades "
            f"WHERE {' AND '.join(where)} "
            "ORDER BY trade_timestamp, created_at, trade_id"
        )
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        return [self._row_to_trade(row) for row in rows]

    def get_market_inputs_for_portfolio(self, portfolio_id: str) -> dict[str, MarketInput]:
        trades = self.get_portfolio_trades(portfolio_id, statuses=("accepted", "processed"))
        instruments = {trade.instrument_id: trade for trade in trades}
        if not instruments:
            return {}

        instrument_ids = sorted(instruments)
        placeholders = ", ".join("?" for _ in instrument_ids)
        with self._connect() as connection:
            market_rows = connection.execute(
                f"""
                SELECT instrument_id, field_name, field_value, as_of_ts
                FROM market_data_snapshot
                WHERE instrument_id IN ({placeholders})
                ORDER BY as_of_ts DESC
                """,
                instrument_ids,
            ).fetchall()
            position_rows = connection.execute(
                f"""
                SELECT instrument_id, market_price, fx_rate, market_data_ts, as_of_ts
                FROM position_snapshot
                WHERE portfolio_id = ?
                  AND instrument_id IN ({placeholders})
                ORDER BY as_of_ts DESC, last_update_ts DESC
                """,
                [portfolio_id, *instrument_ids],
            ).fetchall()

        latest_fields: dict[str, dict[str, float]] = defaultdict(dict)
        latest_market_ts: dict[str, datetime] = {}
        for row in market_rows:
            instrument_id = str(row["instrument_id"])
            field_name = str(row["field_name"])
            if field_name not in latest_fields[instrument_id]:
                latest_fields[instrument_id][field_name] = float(row["field_value"])
            latest_market_ts.setdefault(instrument_id, _parse_datetime(row["as_of_ts"]))

        latest_position_price: dict[str, float] = {}
        latest_fx_rate: dict[str, float] = {}
        latest_position_ts: dict[str, datetime | None] = {}
        for row in position_rows:
            instrument_id = str(row["instrument_id"])
            if instrument_id not in latest_position_price and row["market_price"] is not None:
                latest_position_price[instrument_id] = float(row["market_price"])
            if instrument_id not in latest_fx_rate and row["fx_rate"] is not None:
                latest_fx_rate[instrument_id] = float(row["fx_rate"])
            latest_position_ts.setdefault(
                instrument_id,
                _parse_datetime(row["market_data_ts"] or row["as_of_ts"]),
            )

        market_inputs: dict[str, MarketInput] = {}
        for instrument_id, trade in instruments.items():
            fields = latest_fields.get(instrument_id, {})
            market_price = fields.get("price", latest_position_price.get(instrument_id))
            if market_price is None:
                raise KeyError(f"Missing market price for instrument '{instrument_id}'.")

            risk_weight = fields.get(
                "vol_1m",
                DEFAULT_RISK_WEIGHT_BY_ASSET_CLASS.get(trade.asset_class, 0.20),
            )
            market_inputs[instrument_id] = MarketInput(
                instrument_id=instrument_id,
                market_price=market_price,
                fx_rate=latest_fx_rate.get(instrument_id, 1.0),
                risk_weight=risk_weight,
                market_data_timestamp=latest_market_ts.get(instrument_id) or latest_position_ts.get(instrument_id),
            )

        return market_inputs

    def save_portfolio_analytics(
        self,
        analytics: PortfolioAnalytics,
        *,
        market_data_as_of_ts: datetime,
        source_event_id: str,
    ) -> PersistedAnalytics:
        valuation_ts = analytics.pnl.valuation_ts
        suffix = _snapshot_suffix(valuation_ts)
        position_snapshot_ids: list[str] = []

        with self._connect() as connection:
            for position in analytics.positions:
                snapshot_id = f"POSITION-{position.position_id}-{suffix}"
                position_snapshot_ids.append(snapshot_id)
                connection.execute(
                    """
                    INSERT OR REPLACE INTO position_snapshot (
                      snapshot_id, portfolio_id, position_id, instrument_id, instrument_name,
                      asset_class, currency, quantity, direction, average_cost, contract_multiplier,
                      trade_date, last_update_ts, market_price, market_data_ts, fx_rate, notional,
                      market_value, sector, region, strategy, desk, as_of_ts, source_event_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        snapshot_id,
                        position.portfolio_id,
                        position.position_id,
                        position.instrument_id,
                        position.instrument_name,
                        position.asset_class,
                        position.currency,
                        position.quantity,
                        position.direction,
                        position.average_cost,
                        position.contract_multiplier,
                        position.trade_date.isoformat(),
                        _isoformat_utc(position.last_update_ts),
                        position.market_price,
                        _isoformat_utc(position.market_data_ts) if position.market_data_ts else None,
                        position.fx_rate,
                        position.notional,
                        position.market_value,
                        position.sector,
                        position.region,
                        position.strategy,
                        position.desk,
                        _isoformat_utc(valuation_ts),
                        source_event_id,
                    ),
                )

            pnl_snapshot_id = f"PNL-{analytics.portfolio_id}-{suffix}"
            connection.execute(
                """
                INSERT OR REPLACE INTO pnl_snapshot (
                  snapshot_id, portfolio_id, total_pnl, realized_pnl, unrealized_pnl,
                  valuation_ts, market_data_as_of_ts, position_as_of_ts
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pnl_snapshot_id,
                    analytics.pnl.portfolio_id,
                    analytics.pnl.total_pnl,
                    analytics.pnl.realized_pnl,
                    analytics.pnl.unrealized_pnl,
                    _isoformat_utc(analytics.pnl.valuation_ts),
                    _isoformat_utc(market_data_as_of_ts),
                    _isoformat_utc(valuation_ts),
                ),
            )

            risk_snapshot_id = f"RISK-{analytics.portfolio_id}-{suffix}"
            connection.execute(
                """
                INSERT OR REPLACE INTO risk_snapshot (
                  snapshot_id, portfolio_id, delta, gamma, var_95, stress_loss,
                  valuation_ts, market_data_as_of_ts, position_as_of_ts
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    risk_snapshot_id,
                    analytics.risk.portfolio_id,
                    analytics.risk.delta,
                    analytics.risk.gamma,
                    analytics.risk.var_95,
                    analytics.risk.stress_loss,
                    _isoformat_utc(analytics.risk.valuation_ts),
                    _isoformat_utc(market_data_as_of_ts),
                    _isoformat_utc(valuation_ts),
                ),
            )
            connection.commit()

        return PersistedAnalytics(
            portfolio_id=analytics.portfolio_id,
            position_snapshot_ids=position_snapshot_ids,
            pnl_snapshot_id=pnl_snapshot_id,
            risk_snapshot_id=risk_snapshot_id,
            valuation_ts=valuation_ts,
            market_data_as_of_ts=market_data_as_of_ts,
        )

    def update_trade_status(self, trade_id: str, status: str, *, updated_at: datetime) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE trades
                SET status = ?, updated_at = ?
                WHERE trade_id = ?
                """,
                (status, _isoformat_utc(updated_at), trade_id),
            )
            connection.commit()

    @staticmethod
    def _row_to_trade(row: sqlite3.Row) -> Trade:
        return Trade(
            trade_id=str(row["trade_id"]),
            portfolio_id=str(row["portfolio_id"]),
            position_id=str(row["position_id"]),
            instrument_id=str(row["instrument_id"]),
            instrument_name=str(row["instrument_name"]),
            asset_class=str(row["asset_class"]),
            currency=str(row["currency"]),
            side=str(row["side"]),
            quantity=float(row["quantity"]),
            price=float(row["price"]),
            contract_multiplier=float(row["contract_multiplier"]),
            trade_timestamp=_parse_datetime(row["trade_timestamp"]),
            settlement_date=_parse_date(row["settlement_date"]),
            strategy=row["strategy"],
            book=row["book"],
            desk=row["desk"],
            status=str(row["status"]),
            version=int(row["version"]),
        )
