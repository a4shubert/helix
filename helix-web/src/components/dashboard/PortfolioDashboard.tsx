"use client";

import { startTransition, useEffect, useState } from "react";
import {
  createTrade,
  fetchPnl,
  fetchPortfolio,
  fetchRisk,
  fetchTrades,
  getHelixApiUrl,
  type CreateTradeRequest,
  type PnlSnapshotResponse,
  type RiskSnapshotResponse,
} from "@/lib/api/helix";
import { PortfolioPositionsTable } from "@/components/dashboard/PortfolioPositionsTable";
import { PortfolioSidebar } from "@/components/dashboard/PortfolioSidebar";
import { PortfolioSummaryCard } from "@/components/dashboard/PortfolioSummaryCard";
import { PortfolioTradesTable } from "@/components/dashboard/PortfolioTradesTable";
import type { MetricValue, PortfolioResponse } from "@/lib/mock/portfolio";
import type { PortfolioTrade } from "@/lib/mock/trades";

type MockPortfolioKey = "PF-001" | "PF-002" | "PF-003";

const emptyPortfolio = (portfolioId: string): PortfolioResponse => ({
  portfolioId,
  asOf: "",
  positions: [],
});

function buildPnlMetrics(snapshot?: PnlSnapshotResponse): MetricValue[] {
  if (!snapshot) {
    return [];
  }

  return [
    { label: "Total P&L", value: snapshot.totalPnl },
    { label: "Realized P&L", value: snapshot.realizedPnl },
    { label: "Unrealized P&L", value: snapshot.unrealizedPnl },
  ];
}

function buildRiskMetrics(snapshot?: RiskSnapshotResponse): MetricValue[] {
  if (!snapshot) {
    return [];
  }

  return [
    { label: "Delta", value: snapshot.delta },
    { label: "Gamma", value: snapshot.gamma ?? 0 },
    { label: "VaR 95", value: snapshot.var95 ?? 0 },
    { label: "Stress Loss", value: snapshot.stressLoss ?? 0 },
  ];
}

export function PortfolioDashboard() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<MockPortfolioKey>("PF-001");
  const [collapsedCards, setCollapsedCards] = useState({
    summary: false,
    trades: false,
    position: false,
  });
  const [portfolioById, setPortfolioById] = useState<Record<string, PortfolioResponse>>({});
  const [tradesByPortfolio, setTradesByPortfolio] = useState<Record<string, PortfolioTrade[]>>({});
  const [pnlByPortfolio, setPnlByPortfolio] = useState<Record<string, PnlSnapshotResponse>>({});
  const [riskByPortfolio, setRiskByPortfolio] = useState<Record<string, RiskSnapshotResponse>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const portfolioItems = [
    {
      key: "PF-001",
      label: "Global Macro Core",
      description: "PF-001",
    },
    {
      key: "PF-002",
      label: "Equity Long/Short (Tech Focus)",
      description: "PF-002",
    },
    {
      key: "PF-003",
      label: "Emerging Markets & Credit",
      description: "PF-003",
    },
  ] as const;
  const portfolio = portfolioById[selectedPortfolio] ?? emptyPortfolio(selectedPortfolio);
  const pnlMetrics = buildPnlMetrics(pnlByPortfolio[selectedPortfolio]);
  const riskMetrics = buildRiskMetrics(riskByPortfolio[selectedPortfolio]);
  const portfolioTrades = tradesByPortfolio[selectedPortfolio] ?? [];

  async function refreshPortfolio(portfolioId: MockPortfolioKey) {
    setIsLoading(true);
    setError(null);

    try {
      const [portfolioResponse, tradesResponse, pnlResponse, riskResponse] = await Promise.all([
        fetchPortfolio(portfolioId),
        fetchTrades(portfolioId),
        fetchPnl(portfolioId),
        fetchRisk(portfolioId),
      ]);

      startTransition(() => {
        setPortfolioById((current) => ({ ...current, [portfolioId]: portfolioResponse }));
        setTradesByPortfolio((current) => ({ ...current, [portfolioId]: tradesResponse.trades }));
        setPnlByPortfolio((current) => ({ ...current, [portfolioId]: pnlResponse }));
        setRiskByPortfolio((current) => ({ ...current, [portfolioId]: riskResponse }));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio data.");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleCard(card: keyof typeof collapsedCards) {
    setCollapsedCards((current) => ({
      ...current,
      [card]: !current[card],
    }));
  }

  async function handleSaveTrade(trade: CreateTradeRequest) {
    await createTrade(trade);
    await refreshPortfolio(selectedPortfolio);
  }

  useEffect(() => {
    void refreshPortfolio(selectedPortfolio);
  }, [selectedPortfolio]);

  useEffect(() => {
    const eventSource = new EventSource(
      `${getHelixApiUrl()}/api/events?portfolioId=${selectedPortfolio}`,
    );

    const refresh = () => {
      void refreshPortfolio(selectedPortfolio);
    };

    eventSource.addEventListener("portfolio.updated", refresh);
    eventSource.addEventListener("pnl.updated", refresh);
    eventSource.addEventListener("risk.updated", refresh);
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
        portfolios={portfolioItems}
        selected={selectedPortfolio}
        onSelect={(key) => setSelectedPortfolio(key)}
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
      </div>
    </section>
  );
}
