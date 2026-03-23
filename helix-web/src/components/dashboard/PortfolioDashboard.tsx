"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  amendTrade,
  createTrade,
  deleteTrade,
  fetchMarketData,
  fetchPnl,
  fetchPortfolio,
  fetchPortfolios,
  fetchRisk,
  fetchTrades,
  getHelixApiUrl,
  requestPortfolioRecompute,
  type CreateTradeRequest,
  type PnlSnapshotResponse,
  type PortfolioListItem,
  type RiskSnapshotResponse,
} from "@/lib/api/helix";
import { PortfolioPositionsTable } from "@/components/dashboard/PortfolioPositionsTable";
import { PortfolioSidebar } from "@/components/dashboard/PortfolioSidebar";
import { PortfolioMarketDataTable } from "@/components/dashboard/PortfolioMarketDataTable";
import { PortfolioSummaryCard } from "@/components/dashboard/PortfolioSummaryCard";
import { PortfolioTradesTable } from "@/components/dashboard/PortfolioTradesTable";
import { FirmWidePnlCard } from "@/components/dashboard/FirmWidePnlCard";
import type { MarketDataRow, PortfolioResponse, PortfolioTrade } from "@/lib/api/types";

const SSE_REFRESH_INTERVAL_MS = 500;

const emptyPortfolio = (portfolioId: string): PortfolioResponse => ({
  portfolioId,
  asOf: "",
  positions: [],
});

type PortfolioUpdateEventPayload = {
  eventType: string;
  portfolioId: string;
  snapshotId: string;
  timestamp: string;
};

