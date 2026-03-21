# Helix System Design Document

This document defines the target system design for **Helix**, a front-office portfolio valuation, P&L, and risk platform. It consolidates the final architectural choices into one coherent specification: components, APIs, eventing, persistence model, and operational workflows. It follows the finalized platform design and workflow decisions already established.

---

## 1. Purpose

Helix is designed for portfolio managers and traders to:

- view positions, P&L, and risk
- run what-if and scenario valuations
- enter and manage live trades
- observe market data-driven portfolio changes
- access generated reports
- monitor alerts and operational exceptions

The platform must behave like a credible institutional system rather than a single analytics library demo.

---

## 2. Architectural principles

### 2.1 Single public ingress

`helix-rest` is the **only public synchronous entry point** for `helix-web`.

`helix-web` does not communicate directly with Kafka or RabbitMQ.

### 2.2 Clear separation of responsibilities

- `helix-core` performs analytics only
- `helix-rest` owns synchronous APIs, validation, auth, and request orchestration
- `helix-runtime` owns asynchronous event processing and background execution
- `helix-store` owns persisted state
- `helix-web` owns presentation only

### 2.3 Separation of live and scenario state

Live portfolio state and what-if/scenario state are strictly separated.

### 2.4 Incremental intraday + full scheduled recalculation

- incremental recalculation after trades and market updates
- full revaluation and reconciliation on schedule

### 2.5 Operational transparency

Every displayed number should carry timestamps and operational freshness context.

---

## 3. High-level architecture

```text
+-------------+        HTTPS / WebSocket        +-------------+
|  helix-web  |  <--------------------------->  | helix-rest  |
+-------------+                                 +-------------+
                                                       |
                              +------------------------+------------------------+
                              |                         |                        |
                              | sync calc               | reads/writes           | publishes/submits
                              v                         v                        v
                        +-------------+          +-------------+         +-------------------+
                        | helix-core  |          | helix-store |         | Kafka / RabbitMQ  |
                        +-------------+          +-------------+         +-------------------+
                                                                                   |
                                                                                   | consumes
                                                                                   v
                                                                            +---------------+
                                                                            | helix-runtime |
                                                                            +---------------+
                                                                                   |
                                                                                   | calls
                                                                                   v
                                                                            +-------------+
                                                                            | helix-core  |
                                                                            +-------------+
                                                                                   |
                                                                                   | writes
                                                                                   v
                                                                            +-------------+
                                                                            | helix-store |
                                                                            +-------------+
```

---

## 4. Component responsibilities

### 4.1 `helix-web`

Presentation layer.

#### Responsibilities

- dashboard
- portfolio overview
- trade entry and trade blotter
- what-if / scenario valuation screen
- market data screen
- reports screen
- alerts / exceptions screen

#### Non-responsibilities

- no direct Kafka publishing
- no direct RabbitMQ submission
- no direct database access
- no pricing or risk logic

---

### 4.2 `helix-rest`

Synchronous API and application layer.

#### Responsibilities

- authentication and authorization
- input validation
- request orchestration
- synchronous scenario valuation requests
- live trade submission and acknowledgment
- persisted state queries from `helix-store`
- publishing internal business events to Kafka
- submitting background jobs to RabbitMQ where needed
- exposing push channel to UI via WebSocket or SSE

#### Key decision

This is the only public boundary of the platform.

---

### 4.3 `helix-core`

Analytical library.

#### Responsibilities

- pricing
- valuation
- P&L calculation
- risk calculation
- scenario valuation
- full-book revaluation
- incremental recalculation logic

#### Non-responsibilities

- no HTTP layer
- no persistence ownership
- no messaging ownership

---

### 4.4 `helix-runtime`

Asynchronous processing and worker layer.

#### Responsibilities

- consume Kafka business events
- consume RabbitMQ background tasks
- process trades and market data updates
- call `helix-core`
- update positions, P&L, risk, and derived state
- persist outputs to `helix-store`
- publish completion and downstream update events

---

### 4.5 `helix-store`

Persistence layer.

#### Prototype choice

- SQLite

#### Responsibilities

Persist:

