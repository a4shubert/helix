"""SQLite-backed runtime store adapter."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from helix_core import MarketInput, PortfolioAnalytics, Trade

from helix_runtime.application.models import PersistedAnalytics


DEFAULT_RISK_WEIGHT_BY_ASSET_CLASS = {
    "Equity": 0.25,
    "Fixed Income": 0.12,
    "Commodity": 0.30,
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


def _round2(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


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
        trades = self.get_portfolio_trades(
            portfolio_id,
            statuses=("accepted", "processed", "processing"),
        )
        instruments = {trade.instrument_id: trade for trade in trades}
        if not instruments:
            return {}

        snapshot_ids = sorted(set(instruments))
        placeholders = ", ".join("?" for _ in snapshot_ids)
        with self._connect() as connection:
            market_rows = connection.execute(
                f"""
                SELECT instrument_id, price, updated_at
                FROM market_data
                WHERE instrument_id IN ({placeholders})
                """,
                snapshot_ids,
            ).fetchall()
            position_rows = connection.execute(
                f"""
                SELECT instrument_id, market_price, market_data_ts, as_of_ts
                FROM position
                WHERE portfolio_id = ?
                  AND instrument_id IN ({", ".join("?" for _ in instruments)})
                ORDER BY as_of_ts DESC, last_update_ts DESC
                """,
                [portfolio_id, *sorted(instruments)],
            ).fetchall()

        latest_market_price: dict[str, float] = {}
        latest_market_ts: dict[str, datetime] = {}
        for row in market_rows:
            instrument_id = str(row["instrument_id"])
            latest_market_price[instrument_id] = float(row["price"])
            latest_market_ts[instrument_id] = _parse_datetime(row["updated_at"])

        latest_position_price: dict[str, float] = {}
        latest_position_ts: dict[str, datetime | None] = {}
        for row in position_rows:
            instrument_id = str(row["instrument_id"])
            if instrument_id not in latest_position_price and row["market_price"] is not None:
                latest_position_price[instrument_id] = float(row["market_price"])
            latest_position_ts.setdefault(
                instrument_id,
                _parse_datetime(row["market_data_ts"] or row["as_of_ts"]),
            )

        market_inputs: dict[str, MarketInput] = {}
        for instrument_id, trade in instruments.items():
            market_price = latest_market_price.get(
                instrument_id,
                latest_position_price.get(instrument_id, trade.price),
            )

            risk_weight = DEFAULT_RISK_WEIGHT_BY_ASSET_CLASS.get(trade.asset_class, 0.20)
            market_inputs[instrument_id] = MarketInput(
                instrument_id=instrument_id,
                market_price=market_price,
                risk_weight=risk_weight,
                market_data_timestamp=
                latest_market_ts.get(instrument_id)
                or latest_position_ts.get(instrument_id)
                or trade.trade_timestamp,
            )

        return market_inputs

    def save_portfolio_analytics(
        self,
        analytics: PortfolioAnalytics,
        *,
        market_data_as_of_ts: datetime,
        source_event_id: str,
    ) -> PersistedAnalytics:
        position_snapshot_ids = self.save_positions(
            analytics.portfolio_id,
            analytics.positions,
            valuation_ts=analytics.pnl.valuation_ts,
            source_event_id=source_event_id,
        )
        pnl_snapshot_id = self.save_pnl(
            analytics.pnl,
            market_data_as_of_ts=market_data_as_of_ts,
        )
        risk_snapshot_id = self.save_risk(
            analytics.risk,
            market_data_as_of_ts=market_data_as_of_ts,
        )

        return PersistedAnalytics(
            portfolio_id=analytics.portfolio_id,
            position_snapshot_ids=position_snapshot_ids,
            pnl_snapshot_id=pnl_snapshot_id,
            risk_snapshot_id=risk_snapshot_id,
            valuation_ts=analytics.pnl.valuation_ts,
            market_data_as_of_ts=market_data_as_of_ts,
        )

    def save_positions(
        self,
        portfolio_id: str,
        positions,
        *,
        valuation_ts: datetime,
        source_event_id: str,
    ) -> list[str]:
        suffix = _snapshot_suffix(valuation_ts)
        position_snapshot_ids: list[str] = []
        with self._connect() as connection:
            for position in positions:
                snapshot_id = f"POSITION-{position.position_id}-{suffix}"
                position_snapshot_ids.append(snapshot_id)
                connection.execute(
                    """
                    INSERT OR REPLACE INTO position (
                      snapshot_id, portfolio_id, position_id, instrument_id, instrument_name,
                      asset_class, currency, quantity, direction, average_cost,
                      last_update_ts, market_price, market_data_ts, notional,
                      market_value, book, as_of_ts, source_event_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        snapshot_id,
                        portfolio_id,
                        position.position_id,
                        position.instrument_id,
                        position.instrument_name,
                        position.asset_class,
                        position.currency,
                        position.quantity,
                        position.direction,
                        position.average_cost,
                        _isoformat_utc(position.last_update_ts),
                        position.market_price,
                        _isoformat_utc(position.market_data_ts) if position.market_data_ts else None,
                        position.notional,
                        position.market_value,
                        position.book,
                        _isoformat_utc(valuation_ts),
                        source_event_id,
                    ),
                )
            connection.commit()
        return position_snapshot_ids

    def save_pnl(
        self,
        pnl,
        *,
        market_data_as_of_ts: datetime,
    ) -> str:
        suffix = _snapshot_suffix(pnl.valuation_ts)
        snapshot_id = f"PNL-{pnl.portfolio_id}-{suffix}"
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO pnl (
                  snapshot_id, portfolio_id, total_pnl, realized_pnl, unrealized_pnl,
                  valuation_ts, market_data_as_of_ts, position_as_of_ts
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    snapshot_id,
                    pnl.portfolio_id,
                    _round2(pnl.total_pnl),
                    _round2(pnl.realized_pnl),
                    _round2(pnl.unrealized_pnl),
                    _isoformat_utc(pnl.valuation_ts),
                    _isoformat_utc(market_data_as_of_ts),
                    _isoformat_utc(pnl.valuation_ts),
                ),
            )
            connection.commit()
        return snapshot_id

    def save_risk(
        self,
        risk,
        *,
        market_data_as_of_ts: datetime,
    ) -> str:
        suffix = _snapshot_suffix(risk.valuation_ts)
        snapshot_id = f"RISK-{risk.portfolio_id}-{suffix}"
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO risk (
                  snapshot_id, portfolio_id, delta, gamma, var_95,
                  valuation_ts, market_data_as_of_ts, position_as_of_ts
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    snapshot_id,
                    risk.portfolio_id,
                    _round2(risk.delta),
                    _round2(risk.gamma),
                    _round2(risk.var_95),
                    _isoformat_utc(risk.valuation_ts),
                    _isoformat_utc(market_data_as_of_ts),
                    _isoformat_utc(risk.valuation_ts),
                ),
            )
            connection.commit()
        return snapshot_id

    def update_trade_status(
        self,
        trade_id: str,
        status: str,
        *,
        updated_at: datetime,
        notional: float | None = None,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE trades
                SET status = ?, updated_at = ?, notional = COALESCE(?, notional)
                WHERE trade_id = ?
                """,
                (status, _isoformat_utc(updated_at), notional, trade_id),
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
            trade_timestamp=_parse_datetime(row["trade_timestamp"]),
            settlement_date=_parse_date(row["settlement_date"]),
            book=row["book"],
            status=str(row["status"]),
            version=int(row["version"]),
        )
