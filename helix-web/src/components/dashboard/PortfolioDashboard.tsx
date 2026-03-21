"use client";

import { useState } from "react";
import { PortfolioPositionsTable } from "@/components/dashboard/PortfolioPositionsTable";
import { PortfolioSidebar } from "@/components/dashboard/PortfolioSidebar";
import { PortfolioSummaryCard } from "@/components/dashboard/PortfolioSummaryCard";
import { PortfolioTradesTable } from "@/components/dashboard/PortfolioTradesTable";
import { mockPortfolioDashboards, type MockPortfolioKey } from "@/lib/mock/portfolio";
import { mockTrades, type PortfolioTrade } from "@/lib/mock/trades";

export function PortfolioDashboard() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<MockPortfolioKey>("PF-001");
  const [collapsedCards, setCollapsedCards] = useState({
    summary: false,
    trades: false,
    position: false,
  });
  const [tradesByPortfolio, setTradesByPortfolio] = useState<Record<string, PortfolioTrade[]>>(() =>
    mockTrades.reduce<Record<string, PortfolioTrade[]>>((acc, trade) => {
      if (!acc[trade.portfolio_id]) {
        acc[trade.portfolio_id] = [];
      }
      acc[trade.portfolio_id].push(trade);
      return acc;
    }, {}),
  );
  const { portfolio, pnlMetrics, riskMetrics } = mockPortfolioDashboards[selectedPortfolio];
  const portfolioTrades = tradesByPortfolio[selectedPortfolio] ?? [];
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

  function toggleCard(card: keyof typeof collapsedCards) {
    setCollapsedCards((current) => ({
      ...current,
      [card]: !current[card],
    }));
  }

  function handleSaveTrade(trade: PortfolioTrade) {
    setTradesByPortfolio((current) => {
      const existing = current[trade.portfolio_id] ?? [];
      const index = existing.findIndex((item) => item.trade_id === trade.trade_id);

      if (index === -1) {
        return {
          ...current,
          [trade.portfolio_id]: [trade, ...existing],
        };
      }

      const next = [...existing];
      next[index] = trade;
      return {
        ...current,
        [trade.portfolio_id]: next,
      };
    });
  }

  return (
    <section className="flex h-full min-h-full w-full gap-6">
      <PortfolioSidebar
        portfolios={portfolioItems}
        selected={selectedPortfolio}
        onSelect={(key) => setSelectedPortfolio(key)}
      />
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
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