- trades
- positions
- market data snapshots
- P&L snapshots
- risk snapshots
- scenario runs
- reports
- alerts / exceptions
- audit trail and processing metadata

---

## 5. Logical data domains

### 5.1 Live state

Authoritative intraday platform state:

- accepted and processed trades
- current positions
- current market data snapshot
- latest P&L snapshot
- latest risk snapshot
- latest reports
- active alerts

### 5.2 Scenario state

Temporary or saved hypothetical state:

- hypothetical portfolio definitions
- scenario valuation outputs
- scenario risk outputs
- comparisons to live state

Scenario state must not mutate live state unless explicitly committed through a separate workflow.

---

## 6. API design

All APIs are exposed by `helix-rest`.

### 6.1 Query APIs

#### `GET /api/dashboard`

Returns consolidated dashboard payload.

**Response includes**

- positions summary
- latest P&L snapshot
- latest risk snapshot
- latest market data snapshot
- latest reports summary
- active alerts
- freshness timestamps

#### `GET /api/portfolio`

Returns current live portfolio and positions.

**Query parameters**

- `portfolioId`
- `asOf` optional

#### `GET /api/pnl`

Returns latest P&L snapshot.

**Query parameters**

- `portfolioId`
- `asOf` optional
- `aggregation` optional

#### `GET /api/risk`

Returns latest risk snapshot.

**Query parameters**

- `portfolioId`
- `asOf` optional
- `view` optional

#### `GET /api/market-data`

Returns current persisted market data snapshot.

**Query parameters**

- `instrumentId` optional
- `assetClass` optional

#### `GET /api/reports`

Returns available generated reports.

**Query parameters**

- `portfolioId` optional
- `reportType` optional
- `date` optional

#### `GET /api/alerts`

Returns active alerts and recent operational exceptions.

**Query parameters**

- `severity` optional
- `status` optional

#### `GET /api/trades`

Returns trade blotter entries.

**Query parameters**

- `portfolioId`
- `status` optional
- `from` optional
- `to` optional

### 6.2 Command APIs

#### `POST /api/scenarios/value`

Performs synchronous what-if valuation.

**Request**

```json
{
  "portfolioId": "PF-001",
  "scenarioName": "Tech overweight",
  "positions": [
    {
      "instrumentId": "AAPL",
      "quantity": 1500
    }
  ],
  "pricingContext": {
    "marketDataSnapshotId": "MDS-20260321-0900"
  }
}
```

**Response**

```json
{
  "scenarioId": "SCN-000123",
  "value": 1250000.45,
  "pnl": 15432.11,
  "risk": {
    "delta": 10234.55,
    "var95": 84123.77
  },
  "comparedToLive": {
    "valueDiff": 18200.0,
    "pnlDiff": 950.5,
    "riskDiff": 1200.0
  },
  "persisted": false
}
```

#### `POST /api/scenarios/save`

Persists a scenario result for later retrieval.

#### `POST /api/trades`

Submits a new live trade.

**Request**

```json
{
  "portfolioId": "PF-001",
  "instrumentId": "AAPL",
  "side": "BUY",
  "quantity": 100,
  "price": 211.5,
  "tradeDate": "2026-03-21",
  "book": "MAIN"
}
```

**Immediate response**

```json
{
  "tradeId": "TRD-001245",
  "status": "accepted",
  "submittedAt": "2026-03-21T09:21:00Z"
}
```

This API validates and persists the accepted trade record, then publishes `trade.created` to Kafka.

#### `POST /api/trades/{tradeId}/amend`

Submits a trade amendment.

**Immediate response**

- amended request accepted
- event `trade.amended` published
- downstream processing performed asynchronously

#### `POST /api/trades/{tradeId}/cancel`

Submits a trade cancellation.

**Immediate response**

- cancellation request accepted
- event `trade.cancelled` published
- downstream processing performed asynchronously

#### `POST /api/jobs/full-revalue`

Submits a full portfolio revaluation task.

Typically internal/admin only.

#### `POST /api/jobs/generate-report`

Submits report generation task.

Typically internal/admin only.

### 6.3 Push/update channel

#### WebSocket or SSE

`/ws/updates`

Pushes lightweight notifications such as:

