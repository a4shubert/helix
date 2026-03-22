"""Runtime application services for processing broker-driven workflows."""

from __future__ import annotations

from datetime import datetime

from helix_core import compute_portfolio_analytics, compute_trade_notional

from .broker_names import TRADE_UPDATED_TOPIC
from .events import RabbitMqTask, build_trade_updated_payload
from .models import (
    PersistedAnalytics,
    PortfolioUpdateEvent,
    TaskProcessingResult,
    TradeCreatedEvent,
    TradeProcessingResult,
)
from .ports import EventPublisher, StoreGateway


def _market_data_as_of(market_inputs: dict, fallback: datetime) -> datetime:
    return max(
        (
            market_input.market_data_timestamp
            for market_input in market_inputs.values()
            if market_input.market_data_timestamp is not None
        ),
        default=fallback,
    )


class TradeCreatedProcessor:
    """Compatibility processor for direct local trade processing."""

    def __init__(self, store: StoreGateway, publisher: EventPublisher) -> None:
        self._store = store
        self._publisher = publisher

    def process(self, event: TradeCreatedEvent) -> TradeProcessingResult:
        triggering_trade = self._store.get_trade(event.trade_id)
        if triggering_trade.portfolio_id != event.portfolio_id:
            raise ValueError(
                f"Trade '{event.trade_id}' belongs to portfolio "
                f"'{triggering_trade.portfolio_id}', not '{event.portfolio_id}'."
            )

        trades = self._store.get_portfolio_trades(event.portfolio_id, statuses=("accepted", "processed"))
        market_inputs = self._store.get_market_inputs_for_portfolio(event.portfolio_id)
        market_data_as_of_ts = _market_data_as_of(market_inputs, event.occurred_at)
        analytics = compute_portfolio_analytics(
            event.portfolio_id,
            trades,
            market_inputs,
            valuation_ts=event.occurred_at,
        )
        persisted = self._store.save_portfolio_analytics(
            analytics,
            market_data_as_of_ts=market_data_as_of_ts,
            source_event_id=event.trade_id,
        )
        self._store.update_trade_status(
            event.trade_id,
            "processed",
            updated_at=event.occurred_at,
            notional=triggering_trade.quantity * triggering_trade.price,
        )
        published_events = _publish_updates(self._publisher, persisted)
        return TradeProcessingResult(
            trade_id=event.trade_id,
            portfolio_id=event.portfolio_id,
            persisted=persisted,
            published_events=published_events,
        )


class PortfolioRecomputeProcessor:
    """Run the internal positions -> P&L -> risk pipeline from one RabbitMQ task."""

    def __init__(self, store: StoreGateway, publisher: EventPublisher) -> None:
        self._store = store
        self._publisher = publisher

    def process(self, task: RabbitMqTask) -> TaskProcessingResult:
        if task.source_event_id:
            self._store.update_trade_status(
                task.source_event_id,
                "processing",
                updated_at=task.requested_at,
            )

        trades = self._store.get_portfolio_trades(task.portfolio_id, statuses=("accepted", "processed", "processing"))
        market_inputs = self._store.get_market_inputs_for_portfolio(task.portfolio_id)
        market_data_as_of_ts = _market_data_as_of(market_inputs, task.requested_at)
        analytics = compute_portfolio_analytics(
            task.portfolio_id,
            trades,
            market_inputs,
            valuation_ts=task.requested_at,
        )
        persisted = self._store.save_portfolio_analytics(
            analytics,
            market_data_as_of_ts=market_data_as_of_ts,
            source_event_id=task.source_event_id or task.task_id,
        )

        if task.source_event_id:
            triggering_trade = self._store.get_trade(task.source_event_id)
            self._store.update_trade_status(
                task.source_event_id,
                "processed",
                updated_at=task.requested_at,
                notional=triggering_trade.quantity * triggering_trade.price,
            )

        published_events = _publish_updates(self._publisher, persisted)
        return TaskProcessingResult(
            task_id=task.task_id,
            task_type=task.task_type,
            portfolio_id=task.portfolio_id,
            persisted=persisted,
            published_events=published_events,
        )


class TradeComputeProcessor:
    """Compute trade notional and publish trade.updated."""

    def __init__(self, store: StoreGateway, publisher: EventPublisher) -> None:
        self._store = store
        self._publisher = publisher

    def process(self, task: RabbitMqTask) -> dict[str, object]:
        if not task.source_event_id:
            raise ValueError("trade.compute task requires sourceEventId (trade_id).")

        trade = self._store.get_trade(task.source_event_id)
        if trade.portfolio_id != task.portfolio_id:
            raise ValueError(
                f"Trade '{trade.trade_id}' belongs to portfolio "
                f"'{trade.portfolio_id}', not '{task.portfolio_id}'."
            )

        notional = compute_trade_notional(trade.quantity, trade.price)
        self._store.update_trade_status(
            trade.trade_id,
            "processed",
            updated_at=task.requested_at,
            notional=notional,
        )

        payload = build_trade_updated_payload(
            trade_id=trade.trade_id,
            portfolio_id=trade.portfolio_id,
            notional=notional,
            status="processed",
            occurred_at=task.requested_at,
        )
        self._publisher.publish(TRADE_UPDATED_TOPIC, payload)

        return {
            "task_id": task.task_id,
            "task_type": task.task_type,
            "portfolio_id": task.portfolio_id,
            "trade_id": trade.trade_id,
            "notional": notional,
        }


def _publish_updates(publisher: EventPublisher, persisted: PersistedAnalytics) -> list[PortfolioUpdateEvent]:
    positions_snapshot_id = (
        persisted.position_snapshot_ids[-1]
        if persisted.position_snapshot_ids
        else persisted.pnl_snapshot_id or persisted.risk_snapshot_id
    )
    topic_to_snapshot = {
        "positions.updated": positions_snapshot_id,
        "pl.updated": persisted.pnl_snapshot_id,
        "risk.updated": persisted.risk_snapshot_id,
    }
    published_events: list[PortfolioUpdateEvent] = []
    for topic, snapshot_id in topic_to_snapshot.items():
        if not snapshot_id:
            continue
        payload = {
            "portfolio_id": persisted.portfolio_id,
            "snapshot_id": snapshot_id,
            "occurred_at": persisted.valuation_ts.isoformat(),
        }
        publisher.publish(topic, payload)
        published_events.append(
            PortfolioUpdateEvent(
                topic=topic,
                portfolio_id=persisted.portfolio_id,
                snapshot_id=snapshot_id,
                occurred_at=persisted.valuation_ts,
            )
        )
    return published_events
