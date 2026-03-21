import { mockPortfolioDashboard } from "@/lib/mock/portfolio";
import { PortfolioPnLCard } from "@/components/dashboard/PortfolioPnLCard";
import { PortfolioPositionsTable } from "@/components/dashboard/PortfolioPositionsTable";
import { PortfolioRiskCard } from "@/components/dashboard/PortfolioRiskCard";

export function PortfolioDashboard() {
  const { portfolio, pnlMetrics, riskMetrics } = mockPortfolioDashboard;

  return (
    <section className="flex h-full min-h-full w-full flex-col gap-6">
      <div className="shrink-0 grid gap-6 xl:grid-cols-2">
        <PortfolioPnLCard metrics={pnlMetrics} />
        <PortfolioRiskCard metrics={riskMetrics} />
      </div>
      <PortfolioPositionsTable portfolio={portfolio} />
    </section>
  );
}
