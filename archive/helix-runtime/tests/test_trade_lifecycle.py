from __future__ import annotations

import sqlite3
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from helix_runtime.application.processors import (
    PortfolioPlComputeProcessor,
    PortfolioRiskComputeProcessor,
    PositionPlComputeProcessor,
    TradeComputeProcessor,
)
from helix_runtime.brokers.config import RabbitMqConfig
from helix_runtime.brokers.payloads import RabbitMqTask
from helix_runtime.infrastructure.sqlite_store import SqliteHelixStore


class RecordingEventPublisher:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, object]]] = []

    def publish(self, topic: str, payload: dict[str, object]) -> None:
        self.events.append((topic, payload))


class RecordingTaskPublisher:
    def __init__(self) -> None:
        self.calls: list[tuple[str, RabbitMqTask]] = []

    def publish_task(self, queue_name: str, task: RabbitMqTask) -> RabbitMqTask:
        self.calls.append((queue_name, task))
        return task


class TradeLifecycleRuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tempdir.name) / "helix_runtime_test.db"
        self._create_schema()
        self._seed_reference_data()
        self.store = SqliteHelixStore(self.db_path)
        self.event_publisher = RecordingEventPublisher()
        self.task_publisher = RecordingTaskPublisher()
        self.rabbitmq_config = RabbitMqConfig(
            host="localhost",
            port=5672,
            username="guest",
            password="guest",
        )

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def test_add_trade_recomputes_trade_position_pnl_and_risk(self) -> None:
        trade_id = "TRD-PF-CM-ADD-001"
        requested_at = datetime(2026, 3, 23, 10, 0, tzinfo=UTC)
        self._insert_trade(
            trade_id=trade_id,
            portfolio_id="PF-CM",
            instrument_id="XAUUSD",
            side="BUY",
            quantity=10.0,
            price=3000.0,
            status="accepted",
            requested_at=requested_at,
        )

        self._run_trade_compute("PF-CM", trade_id, requested_at)
        self._run_position_pipeline("PF-CM", requested_at, trade_id)

        trade_row = self._fetch_one(
            "SELECT status, notional FROM trades WHERE trade_id = ?",
            (trade_id,),
        )
        self.assertEqual(trade_row["status"], "processed")
        self.assertEqual(float(trade_row["notional"]), 30000.0)

        positions = self.store.load_latest_positions("PF-CM")
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0].instrument_id, "XAUUSD")
        self.assertEqual(positions[0].quantity, 10.0)
        self.assertEqual(positions[0].unrealized_pnl, 150.0)
        self.assertEqual(positions[0].total_pnl, 150.0)

        pnl_row = self._latest_snapshot(
            "SELECT total_pnl, realized_pnl, unrealized_pnl FROM pnl WHERE portfolio_id = ?",
            "PF-CM",
        )
        self.assertEqual(float(pnl_row["total_pnl"]), 150.0)
        self.assertEqual(float(pnl_row["realized_pnl"]), 0.0)
        self.assertEqual(float(pnl_row["unrealized_pnl"]), 150.0)

        risk_row = self._latest_snapshot(
            "SELECT delta, gross_exposure, net_exposure, var_95 FROM risk WHERE portfolio_id = ?",
            "PF-CM",
        )
        self.assertEqual(float(risk_row["delta"]), 30150.0)
        self.assertEqual(float(risk_row["gross_exposure"]), 30150.0)
        self.assertEqual(float(risk_row["net_exposure"]), 30150.0)
        self.assertGreater(float(risk_row["var_95"]), 0.0)

    def test_amend_trade_rebuilds_snapshots_from_latest_trade_state(self) -> None:
        trade_id = "TRD-PF-CM-AMEND-001"
        initial_at = datetime(2026, 3, 23, 10, 0, tzinfo=UTC)
        amended_at = datetime(2026, 3, 23, 10, 5, tzinfo=UTC)
        self._insert_trade(
            trade_id=trade_id,
            portfolio_id="PF-CM",
            instrument_id="XAUUSD",
            side="BUY",
            quantity=10.0,
            price=3000.0,
            status="accepted",
            requested_at=initial_at,
        )

        self._run_trade_compute("PF-CM", trade_id, initial_at)
        self._run_position_pipeline("PF-CM", initial_at, trade_id)

        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                UPDATE trades
                SET quantity = ?, price = ?, side = ?, status = ?, version = ?, notional = NULL, updated_at = ?, trade_timestamp = ?
                WHERE trade_id = ?
                """,
                (
                    4.0,
                    3020.0,
                    "BUY",
                    "accepted",
                    2,
                    self._iso(amended_at),
                    self._iso(amended_at),
                    trade_id,
                ),
            )
            connection.commit()

        self._run_trade_compute("PF-CM", trade_id, amended_at)
        self._run_position_pipeline("PF-CM", amended_at, trade_id)

        trade_row = self._fetch_one(
            "SELECT status, notional, quantity, price, version FROM trades WHERE trade_id = ?",
            (trade_id,),
        )
        self.assertEqual(trade_row["status"], "processed")
        self.assertEqual(float(trade_row["notional"]), 12080.0)
        self.assertEqual(float(trade_row["quantity"]), 4.0)
        self.assertEqual(float(trade_row["price"]), 3020.0)
        self.assertEqual(int(trade_row["version"]), 2)

        positions = self.store.load_latest_positions("PF-CM")
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0].quantity, 4.0)
        self.assertEqual(positions[0].average_cost, 3020.0)
        self.assertEqual(positions[0].unrealized_pnl, -20.0)
        self.assertEqual(positions[0].total_pnl, -20.0)

        pnl_row = self._latest_snapshot(
            "SELECT total_pnl, realized_pnl, unrealized_pnl FROM pnl WHERE portfolio_id = ?",
            "PF-CM",
        )
        self.assertEqual(float(pnl_row["total_pnl"]), -20.0)
        self.assertEqual(float(pnl_row["realized_pnl"]), 0.0)
        self.assertEqual(float(pnl_row["unrealized_pnl"]), -20.0)

    def test_delete_trade_clears_positions_and_zeroes_portfolio_snapshots(self) -> None:
        trade_id = "TRD-PF-CM-DELETE-001"
        added_at = datetime(2026, 3, 23, 10, 0, tzinfo=UTC)
        deleted_at = datetime(2026, 3, 23, 10, 10, tzinfo=UTC)
        self._insert_trade(
            trade_id=trade_id,
            portfolio_id="PF-CM",
            instrument_id="XAUUSD",
            side="BUY",
            quantity=10.0,
            price=3000.0,
            status="accepted",
            requested_at=added_at,
        )

        self._run_trade_compute("PF-CM", trade_id, added_at)
        self._run_position_pipeline("PF-CM", added_at, trade_id)

        with sqlite3.connect(self.db_path) as connection:
            connection.execute("DELETE FROM trades WHERE trade_id = ?", (trade_id,))
            connection.commit()

        self._run_position_pipeline("PF-CM", deleted_at, None)

        self.assertEqual(self.store.load_latest_positions("PF-CM"), [])
        remaining_positions = self._fetch_value(
            "SELECT COUNT(*) FROM position WHERE portfolio_id = ?",
            ("PF-CM",),
        )
        self.assertEqual(remaining_positions, 0)

        pnl_row = self._latest_snapshot(
            "SELECT total_pnl, realized_pnl, unrealized_pnl FROM pnl WHERE portfolio_id = ?",
            "PF-CM",
        )
        self.assertEqual(float(pnl_row["total_pnl"]), 0.0)
        self.assertEqual(float(pnl_row["realized_pnl"]), 0.0)
        self.assertEqual(float(pnl_row["unrealized_pnl"]), 0.0)

        risk_row = self._latest_snapshot(
            "SELECT delta, gross_exposure, net_exposure, var_95 FROM risk WHERE portfolio_id = ?",
            "PF-CM",
        )
        self.assertEqual(float(risk_row["delta"]), 0.0)
        self.assertEqual(float(risk_row["gross_exposure"]), 0.0)
        self.assertEqual(float(risk_row["net_exposure"]), 0.0)
        self.assertEqual(float(risk_row["var_95"]), 0.0)

    def _run_trade_compute(self, portfolio_id: str, trade_id: str, requested_at: datetime) -> None:
        processor = TradeComputeProcessor(self.store, self.event_publisher)
        processor.process(
            RabbitMqTask(
                task_id="TASK-TRADE",
                task_type=self.rabbitmq_config.trade_compute_queue,
                portfolio_id=portfolio_id,
                requested_at=requested_at,
                source_event_id=trade_id,
            )
        )

    def _run_position_pipeline(self, portfolio_id: str, requested_at: datetime, source_event_id: str | None) -> None:
        self.task_publisher.calls.clear()
        position_processor = PositionPlComputeProcessor(
            self.store,
            self.event_publisher,
            self.task_publisher,
            self.rabbitmq_config,
        )
        position_processor.process(
            RabbitMqTask(
                task_id="TASK-POS",
                task_type=self.rabbitmq_config.position_pl_compute_queue,
                portfolio_id=portfolio_id,
                requested_at=requested_at,
                source_event_id=source_event_id,
            )
        )

        for queue_name, task in list(self.task_publisher.calls):
            if queue_name == self.rabbitmq_config.portfolio_pl_compute_queue:
                PortfolioPlComputeProcessor(self.store, self.event_publisher).process(task)
            elif queue_name == self.rabbitmq_config.portfolio_risk_compute_queue:
                PortfolioRiskComputeProcessor(self.store, self.event_publisher).process(task)

    def _create_schema(self) -> None:
        schema_path = Path(__file__).resolve().parents[2] / "helix-store" / "schema.sql"
        with sqlite3.connect(self.db_path) as connection:
            connection.executescript(schema_path.read_text())
            connection.commit()

    def _seed_reference_data(self) -> None:
        created_at = self._iso(datetime(2026, 3, 23, 9, 0, tzinfo=UTC))
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                "INSERT INTO portfolio (portfolio_id, name, status, created_at) VALUES (?, ?, ?, ?)",
                ("PF-CM", "Commodities", "active", created_at),
            )
            connection.execute(
                """
                INSERT INTO instrument (instrument_id, instrument_name, asset_class, currency, active)
                VALUES (?, ?, ?, ?, 1)
                """,
                ("XAUUSD", "Gold Spot", "Commodity", "USD"),
            )
            connection.execute(
                "INSERT INTO book (name) VALUES (?)",
                ("CM-987",),
            )
            connection.execute(
                "INSERT INTO market_data (instrument_id, price, volatility, updated_at) VALUES (?, ?, ?, ?)",
                ("XAUUSD", 3015.0, 0.30, created_at),
            )
            connection.commit()

    def _insert_trade(
        self,
        *,
        trade_id: str,
        portfolio_id: str,
        instrument_id: str,
        side: str,
        quantity: float,
        price: float,
        status: str,
        requested_at: datetime,
    ) -> None:
        timestamp = self._iso(requested_at)
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                INSERT INTO trades (
                  trade_id, portfolio_id, position_id, instrument_id, instrument_name,
                  asset_class, currency, side, quantity, price, notional, trade_timestamp,
                  settlement_date, book, status, version, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    trade_id,
                    portfolio_id,
                    f"{portfolio_id}-POS-{instrument_id}",
                    instrument_id,
                    "Gold Spot",
                    "Commodity",
                    "USD",
                    side,
                    quantity,
                    price,
                    None,
                    timestamp,
                    "2026-03-24",
                    "CM-987",
                    status,
                    1,
                    timestamp,
                    timestamp,
                ),
            )
            connection.commit()

    def _latest_snapshot(self, query: str, portfolio_id: str) -> sqlite3.Row:
        with sqlite3.connect(self.db_path) as connection:
            connection.row_factory = sqlite3.Row
            return connection.execute(
                f"{query} ORDER BY valuation_ts DESC LIMIT 1",
                (portfolio_id,),
            ).fetchone()

    def _fetch_one(self, query: str, params: tuple[object, ...]) -> sqlite3.Row:
        with sqlite3.connect(self.db_path) as connection:
            connection.row_factory = sqlite3.Row
            return connection.execute(query, params).fetchone()

    def _fetch_value(self, query: str, params: tuple[object, ...]) -> int:
        with sqlite3.connect(self.db_path) as connection:
            return int(connection.execute(query, params).fetchone()[0])

    @staticmethod
    def _iso(value: datetime) -> str:
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    unittest.main()
