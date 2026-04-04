import type {
  MarketDataResponse,
  PnlSnapshotResponse,
  PortfolioListItem,
  PortfolioResponse,
  RiskSnapshotResponse,
  TradesResponse,
} from "@/lib/api/types";

export type { PnlSnapshotResponse, PortfolioListItem, RiskSnapshotResponse } from "@/lib/api/types";

export type CreateTradeRequest = {
  portfolioId: string;
  instrumentId: string;
  side: string;
  quantity: number;
  price: number;
  settlementDate: string | null;
  book?: string;
  version?: number;
};

export type TradeFormInstrumentOption = {
  instrumentId: string;
  instrumentName: string;
  assetClass: string;
  currency: string;
  marketPrice: number | null;
};

export type TradeFormOptionsResponse = {
  assetClasses: string[];
  instruments: TradeFormInstrumentOption[];
  books: string[];
};

type ErrorPayload = {
  message?: string;
};

function getBrowserApiUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:5057";
  }

  return `${window.location.protocol}//${window.location.hostname}:5057`;
}

export function getHelixApiUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_HELIX_API_URL?.trim();
  return explicitUrl && explicitUrl.length > 0 ? explicitUrl : getBrowserApiUrl();
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getHelixApiUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as ErrorPayload;
      if (payload.message) {
        message = payload.message;
      }
    } catch {
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function fetchPortfolios(): Promise<PortfolioListItem[]> {
  return requestJson<PortfolioListItem[]>("/api/portfolios");
}

export function fetchPortfolio(portfolioId: string): Promise<PortfolioResponse> {
  return requestJson<PortfolioResponse>(`/api/portfolio?portfolioId=${encodeURIComponent(portfolioId)}`);
}

export function fetchTrades(portfolioId: string): Promise<TradesResponse> {
  return requestJson<TradesResponse>(`/api/trades?portfolioId=${encodeURIComponent(portfolioId)}`);
}

export function fetchPnl(portfolioId: string): Promise<PnlSnapshotResponse> {
  return requestJson<PnlSnapshotResponse>(`/api/pnl?portfolioId=${encodeURIComponent(portfolioId)}`);
}

export function fetchRisk(portfolioId: string): Promise<RiskSnapshotResponse> {
  return requestJson<RiskSnapshotResponse>(`/api/risk?portfolioId=${encodeURIComponent(portfolioId)}`);
}

export function fetchMarketData(): Promise<MarketDataResponse> {
  return requestJson<MarketDataResponse>("/api/market-data");
}

export function fetchTradeFormOptions(): Promise<TradeFormOptionsResponse> {
  return requestJson<TradeFormOptionsResponse>("/api/trade-form-options");
}

export function createTrade(request: CreateTradeRequest): Promise<{ tradeId: string }> {
  return requestJson<{ tradeId: string }>("/api/trades", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function amendTrade(tradeId: string, request: CreateTradeRequest): Promise<{ tradeId: string }> {
  return requestJson<{ tradeId: string }>(`/api/trades/${encodeURIComponent(tradeId)}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function deleteTrade(tradeId: string): Promise<void> {
  return requestJson<void>(`/api/trades/${encodeURIComponent(tradeId)}`, {
    method: "DELETE",
  });
}

export function requestPortfolioRecompute(
  portfolioId: string,
): Promise<{ portfolioId: string; status: string }> {
  return requestJson<{ portfolioId: string; status: string }>(
    `/api/portfolios/${encodeURIComponent(portfolioId)}/recompute`,
    {
      method: "POST",
    },
  );
}
