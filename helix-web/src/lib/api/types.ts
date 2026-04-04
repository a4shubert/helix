export type MetricValue = {
  metricKey: string;
  label: string;
  value: number;
  isPrimary: boolean;
};

export type PortfolioListItem = {
  portfolioId: string;
  name: string;
  status: string;
  createdAt: string;
};

export type PortfolioPosition = {
  portfolioId: string;
  positionId: string;
  instrumentId: string;
  instrumentName: string;
  assetClass: string;
  currency: string;
  quantity: number;
  direction: "LONG" | "SHORT";
  averageCost: number;
  lastUpdateTs: string;
  marketPrice: number;
  marketDataTs: string;
  notional: number;
  marketValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  book: string;
};

export type PortfolioResponse = {
  portfolioId: string;
  name?: string;
  status?: string;
  createdAt?: string;
  asOf?: string | null;
  positions: PortfolioPosition[];
};

export type PortfolioTrade = {
  trade_id: string;
  portfolio_id: string;
  position_id: string;
  instrument_id: string;
  instrument_name: string;
  asset_class: string;
  currency: string;
  side: string;
  quantity: number;
  price: number;
  notional: number | null;
  trade_timestamp: string;
  settlement_date: string;
  book: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type TradesResponse = {
  portfolioId: string;
  count: number;
  trades: PortfolioTrade[];
};

export type MarketDataRow = {
  instrumentId: string;
  instrumentName: string;
  assetClass: string;
  currency: string;
  price: number | null;
  volatility: number | null;
  updatedAt: string;
};

export type MarketDataResponse = {
  asOf: string;
  count: number;
  rows: MarketDataRow[];
};

export type PnlSnapshotResponse = {
  snapshotId: string;
  portfolioId: string;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  valuationTs: string;
  marketDataAsOfTs: string;
  positionAsOfTs: string;
  metrics: MetricValue[];
};

export type RiskSnapshotResponse = {
  snapshotId: string;
  portfolioId: string;
  delta: number;
  grossExposure: number;
  netExposure: number;
  var95: number;
  valuationTs: string;
  marketDataAsOfTs: string;
  positionAsOfTs: string;
  metrics: MetricValue[];
};
