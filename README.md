<h1>
  <img src="./logo.jpeg" alt="Helix logo" width="48" valign="middle" />
  <span>Helix</span>
</h1>

<h2> An event-driven platform where pricing, risk, and P&amp;L evolve together in a single consistent state. </h2>

## 1. Platform objective

Helix is a front-office portfolio valuation, P&L, and risk platform for portfolio managers and traders. It provides:

- current positions and portfolio state
- real-time and snapshot P&L
- risk metrics
- what-if / scenario valuation
- trade capture and lifecycle handling
- market data display
- scheduled full revaluation and reporting
- operational transparency through alerts, timestamps, and audit trail

The prototype must look and behave like a real institutional platform, not just a pricing library demo.

---

## 2. Final component model

### 2.1 `helix-core`

Analytical library and calculation engine.

**Responsibilities**

- instrument pricing
- portfolio valuation
- P&L calculation
- risk calculation
- scenario / what-if valuation
- incremental recalculation logic
- full revaluation logic

**Design choice**

- pure analytical component
- no HTTP exposure
- no persistence ownership
- called synchronously by `helix-rest` (what-if)
- called asynchronously by `helix-runtime` (live)

---

### 2.2 `helix-rest`

Synchronous application and API layer (single entry point).

**Responsibilities**

- authentication and authorization
- API exposure (dashboard, blotter, market data, reports, scenarios)
- validation of trades/amendments/cancellations
- persistence of accepted commands
- querying `helix-store`
- publishing Kafka events
- submitting RabbitMQ tasks
- WebSocket/SSE push to UI
- consistent read APIs

**Design choice**

- UI never talks to Kafka or RabbitMQ directly
- all UI traffic goes through `helix-rest`

---

### 2.3 `helix-runtime`

Asynchronous processing layer.

**Responsibilities**

- consume Kafka events
- process trade lifecycle
- process market data updates
- call `helix-core`
- update positions, P&L, risk
- publish update events
- execute RabbitMQ jobs
- persist outputs to `helix-store`

**Design choice**

- owns all live recalculation

---

### 2.4 `helix-store`

Persistence layer (SQLite for prototype).

**Stores**

- positions
- trades
- trade lifecycle/status
- market data snapshots
- P&L snapshots
- risk snapshots
- reports
- scenarios
- alerts/exceptions
- audit logs
- timestamps

---

### 2.5 `helix-web`

User interface.

**Responsibilities**

- dashboard
- trade blotter
- scenario analysis
- market data
- reports
- alerts

**Design choice**

- thin UI
- all state from `helix-rest`
- updates via push

---

## 3. Communication model

### 3.1 Synchronous

Used for:

- dashboard
- what-if
- queries

Flow:
