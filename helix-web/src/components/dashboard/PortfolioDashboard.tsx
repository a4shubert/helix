"use client";

import { useState } from "react";
import { PortfolioPnLCard } from "@/components/dashboard/PortfolioPnLCard";
import { PortfolioPositionsTable } from "@/components/dashboard/PortfolioPositionsTable";
import { PortfolioRiskCard } from "@/components/dashboard/PortfolioRiskCard";
import { PortfolioSidebar } from "@/components/dashboard/PortfolioSidebar";
import { mockPortfolioDashboards, type MockPortfolioKey } from "@/lib/mock/portfolio";

export function PortfolioDashboard() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<MockPortfolioKey>("PF-001");
  const { portfolio, pnlMetrics, riskMetrics } = mockPortfolioDashboards[selectedPortfolio];
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

  return (
    <section className="flex h-full min-h-full w-full gap-6">
      <PortfolioSidebar
        portfolios={portfolioItems}
        selected={selectedPortfolio}
        onSelect={(key) => setSelectedPortfolio(key)}
      />
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
        <div className="shrink-0 grid gap-6 xl:grid-cols-2">
          <PortfolioPnLCard metrics={pnlMetrics} />
          <PortfolioRiskCard metrics={riskMetrics} />
        </div>
        <PortfolioPositionsTable portfolio={portfolio} />
      </div>
    </section>
  );
}
