"""Event and task payload builders aligned with the Helix README."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from .broker_names import TRADE_CREATED_TOPIC, TRADE_UPDATED_TOPIC
from .config import KafkaConfig
from .models import PortfolioUpdateEvent, TradeCreatedEvent


def _isoformat_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class RabbitMqTask:
    task_id: str
    task_type: str
    portfolio_id: str
    requested_at: datetime
    source_event_id: str | None = None

    def to_payload(self) -> dict[str, object]:
        payload = {
            "taskId": self.task_id,
            "taskType": self.task_type,
            "portfolioId": self.portfolio_id,
            "requestedAt": _isoformat_utc(self.requested_at),
        }
        if self.source_event_id:
            payload["sourceEventId"] = self.source_event_id
        return payload


def parse_trade_created_payload(payload: str | bytes | dict[str, object]) -> TradeCreatedEvent:
    if isinstance(payload, bytes):
        data = json.loads(payload.decode("utf-8"))
    elif isinstance(payload, str):
        data = json.loads(payload)
    else:
        data = payload

    event_type = str(data["eventType"])
    if event_type != TRADE_CREATED_TOPIC:
        raise ValueError(f"Unsupported event type '{event_type}'.")

    timestamp = str(data["timestamp"])
    if timestamp.endswith("Z"):
        timestamp = timestamp[:-1] + "+00:00"
    occurred_at = datetime.fromisoformat(timestamp).astimezone(UTC)

    return TradeCreatedEvent(
        trade_id=str(data["tradeId"]),
        portfolio_id=str(data["portfolioId"]),
        occurred_at=occurred_at,
    )


def build_trade_created_payload(event: TradeCreatedEvent) -> dict[str, object]:
    return {
        "eventId": f"EVT-{uuid4().hex[:12].upper()}",
        "eventType": TRADE_CREATED_TOPIC,
        "tradeId": event.trade_id,
        "portfolioId": event.portfolio_id,
        "timestamp": _isoformat_utc(event.occurred_at),
    }


def build_trade_updated_payload(
    *,
    trade_id: str,
    portfolio_id: str,
    notional: float,
    status: str,
    occurred_at: datetime,
) -> dict[str, object]:
    return {
        "eventId": f"EVT-{uuid4().hex[:12].upper()}",
        "eventType": TRADE_UPDATED_TOPIC,
        "tradeId": trade_id,
        "portfolioId": portfolio_id,
        "snapshotId": trade_id,
        "status": status,
        "notional": notional,
        "timestamp": _isoformat_utc(occurred_at),
    }


def build_portfolio_update_payload(event: PortfolioUpdateEvent) -> dict[str, object]:
    return {
        "eventId": f"EVT-{uuid4().hex[:12].upper()}",
        "eventType": event.topic,
        "portfolioId": event.portfolio_id,
        "snapshotId": event.snapshot_id,
        "timestamp": _isoformat_utc(event.occurred_at),
    }


def kafka_topic_for_update(event: PortfolioUpdateEvent, config: KafkaConfig) -> str:
    mapping = {
        "positions.updated": config.positions_updated_topic,
        "pl.updated": config.pl_updated_topic,
        "risk.updated": config.risk_updated_topic,
    }
    try:
        return mapping[event.topic]
    except KeyError as exc:
        raise ValueError(f"Unsupported update topic '{event.topic}'.") from exc
