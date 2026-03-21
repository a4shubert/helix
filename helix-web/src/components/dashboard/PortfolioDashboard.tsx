"use client";

import { startTransition, useEffect, useState } from "react";
import {
  amendTrade,
  createTrade,
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
import type { MarketDataRow, PortfolioResponse, PortfolioTrade } from "@/lib/api/types";

const emptyPortfolio = (portfolioId: string): PortfolioResponse => ({
  portfolioId,
  asOf: "",
  positions: [],
});

export function PortfolioDashboard() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("PF-EQ");
  const [portfolioItems, setPortfolioItems] = useState<PortfolioListItem[]>([]);
  const [collapsedCards, setCollapsedCards] = useState({
    summary: false,
    trades: false,
    position: false,
    marketData: false,
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
  const valuationTimestamp = pnlSnapshot?.valuationTs ?? riskSnapshot?.valuationTs;

  async function refreshPortfolio(
    portfolioId: string,
    options?: {
      showLoading?: boolean;
    },
  ) {
    const showLoading = options?.showLoading ?? false;
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
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  function toggleCard(card: keyof typeof collapsedCards) {
    setCollapsedCards((current) => ({
      ...current,
      [card]: !current[card],
    }));
  }

  async function handleSaveTrade(trade: CreateTradeRequest, amendTradeId?: string) {
    if (amendTradeId) {
      await amendTrade(amendTradeId, trade);
    } else {
      await createTrade(trade);
    }
    await refreshPortfolio(selectedPortfolio, { showLoading: false });
  }

  async function handleRecomputePortfolio(portfolioId: string) {
    setError(null);
    setRecomputingPortfolio(portfolioId);
    try {
      await requestPortfolioRecompute(portfolioId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue portfolio recompute.");
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
  }, [selectedPortfolio]);

  useEffect(() => {
    const eventSource = new EventSource(
      `${getHelixApiUrl()}/api/events?portfolioId=${selectedPortfolio}`,
    );

    const refresh = () => {
      void refreshPortfolio(selectedPortfolio, { showLoading: false });
    };

    eventSource.addEventListener("positions.updated", refresh);
    eventSource.addEventListener("pl.updated", refresh);
    eventSource.addEventListener("risk.updated", refresh);
    eventSource.addEventListener("trade.updated", refresh);
    eventSource.addEventListener("marketdata.updated", refresh);
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [selectedPortfolio]);

  return (
    <section className="flex h-full min-h-full w-full gap-6">
      <PortfolioSidebar
        portfolios={portfolioItems.map((item) => ({
          key: item.portfolioId,
          label: item.name,
          description: item.portfolioId,
        }))}
        selected={selectedPortfolio}
        onSelect={(key) => setSelectedPortfolio(key)}
        onRecompute={(key) => {
          void handleRecomputePortfolio(key);
        }}
        recomputingKey={recomputingPortfolio}
      />
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
        {(isLoading || error) && (
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
            {error ? `REST error: ${error}` : `Loading ${selectedPortfolio}...`}
          </div>
        )}
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
        />
        <PortfolioPositionsTable
          portfolio={portfolio}
          collapsed={collapsedCards.position}
          onToggle={() => toggleCard("position")}
        />
        <PortfolioMarketDataTable
          rows={marketDataRows}
          asOf={marketDataAsOf}
          collapsed={collapsedCards.marketData}
          onToggle={() => toggleCard("marketData")}
        />
      </div>
    </section>
  );
}