- trade processed
- portfolio updated
- P&L updated
- risk updated
- alert created
- report generated

**Example pushed payload**

```json
{
  "type": "pnl.updated",
  "portfolioId": "PF-001",
  "snapshotId": "PNL-20260321-0923",
  "timestamp": "2026-03-21T09:23:11Z"
}
```

---

## 7. Kafka topics

Kafka is used for internal business event streaming.

### 7.1 Topics

#### `trade.created`

Published when a new live trade is accepted by `helix-rest`.

#### `trade.amended`

Published when a trade amendment is accepted.

#### `trade.cancelled`

Published when a trade cancellation is accepted.

#### `marketdata.updated`

Published by upstream feed simulator or data ingress.

#### `portfolio.updated`

Published after positions are updated.

#### `pnl.updated`

Published after P&L snapshot is recomputed.

#### `risk.updated`

Published after risk snapshot is recomputed.

#### `alert.created`

Published when processing failure or operational exception occurs.

### 7.2 Example event payloads

#### `trade.created`

```json
{
  "eventId": "EVT-1001",
  "eventType": "trade.created",
  "tradeId": "TRD-001245",
  "portfolioId": "PF-001",
  "timestamp": "2026-03-21T09:21:00Z"
}
```

#### `marketdata.updated`

```json
{
  "eventId": "EVT-2001",
  "eventType": "marketdata.updated",
  "marketDataSnapshotId": "MDS-20260321-0925",
  "affectedInstruments": ["AAPL", "MSFT"],
  "timestamp": "2026-03-21T09:25:00Z"
}
```

---

## 8. RabbitMQ queues/tasks

RabbitMQ is used for scheduled or heavyweight background work.

### 8.1 Queues

#### `portfolio.full_revalue`

Triggers full-book revaluation.

#### `report.generate`

Triggers report generation.

#### `rebuild.positions`

Triggers state rebuild or recovery.

#### `recompute.risk.full`

Triggers full risk recomputation.

### 8.2 Task payload example

```json
{
  "taskId": "TASK-4001",
  "taskType": "portfolio.full_revalue",
  "portfolioId": "PF-001",
  "requestedAt": "2026-03-21T10:00:00Z"
}
```

---

## 9. Database design

Below is the recommended prototype relational model for `helix-store`.

### 9.1 Core tables

#### `portfolio`

| Column       | Type     | Notes                |
| ------------ | -------- | -------------------- |
| portfolio_id | TEXT PK  | Portfolio identifier |
| name         | TEXT     | Portfolio name       |
| status       | TEXT     | active/inactive      |
| created_at   | DATETIME | Creation timestamp   |

#### `trade`

| Column          | Type          | Notes                                      |
| --------------- | ------------- | ------------------------------------------ |
| trade_id        | TEXT PK       | Trade identifier                           |
| portfolio_id    | TEXT FK       | References portfolio                       |
| position_id     | TEXT nullable | Resolved position bucket identifier        |
| instrument_id   | TEXT          | Instrument identifier                      |
| instrument_name | TEXT          | Denormalized instrument name               |
| asset_class     | TEXT          | Equity / FX / Rates / Commodity / etc      |
| currency        | TEXT          | Trade currency                             |
| side            | TEXT          | BUY/SELL                                   |
| quantity        | REAL          | Trade quantity                             |
| price           | REAL          | Trade price                                |
| notional        | REAL          | Trade notional                             |
| trade_date      | DATE          | Trade date                                 |
| settlement_date | DATE nullable | Settlement date                            |
| strategy        | TEXT nullable | Strategy classification                    |
| book            | TEXT nullable | Book identifier                            |
| desk            | TEXT nullable | Trading desk                               |
| status          | TEXT          | pending/accepted/rejected/processed/failed |
| version         | INTEGER       | For amendments                             |
| parent_trade_id | TEXT nullable | Original trade reference                   |
| created_at      | DATETIME      | Insert time                                |
| updated_at      | DATETIME      | Last update time                           |

#### `position_snapshot`

