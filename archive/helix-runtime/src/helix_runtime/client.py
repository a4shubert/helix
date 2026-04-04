"""Client helpers for external trade booking into the Helix platform."""

from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

from .brokers.adapters import RabbitMqTaskPublisher
from .brokers.config import RabbitMqConfig, load_rabbitmq_config_from_env
from .brokers.payloads import RabbitMqTask


@dataclass(frozen=True)
class TradeBookingRequest:
    """Trade fields required for direct external booking."""

    portfolio_id: str
    instrument_id: str
    side: str
    quantity: float
    price: float
    settlement_date: str
    book: str


@dataclass(frozen=True)
class BookedTrade:
    """Identifiers returned after a trade is inserted and queued."""

    trade_id: str
    position_id: str
    portfolio_id: str
    requested_at: datetime


def utc_now() -> datetime:
    return datetime.now(UTC)


def isoformat_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def default_db_path() -> Path:
    return Path(os.environ.get("HELIX_DB_PATH", "helix-store/helix.db")).resolve()


def default_rabbitmq_config() -> RabbitMqConfig:
    return load_rabbitmq_config_from_env()


def build_trade_identifiers(portfolio_id: str, requested_at: datetime) -> tuple[str, str]:
    timestamp = requested_at.strftime("%Y%m%d%H%M%S%f")[:-3]
    return (f"TRD-{portfolio_id}-{timestamp}", f"{portfolio_id}-POS-{timestamp}")


def validate_trade_booking_request(request: TradeBookingRequest) -> None:
    side = request.side.upper()
    if side not in {"BUY", "SELL"}:
        raise ValueError("Trade side must be BUY or SELL.")
    if request.quantity <= 0:
        raise ValueError("Trade quantity must be positive.")
    if request.price <= 0:
        raise ValueError("Trade price must be positive.")
    date.fromisoformat(request.settlement_date)


def book_trade(
    request: TradeBookingRequest,
    *,
    db_path: str | Path | None = None,
    rabbitmq_config: RabbitMqConfig | None = None,
    requested_at: datetime | None = None,
) -> BookedTrade:
    """Insert a trade directly into SQLite and queue runtime processing tasks."""

    validate_trade_booking_request(request)
    db_path = Path(db_path or default_db_path()).resolve()
    rabbitmq_config = rabbitmq_config or default_rabbitmq_config()
    requested_at = requested_at or utc_now()

    trade_id, position_id = insert_trade(
        db_path=db_path,
        request=request,
        requested_at=requested_at,
    )
    publish_trade_processing_tasks(
        portfolio_id=request.portfolio_id,
        trade_id=trade_id,
        requested_at=requested_at,
        rabbitmq_config=rabbitmq_config,
    )
    return BookedTrade(
        trade_id=trade_id,
        position_id=position_id,
        portfolio_id=request.portfolio_id,
        requested_at=requested_at,
    )


def insert_trade(
    *,
    db_path: str | Path,
    request: TradeBookingRequest,
    requested_at: datetime,
) -> tuple[str, str]:
    """Insert a new accepted trade row directly into the Helix SQLite store."""

    trade_id, position_id = build_trade_identifiers(request.portfolio_id, requested_at)
    trade_timestamp = isoformat_utc(requested_at)

    with sqlite3.connect(Path(db_path)) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON;")
        instrument = load_valid_instrument(connection, request.instrument_id)
        ensure_portfolio_exists(connection, request.portfolio_id)
        ensure_book_exists(connection, request.book)
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
                request.portfolio_id,
                position_id,
                request.instrument_id,
                instrument["instrument_name"],
                instrument["asset_class"],
                instrument["currency"],
                request.side.upper(),
                request.quantity,
                request.price,
                None,
                trade_timestamp,
                request.settlement_date,
                request.book,
                "accepted",
                1,
                trade_timestamp,
                trade_timestamp,
            ),
        )
        connection.commit()

    return (trade_id, position_id)


def publish_trade_processing_tasks(
    *,
    portfolio_id: str,
    trade_id: str,
    requested_at: datetime,
    rabbitmq_config: RabbitMqConfig | None = None,
) -> None:
    """Publish the trade.compute and position.pl.compute tasks for a booked trade."""

    rabbitmq_config = rabbitmq_config or default_rabbitmq_config()
    publisher = RabbitMqTaskPublisher(rabbitmq_config)

    for queue_name in (
        rabbitmq_config.trade_compute_queue,
        rabbitmq_config.position_pl_compute_queue,
    ):
        task = RabbitMqTask(
            task_id=f"TASK-{uuid4().hex[:12].upper()}",
            task_type=queue_name,
            portfolio_id=portfolio_id,
            requested_at=requested_at,
            source_event_id=trade_id,
        )
        publisher.publish_task(queue_name, task)


def ensure_portfolio_exists(connection: sqlite3.Connection, portfolio_id: str) -> None:
    row = connection.execute(
        "SELECT portfolio_id FROM portfolio WHERE portfolio_id = ?",
        (portfolio_id,),
    ).fetchone()
    if row is None:
        raise ValueError(f"Unknown portfolio_id '{portfolio_id}'.")


def ensure_book_exists(connection: sqlite3.Connection, book: str) -> None:
    row = connection.execute(
        "SELECT name FROM book WHERE name = ?",
        (book,),
    ).fetchone()
    if row is None:
        raise ValueError(f"Unknown book '{book}'.")


def load_valid_instrument(connection: sqlite3.Connection, instrument_id: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT instrument_id, instrument_name, asset_class, currency
        FROM instrument
        WHERE instrument_id = ? AND active = 1
        """,
        (instrument_id,),
    ).fetchone()
    if row is None:
        raise ValueError(f"Unknown active instrument_id '{instrument_id}'.")
    return row
