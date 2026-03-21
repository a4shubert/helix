"""Runtime application service for processing trade-created events."""

from __future__ import annotations

from helix_core import compute_portfolio_analytics

from .models import PersistedAnalytics, PortfolioUpdateEvent, TradeCreatedEvent, TradeProcessingResult
from .ports import EventPublisher, StoreGateway


class TradeCreatedProcessor:
    """Recompute portfolio analytics after a newly accepted trade."""

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

        trades = self._store.get_portfolio_trades(
            event.portfolio_id,
            statuses=("accepted", "processed"),
        )
        market_inputs = self._store.get_market_inputs_for_portfolio(event.portfolio_id)
        market_data_as_of_ts = max(
            market_input.market_data_timestamp
            for market_input in market_inputs.values()
            if market_input.market_data_timestamp is not None
        )

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
        )

        published_events = self._publish_updates(persisted)
        return TradeProcessingResult(
            trade_id=event.trade_id,
            portfolio_id=event.portfolio_id,
            persisted=persisted,
            published_events=published_events,
        )

    def _publish_updates(self, persisted: PersistedAnalytics) -> list[PortfolioUpdateEvent]:
        topic_to_snapshot = {
            "portfolio.updated": persisted.position_snapshot_ids[-1],
            "pnl.updated": persisted.pnl_snapshot_id,
            "risk.updated": persisted.risk_snapshot_id,
        }
        published_events: list[PortfolioUpdateEvent] = []
        for topic, snapshot_id in topic_to_snapshot.items():
            payload = {
                "portfolio_id": persisted.portfolio_id,
                "snapshot_id": snapshot_id,
                "occurred_at": persisted.valuation_ts.isoformat(),
            }
            self._publisher.publish(topic, payload)
            published_events.append(
                PortfolioUpdateEvent(
                    topic=topic,
                    portfolio_id=persisted.portfolio_id,
                    snapshot_id=snapshot_id,
                    occurred_at=persisted.valuation_ts,
                )
            )
        return published_events