| Column              | Type          | Notes                                            |
| ------------------- | ------------- | ------------------------------------------------ |
| snapshot_id         | TEXT PK       | Snapshot identifier                              |
| portfolio_id        | TEXT FK       | Portfolio                                        |
| position_id         | TEXT          | Position bucket identifier                       |
| instrument_id       | TEXT          | Instrument                                       |
| instrument_name     | TEXT          | Denormalized instrument name                     |
| asset_class         | TEXT          | Equity / FX / Rates / Commodity / etc           |
| currency            | TEXT          | Position currency                                |
| quantity            | REAL          | Net position quantity                            |
| direction           | TEXT          | LONG / SHORT                                     |
| average_cost        | REAL          | Average cost / average price                     |
| trade_date          | DATE          | Position open date or earliest contributing trade |
| last_update_ts      | DATETIME      | Latest trade-driven position update              |
| market_price        | REAL nullable | Latest market price                              |
| market_data_ts      | DATETIME nullable | Timestamp of market price snapshot          |
| fx_rate             | REAL nullable | FX rate into portfolio base currency             |
| notional            | REAL nullable | Position notional / market value                 |
| sector              | TEXT nullable | Sector classification                            |
| region              | TEXT nullable | Region classification                            |
| strategy            | TEXT nullable | Strategy / book classification                   |
| desk                | TEXT nullable | Trading desk                                     |
| as_of_ts            | DATETIME      | Snapshot timestamp                               |
| source_event_id     | TEXT nullable | Traceability                                     |

#### `market_data_snapshot`

| Column        | Type     | Notes                 |
| ------------- | -------- | --------------------- |
| snapshot_id   | TEXT PK  | Snapshot identifier   |
| instrument_id | TEXT     | Instrument            |
| field_name    | TEXT     | price/vol/rate/etc    |
| field_value   | REAL     | Value                 |
| as_of_ts      | DATETIME | Market data timestamp |
| source        | TEXT     | Feed source           |

#### `pnl_snapshot`

| Column               | Type     | Notes                 |
| -------------------- | -------- | --------------------- |
| snapshot_id          | TEXT PK  | Snapshot identifier   |
| portfolio_id         | TEXT FK  | Portfolio             |
| total_pnl            | REAL     | P&L value             |
| realized_pnl         | REAL     | Realized P&L          |
| unrealized_pnl       | REAL     | Unrealized P&L        |
| valuation_ts         | DATETIME | Valuation timestamp   |
| market_data_as_of_ts | DATETIME | Market data timestamp |
| position_as_of_ts    | DATETIME | Position timestamp    |

#### `risk_snapshot`

| Column               | Type          | Notes                 |
| -------------------- | ------------- | --------------------- |
| snapshot_id          | TEXT PK       | Snapshot identifier   |
| portfolio_id         | TEXT FK       | Portfolio             |
| delta                | REAL          | Example metric        |
| gamma                | REAL nullable | Example metric        |
| var_95               | REAL nullable | Example metric        |
| stress_loss          | REAL nullable | Example metric        |
| valuation_ts         | DATETIME      | Valuation timestamp   |
| market_data_as_of_ts | DATETIME      | Market data timestamp |
| position_as_of_ts    | DATETIME      | Position timestamp    |

### 9.2 Scenario tables

#### `scenario_run`

| Column       | Type     | Notes               |
| ------------ | -------- | ------------------- |
| scenario_id  | TEXT PK  | Scenario identifier |
| portfolio_id | TEXT FK  | Base portfolio      |
| name         | TEXT     | Scenario name       |
| persisted    | INTEGER  | 0/1                 |
| created_by   | TEXT     | User                |
| created_at   | DATETIME | Timestamp           |

#### `scenario_position`

| Column        | Type    | Notes                 |
| ------------- | ------- | --------------------- |
| scenario_id   | TEXT FK | Scenario              |
| instrument_id | TEXT    | Instrument            |
| quantity      | REAL    | Hypothetical quantity |

#### `scenario_result`

| Column                | Type     | Notes                  |
| --------------------- | -------- | ---------------------- |
| scenario_id           | TEXT FK  | Scenario               |
| value                 | REAL     | Scenario value         |
| pnl                   | REAL     | Scenario P&L           |
| risk_json             | TEXT     | Serialized risk result |
| compared_to_live_json | TEXT     | Comparison payload     |
| valuation_ts          | DATETIME | Timestamp              |