export function PortfolioDashboard() {
  const refreshInFlightRef = useRef(false);
  const pendingRefreshRef = useRef<{
    portfolioId: string;
    showLoading: boolean;
  } | null>(null);
  const selectedPortfolioRefreshTimerRef = useRef<number | null>(null);
  const pendingPnlPortfolioIdsRef = useRef<Set<string>>(new Set());
  const firmWideRefreshTimerRef = useRef<number | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const [portfolioItems, setPortfolioItems] = useState<PortfolioListItem[]>([]);
  const [collapsedCards, setCollapsedCards] = useState({
    summary: false,
    trades: true,
    position: false,
    marketData: true,
  });
  const [portfolioById, setPortfolioById] = useState<Record<string, PortfolioResponse>>({});
  const [tradesByPortfolio, setTradesByPortfolio] = useState<Record<string, PortfolioTrade[]>>({});
  const [pnlByPortfolio, setPnlByPortfolio] = useState<Record<string, PnlSnapshotResponse>>({});
  const [riskByPortfolio, setRiskByPortfolio] = useState<Record<string, RiskSnapshotResponse>>({});
  const [marketDataRows, setMarketDataRows] = useState<MarketDataRow[]>([]);
  const [marketDataAsOf, setMarketDataAsOf] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [recomputingPortfolio, setRecomputingPortfolio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portfolio = portfolioById[selectedPortfolio] ?? emptyPortfolio(selectedPortfolio);
  const pnlSnapshot = pnlByPortfolio[selectedPortfolio];
  const riskSnapshot = riskByPortfolio[selectedPortfolio];
  const pnlMetrics = pnlSnapshot?.metrics ?? [];
  const riskMetrics = riskSnapshot?.metrics ?? [];
  const portfolioTrades = tradesByPortfolio[selectedPortfolio] ?? [];
  const visibleMarketDataRows = marketDataRows.filter((row) =>
    portfolio.positions.some(
      (position) => position.instrumentId === row.instrumentId && position.quantity !== 0,
    ),
  );
  const firmWideTotalPnl = portfolioItems.reduce(
    (sum, item) => sum + (pnlByPortfolio[item.portfolioId]?.totalPnl ?? 0),
    0,
  );
  const firmWideValuationTimestamp = portfolioItems
    .map((item) => pnlByPortfolio[item.portfolioId]?.valuationTs)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort((left, right) => right.localeCompare(left))[0];
  const valuationTimestamp = pnlSnapshot?.valuationTs ?? riskSnapshot?.valuationTs;

  const refreshFirmWidePnl = useCallback(async () => {
    if (portfolioItems.length === 0) {
      return;
    }

    const snapshots = await Promise.all(
      portfolioItems.map(async (item) => ({
        portfolioId: item.portfolioId,
        snapshot: await fetchPnl(item.portfolioId),
      })),
    );

    startTransition(() => {
      setPnlByPortfolio((current) => ({
        ...current,
        ...Object.fromEntries(snapshots.map((entry) => [entry.portfolioId, entry.snapshot])),
      }));
    });
  }, [portfolioItems]);

  const refreshPortfolioPnl = useCallback(async (portfolioId: string) => {
    const pnlResponse = await fetchPnl(portfolioId);
    startTransition(() => {
      setPnlByPortfolio((current) => ({
        ...current,
        [portfolioId]: pnlResponse,
      }));
    });
  }, []);

  const refreshPortfolio = useCallback(async (
    portfolioId: string,
    options?: {
      showLoading?: boolean;
    },
  ) => {
    const showLoading = options?.showLoading ?? false;
    if (refreshInFlightRef.current) {
      pendingRefreshRef.current = { portfolioId, showLoading };
      return;
    }
    refreshInFlightRef.current = true;
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [portfolioResponse, tradesResponse, pnlResponse, riskResponse, marketDataResponse] = await Promise.all([
        fetchPortfolio(portfolioId),
        fetchTrades(portfolioId),
        fetchPnl(portfolioId),
        fetchRisk(portfolioId),
        fetchMarketData(),
      ]);

      startTransition(() => {
        setPortfolioById((current) => ({ ...current, [portfolioId]: portfolioResponse }));
        setTradesByPortfolio((current) => ({ ...current, [portfolioId]: tradesResponse.trades }));
        setPnlByPortfolio((current) => ({ ...current, [portfolioId]: pnlResponse }));
        setRiskByPortfolio((current) => ({ ...current, [portfolioId]: riskResponse }));
        setMarketDataRows(marketDataResponse.rows);
        setMarketDataAsOf(marketDataResponse.asOf);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio data.");
    } finally {
      refreshInFlightRef.current = false;
      if (showLoading) {
        setIsLoading(false);
      }
      const pending = pendingRefreshRef.current;
      if (pending) {
        pendingRefreshRef.current = null;
        void refreshPortfolio(pending.portfolioId, {
          showLoading: pending.showLoading,
        });
      }
    }
  }, []);

  const scheduleSelectedPortfolioRefresh = useCallback(() => {
    if (selectedPortfolioRefreshTimerRef.current !== null) {
      return;
    }
    selectedPortfolioRefreshTimerRef.current = window.setTimeout(() => {
      selectedPortfolioRefreshTimerRef.current = null;
      void refreshPortfolio(selectedPortfolio, { showLoading: false });
    }, SSE_REFRESH_INTERVAL_MS);
  }, [refreshPortfolio, selectedPortfolio]);

  const scheduleFirmWidePnlRefresh = useCallback((portfolioId: string) => {
    pendingPnlPortfolioIdsRef.current.add(portfolioId);
    if (firmWideRefreshTimerRef.current !== null) {
      return;
    }
    firmWideRefreshTimerRef.current = window.setTimeout(() => {
      const portfolioIds = Array.from(pendingPnlPortfolioIdsRef.current);
      pendingPnlPortfolioIdsRef.current.clear();
      firmWideRefreshTimerRef.current = null;
      portfolioIds.forEach((id) => {
        void refreshPortfolioPnl(id);
      });
    }, SSE_REFRESH_INTERVAL_MS);
  }, [refreshPortfolioPnl]);

  function toggleCard(card: keyof typeof collapsedCards) {
    setCollapsedCards((current) => ({
      ...current,
      [card]: !current[card],
    }));
  }

  function handleSelectPortfolio(portfolioId: string) {
    setCollapsedCards({
      summary: false,
      trades: true,
      position: false,
      marketData: true,
    });
    setSelectedPortfolio(portfolioId);
  }

  async function handleSaveTrade(trade: CreateTradeRequest, amendTradeId?: string) {
    if (amendTradeId) {
      await amendTrade(amendTradeId, trade);
    } else {
      await createTrade(trade);
    }
    await refreshPortfolio(selectedPortfolio, { showLoading: false });
  }

  async function handleDeleteTrade(tradeId: string) {
    await deleteTrade(tradeId);
    await refreshPortfolio(selectedPortfolio, { showLoading: false });
  }

  async function handleRecomputePortfolio(portfolioId: string) {
    setError(null);
    setRecomputingPortfolio(portfolioId);
    try {
      await requestPortfolioRecompute(portfolioId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue portfolio compute.");
    } finally {
      setRecomputingPortfolio((current) => (current === portfolioId ? null : current));
    }
  }

  useEffect(() => {
    let isCancelled = false;

    void fetchPortfolios()
      .then((items) => {
        if (isCancelled) {
          return;
        }
        setPortfolioItems(items);
        if (items.length === 0) {
          return;
        }

        setSelectedPortfolio((current) =>
            items.some((item) => item.portfolioId === current)
              ? current
            : items[0].portfolioId,
        );
      })
      .catch((err) => {
        if (isCancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load portfolios.");
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshPortfolio(selectedPortfolio, { showLoading: true });
  }, [selectedPortfolio, refreshPortfolio]);

  useEffect(() => {
    void refreshFirmWidePnl();
  }, [refreshFirmWidePnl]);

  useEffect(() => {
    const eventSource = new EventSource(
      `${getHelixApiUrl()}/api/events?portfolioId=${selectedPortfolio}`,
    );

    eventSource.addEventListener("position.updated", scheduleSelectedPortfolioRefresh);
    eventSource.addEventListener("position.pl.updated", scheduleSelectedPortfolioRefresh);
    eventSource.addEventListener("portfolio.risk.updated", scheduleSelectedPortfolioRefresh);
    eventSource.addEventListener("trade.deleted", scheduleSelectedPortfolioRefresh);
    eventSource.addEventListener("trade.updated", scheduleSelectedPortfolioRefresh);
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      if (selectedPortfolioRefreshTimerRef.current !== null) {
        window.clearTimeout(selectedPortfolioRefreshTimerRef.current);
        selectedPortfolioRefreshTimerRef.current = null;
      }
      eventSource.close();
    };
  }, [scheduleSelectedPortfolioRefresh, selectedPortfolio]);

  useEffect(() => {
    const eventSource = new EventSource(`${getHelixApiUrl()}/api/events`);

    const handlePortfolioPnlUpdated = (event: Event) => {
      const messageEvent = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(messageEvent.data) as PortfolioUpdateEventPayload;
        if (!payload.portfolioId) {
          return;
        }
        scheduleFirmWidePnlRefresh(payload.portfolioId);
      } catch {
      }
    };

    eventSource.addEventListener("portfolio.pl.updated", handlePortfolioPnlUpdated);
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      if (firmWideRefreshTimerRef.current !== null) {
        window.clearTimeout(firmWideRefreshTimerRef.current);
        firmWideRefreshTimerRef.current = null;
      }
      pendingPnlPortfolioIdsRef.current = new Set();
      eventSource.close();
    };
  }, [scheduleFirmWidePnlRefresh]);

  return (
    <section className="flex h-full min-h-full w-full gap-6">
      <PortfolioSidebar
        portfolios={portfolioItems.map((item) => ({
          key: item.portfolioId,
          label: item.name,
          description: item.portfolioId,
        }))}
        selected={selectedPortfolio}
        onSelect={handleSelectPortfolio}
        onRecompute={(key) => {
          void handleRecomputePortfolio(key);
        }}
        recomputingKey={recomputingPortfolio}
      />
      <div className="relative flex h-full min-h-0 flex-1 flex-col gap-4">
        {(isLoading || error) && (
          <div className="pointer-events-none absolute right-0 top-0 z-10 max-w-[28rem] rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/95 px-4 py-3 text-sm text-[color:var(--color-muted)] shadow-[0_12px_40px_rgba(2,6,23,0.35)] backdrop-blur-sm">
            {error ? `REST error: ${error}` : `Loading ${selectedPortfolio}...`}
          </div>
        )}
        <FirmWidePnlCard
          totalPnl={firmWideTotalPnl}
          valuationTimestamp={firmWideValuationTimestamp}
        />
        <PortfolioSummaryCard
          pnlMetrics={pnlMetrics}
          riskMetrics={riskMetrics}
          valuationTimestamp={valuationTimestamp}
          collapsed={collapsedCards.summary}
          onToggle={() => toggleCard("summary")}
        />
        <PortfolioTradesTable
          key={selectedPortfolio}
          portfolioId={selectedPortfolio}
          trades={portfolioTrades}
          collapsed={collapsedCards.trades}
          onToggle={() => toggleCard("trades")}
          onSaveTrade={handleSaveTrade}
          onDeleteTrade={handleDeleteTrade}
        />
        <PortfolioPositionsTable
          portfolio={portfolio}
          collapsed={collapsedCards.position}
          onToggle={() => toggleCard("position")}
        />
        <PortfolioMarketDataTable
          rows={visibleMarketDataRows}
          asOf={marketDataAsOf}
          collapsed={collapsedCards.marketData}
          onToggle={() => toggleCard("marketData")}
        />
      </div>
    </section>
  );
}
