# Helix

Helix is a front-office portfolio analytics platform that delivers real-time positions, P&L, and risk by combining a web interface, a REST orchestration layer, a core analytics engine, and an asynchronous runtime for event-driven processing. It supports full trading workflows—trade capture, market data updates, and scenario analysis—while separating live and hypothetical state, ensuring consistency through persistent storage and incremental plus scheduled recalculations. By leveraging Kafka for real-time events and RabbitMQ for background tasks, Helix provides a scalable, transparent, and institution-grade system for portfolio valuation, risk management, and decision support.

---

## Package Map

- `helix-web` (Next.js + AG Grid)
- `helix-rest` (.NET 10 minimal API)
- `helix-runtime` (Python RabbitMQ worker)
- `helix-core` (Python analytics library)
- `helix-store` (SQLite schema + seed tooling)

---

## Installation

---

## Flow

## ![Current Architecture](docs/architecture.svg)

---

## Components

### helix-web (next.js)

### helix-rest (asp\.net | ef.core )

### helix-runtime (python)

### helix-core (python)

### helix-store (sqlLite db)