### 9.3 Reporting and operations tables

#### `report`

| Column       | Type     | Notes                 |
| ------------ | -------- | --------------------- |
| report_id    | TEXT PK  | Report identifier     |
| portfolio_id | TEXT FK  | Portfolio             |
| report_type  | TEXT     | intraday/eod/risk/etc |
| storage_path | TEXT     | Location/path         |
| generated_at | DATETIME | Timestamp             |
| status       | TEXT     | generated/failed      |

#### `alert`

| Column      | Type     | Notes                          |
| ----------- | -------- | ------------------------------ |
| alert_id    | TEXT PK  | Alert identifier               |
| severity    | TEXT     | info/warn/error                |
| category    | TEXT     | stale-data/pricing-failure/etc |
| message     | TEXT     | Human-readable message         |
| entity_type | TEXT     | trade/marketdata/portfolio/job |
| entity_id   | TEXT     | Related object                 |
| status      | TEXT     | open/closed                    |
| created_at  | DATETIME | Timestamp                      |

#### `audit_log`

| Column       | Type     | Notes                                |
| ------------ | -------- | ------------------------------------ |
| audit_id     | TEXT PK  | Audit identifier                     |
| event_type   | TEXT     | request_received/event_published/etc |
| entity_type  | TEXT     | trade/job/scenario/etc               |
| entity_id    | TEXT     | Related entity                       |
| payload_json | TEXT     | Serialized metadata                  |
| created_at   | DATETIME | Timestamp                            |

---

## 10. Trade lifecycle model

Trade lifecycle statuses:

- `pending`
- `accepted`
- `rejected`
- `processed`
- `failed`

### Design intent

A trade must always have a visible state so the user can understand whether:

- the request was accepted
- downstream processing completed
- processing failed
- correction is required

---

## 11. Sequence diagrams

### 11.1 Morning dashboard load

```text
PM -> helix-web: Open dashboard
helix-web -> helix-rest: GET /api/dashboard
helix-rest -> helix-store: Read latest positions, pnl, risk, reports, market data, alerts
helix-store -> helix-rest: Return persisted state
helix-rest -> helix-web: Consolidated dashboard payload
helix-web -> PM: Render dashboard with freshness timestamps
```

### 11.2 What-if valuation

```text
PM -> helix-web: Edit hypothetical portfolio
helix-web -> helix-rest: POST /api/scenarios/value
helix-rest -> helix-core: Calculate scenario valuation, pnl, risk
helix-core -> helix-rest: Return results
helix-rest -> helix-web: Scenario result
helix-web -> PM: Display scenario vs live comparison
```

### 11.3 New live trade

```text
Trader -> helix-web: Enter trade
helix-web -> helix-rest: POST /api/trades
helix-rest -> helix-store: Persist accepted trade record
helix-rest -> Kafka: Publish trade.created
helix-rest -> helix-web: Immediate accepted response

Kafka -> helix-runtime: Consume trade.created
helix-runtime -> helix-core: Reprice affected portfolio, recompute risk
helix-core -> helix-runtime: Return analytics
helix-runtime -> helix-store: Update positions, pnl snapshot, risk snapshot, trade status
helix-runtime -> Kafka: Publish portfolio.updated / pnl.updated / risk.updated

Kafka -> helix-rest: Update notification
helix-rest -> helix-web: Push update via WebSocket/SSE
helix-web -> Trader: Refresh blotter, positions, pnl, risk
```

### 11.4 Trade amendment

```text
Trader -> helix-web: Amend trade
helix-web -> helix-rest: POST /api/trades/{tradeId}/amend
helix-rest -> helix-store: Persist amendment request/version
helix-rest -> Kafka: Publish trade.amended
helix-rest -> helix-web: Accepted response

Kafka -> helix-runtime: Consume trade.amended
helix-runtime -> helix-core: Recalculate impacted portfolio
helix-runtime -> helix-store: Persist updated snapshots and trade status
helix-runtime -> Kafka: Publish update events
helix-rest -> helix-web: Push update
```

### 11.5 Trade cancellation

```text
Trader -> helix-web: Cancel trade
helix-web -> helix-rest: POST /api/trades/{tradeId}/cancel
helix-rest -> helix-store: Persist cancellation request
helix-rest -> Kafka: Publish trade.cancelled
helix-rest -> helix-web: Accepted response

Kafka -> helix-runtime: Consume trade.cancelled
helix-runtime -> helix-core: Recompute impacted portfolio
helix-runtime -> helix-store: Persist updated positions, pnl, risk, status
helix-runtime -> Kafka: Publish update events
helix-rest -> helix-web: Push update
```

### 11.6 Market data update

```text
Feed Simulator -> Kafka: Publish marketdata.updated
Kafka -> helix-runtime: Consume marketdata.updated
helix-runtime -> helix-store: Persist new market data snapshot
helix-runtime -> helix-core: Reprice affected instruments / portfolios
helix-core -> helix-runtime: Return updated analytics
helix-runtime -> helix-store: Persist pnl/risk/derived updates
helix-runtime -> Kafka: Publish portfolio.updated / pnl.updated / risk.updated
helix-rest -> helix-web: Push update
helix-web -> User: Refresh market data, pnl, risk, portfolio views
```

### 11.7 Hourly full revaluation and report generation

```text
Scheduler -> RabbitMQ: Submit portfolio.full_revalue
Scheduler -> RabbitMQ: Submit report.generate

RabbitMQ -> helix-runtime: Consume full revalue task
helix-runtime -> helix-store: Load latest positions and market data
helix-runtime -> helix-core: Full-book valuation and risk recomputation
helix-runtime -> helix-store: Persist full snapshots

RabbitMQ -> helix-runtime: Consume report.generate task
helix-runtime -> helix-store: Persist generated report metadata/artifacts
helix-runtime -> Kafka: Publish report/portfolio update events
helix-rest -> helix-web: Push update
helix-web -> User: Show latest reports and refreshed snapshots
```

### 11.8 End-of-day reconciliation

```text
Scheduler -> RabbitMQ: Submit recompute.risk.full / portfolio.full_revalue
RabbitMQ -> helix-runtime: Consume tasks
helix-runtime -> helix-core: Full recomputation from persisted state
helix-runtime -> helix-store: Persist EOD snapshots
helix-runtime -> helix-store: Compare incremental vs full state
alt mismatch detected
    helix-runtime -> helix-store: Persist alert
    helix-runtime -> Kafka: Publish alert.created
end
helix-rest -> helix-web: Push alert/report updates
```

---

## 12. Dashboard design sections

The dashboard should expose these sections:

1. Portfolio Overview
2. P&L
3. Risk
4. Trade Entry / Trade Blotter
5. What-If / Scenario Valuation
6. Market Data
7. Reports
8. Alerts / Exceptions

Each displayed metric must show:

- valuation timestamp
- market data as-of timestamp
- position snapshot timestamp
- last successful update time

---

## 13. Error and exception model

The platform must support visible operational alerts for:

- failed trade processing
- invalid market data
- stale market data
- pricing failure
- missing reference data
- reconciliation mismatch
- delayed snapshot update

These should be persisted and displayed in the Alerts / Exceptions section, not only written to logs.

---

## 14. Recommended implementation order

### Phase 1

- dashboard reads
- positions / P&L / risk query APIs
- scenario valuation API
- SQLite schema
- synchronous use of `helix-core`

### Phase 2

- trade submission API
- Kafka events for trades
- `helix-runtime` consumption
- incremental recalculation
- trade blotter and status lifecycle

### Phase 3

- market data update ingestion
- push updates via WebSocket/SSE
- alerts and audit trail

### Phase 4

- RabbitMQ scheduled full revaluation
- report generation
- EOD reconciliation workflow

---

## 15. Final architectural summary

Helix is a layered front-office platform with:

- `helix-web` as presentation
- `helix-rest` as the single public API boundary
- `helix-core` as the analytics engine
- `helix-runtime` as the asynchronous processor
- `helix-store` as persisted system state
- Kafka for business event streaming
- RabbitMQ for scheduled and background tasks

This design gives:

- strong separation of concerns
- realistic front-office behavior
- explicit operational workflows
- credible interview-level system architecture
