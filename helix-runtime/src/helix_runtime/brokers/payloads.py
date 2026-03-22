"""Event and task payload builders aligned with the Helix README."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from helix_runtime.application.models import PortfolioUpdateEvent

from .config import KafkaConfig
from .topology import TRADE_UPDATED_TOPIC


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
        "portfolio.updated": config.portfolio_updated_topic,
        "pl.updated": config.pl_updated_topic,
        "risk.updated": config.risk_updated_topic,
    }
    try:
        return mapping[event.topic]
    except KeyError as exc:
        raise ValueError(f"Unsupported update topic '{event.topic}'.") from exc
