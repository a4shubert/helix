PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portfolio (
  portfolio_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS instrument (
  instrument_id TEXT PRIMARY KEY,
  instrument_name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  currency TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS book (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS trades (
  trade_id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  position_id TEXT,
  instrument_id TEXT NOT NULL,
  instrument_name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  currency TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  notional REAL,
  trade_timestamp DATETIME NOT NULL,
  settlement_date DATE,
  book TEXT,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id)
);

CREATE TABLE IF NOT EXISTS position (
  snapshot_id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  position_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  instrument_name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  currency TEXT NOT NULL,
  quantity REAL NOT NULL,
  direction TEXT NOT NULL,
  average_cost REAL NOT NULL,
  last_update_ts DATETIME NOT NULL,
  market_price REAL,
  market_data_ts DATETIME,
  notional REAL,
  market_value REAL,
  book TEXT,
  as_of_ts DATETIME NOT NULL,
  source_event_id TEXT,
  FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id)
);

CREATE TABLE IF NOT EXISTS market_data (
  instrument_id TEXT PRIMARY KEY,
  price REAL NOT NULL,
  volatility REAL NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS pnl (
  snapshot_id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  total_pnl REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  valuation_ts DATETIME NOT NULL,
  market_data_as_of_ts DATETIME NOT NULL,
  position_as_of_ts DATETIME NOT NULL,
  FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id)
);

CREATE TABLE IF NOT EXISTS risk (
  snapshot_id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  delta REAL NOT NULL,
  gross_exposure REAL NOT NULL,
  net_exposure REAL NOT NULL,
  var_95 REAL,
  valuation_ts DATETIME NOT NULL,
  market_data_as_of_ts DATETIME NOT NULL,
  position_as_of_ts DATETIME NOT NULL,
  FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id)
);

CREATE TABLE IF NOT EXISTS audit (
  audit_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at DATETIME NOT NULL
);
