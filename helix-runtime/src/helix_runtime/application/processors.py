"""Runtime application services for processing broker-driven workflows."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from helix_core import (
    compute_portfolio_analytics,
    compute_portfolio_pnl,
    compute_portfolio_risk,
    compute_trade_notional,
    resolve_risk_model,
)

from helix_runtime.brokers.payloads import RabbitMqTask, build_trade_updated_payload
from helix_runtime.brokers.topology import (
    PORTFOLIO_PL_UPDATED_TOPIC,
    PORTFOLIO_RISK_UPDATED_TOPIC,
    POSITION_PL_UPDATED_TOPIC,
    POSITION_UPDATED_TOPIC,
    TRADE_UPDATED_TOPIC,
)

from .models import (
    PersistedPortfolioSnapshots,
    PortfolioUpdateEvent,
    TaskProcessingResult,
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


class PositionPlComputeProcessor:
    """Rebuild positions with realized and unrealized P&L, then enqueue downstream work."""

    def __init__(self, store: StoreGateway, publisher: EventPublisher, task_publisher, rabbitmq_config) -> None:
        self._store = store
        self._publisher = publisher
        self._task_publisher = task_publisher
        self._rabbitmq_config = rabbitmq_config

    def process(self, task: RabbitMqTask) -> TaskProcessingResult:
        trades = self._store.get_portfolio_trades(task.portfolio_id, statuses=("accepted", "processed", "processing"))
        market_inputs = self._store.get_market_inputs_for_portfolio(task.portfolio_id)
        market_data_as_of_ts = _market_data_as_of(market_inputs, task.requested_at)
        analytics = compute_portfolio_analytics(
            task.portfolio_id,
            trades,
            market_inputs,
            valuation_ts=task.requested_at,
        )
        position_snapshot_ids = self._store.save_positions(
            analytics.portfolio_id,
            analytics.positions,
            valuation_ts=analytics.pnl.valuation_ts,
            source_event_id=task.source_event_id or task.task_id,
        )
        persisted = PersistedPortfolioSnapshots(
            portfolio_id=analytics.portfolio_id,
            position_snapshot_ids=position_snapshot_ids,
            pnl_snapshot_id=None,
            risk_snapshot_id=None,
            valuation_ts=analytics.pnl.valuation_ts,
            market_data_as_of_ts=market_data_as_of_ts,
        )
        _enqueue_follow_up_task(
            self._task_publisher,
            self._rabbitmq_config.portfolio_pl_compute_queue,
            task.portfolio_id,
            task.requested_at,
            task.source_event_id,
        )
        _enqueue_follow_up_task(
            self._task_publisher,
            self._rabbitmq_config.portfolio_risk_compute_queue,
            task.portfolio_id,
            task.requested_at,
            task.source_event_id,
        )
        published_events = _publish_updates(self._publisher, persisted)
        return TaskProcessingResult(
            task_id=task.task_id,
            task_type=task.task_type,
            portfolio_id=task.portfolio_id,
            snapshot_ids=position_snapshot_ids,
            published_events=published_events,
        )


class PortfolioPlComputeProcessor:
    """Aggregate persisted position P&L into a portfolio P&L snapshot."""

    def __init__(self, store: StoreGateway, publisher: EventPublisher) -> None:
        self._store = store
        self._publisher = publisher

    def process(self, task: RabbitMqTask) -> TaskProcessingResult:
        positions = self._store.load_latest_positions(task.portfolio_id)
        pnl = compute_portfolio_pnl(
            task.portfolio_id,
            positions,
            valuation_ts=task.requested_at,
        )
        market_inputs = self._store.get_market_inputs_for_portfolio(task.portfolio_id)
        market_data_as_of_ts = _market_data_as_of(market_inputs, task.requested_at)
        snapshot_id = self._store.save_pnl(
            pnl,
            market_data_as_of_ts=market_data_as_of_ts,
        )
        published_events = _publish_updates(
            self._publisher,
            PersistedPortfolioSnapshots(
                portfolio_id=task.portfolio_id,
                position_snapshot_ids=[],
                pnl_snapshot_id=snapshot_id,
                risk_snapshot_id=None,
                valuation_ts=pnl.valuation_ts,
                market_data_as_of_ts=market_data_as_of_ts,
            ),
        )
        return TaskProcessingResult(
            task_id=task.task_id,
            task_type=task.task_type,
            portfolio_id=task.portfolio_id,
            snapshot_ids=[snapshot_id],
            published_events=published_events,
        )


class PortfolioRiskComputeProcessor:
    """Aggregate persisted positions into a portfolio risk snapshot."""

    def __init__(self, store: StoreGateway, publisher: EventPublisher) -> None:
        self._store = store
        self._publisher = publisher

    def process(self, task: RabbitMqTask) -> TaskProcessingResult:
        positions = self._store.load_latest_positions(task.portfolio_id)
        market_inputs = self._store.get_market_inputs_for_portfolio(task.portfolio_id)
        market_data_as_of_ts = _market_data_as_of(market_inputs, task.requested_at)
        risk = compute_portfolio_risk(
            task.portfolio_id,
            positions,
            market_inputs,
            valuation_ts=task.requested_at,
            risk_model=resolve_risk_model(None),
        )
        snapshot_id = self._store.save_risk(
            risk,
            market_data_as_of_ts=market_data_as_of_ts,
        )
        published_events = _publish_updates(
            self._publisher,
            PersistedPortfolioSnapshots(
                portfolio_id=task.portfolio_id,
                position_snapshot_ids=[],
                pnl_snapshot_id=None,
                risk_snapshot_id=snapshot_id,
                valuation_ts=risk.valuation_ts,
                market_data_as_of_ts=market_data_as_of_ts,
            ),
        )
        return TaskProcessingResult(
            task_id=task.task_id,
            task_type=task.task_type,
            portfolio_id=task.portfolio_id,
            snapshot_ids=[snapshot_id],
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


def _enqueue_follow_up_task(task_publisher, queue_name: str, portfolio_id: str, requested_at: datetime, source_event_id: str | None) -> None:
    task = RabbitMqTask(
        task_id=f"TASK-{uuid4().hex[:12].upper()}",
        task_type=queue_name,
        portfolio_id=portfolio_id,
        requested_at=requested_at,
        source_event_id=source_event_id,
    )
    task_publisher.publish_task(queue_name, task)


def _publish_updates(publisher: EventPublisher, persisted: PersistedPortfolioSnapshots) -> list[PortfolioUpdateEvent]:
    positions_snapshot_id = (
        persisted.position_snapshot_ids[-1]
        if persisted.position_snapshot_ids
        else persisted.pnl_snapshot_id or persisted.risk_snapshot_id
    )
    topic_to_snapshot = {
        POSITION_UPDATED_TOPIC: positions_snapshot_id if persisted.position_snapshot_ids else None,
        POSITION_PL_UPDATED_TOPIC: positions_snapshot_id if persisted.position_snapshot_ids else None,
        PORTFOLIO_PL_UPDATED_TOPIC: persisted.pnl_snapshot_id,
        PORTFOLIO_RISK_UPDATED_TOPIC: persisted.risk_snapshot_id,
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
