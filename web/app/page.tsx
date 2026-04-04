import { PnlTrendChartCard } from "@/components/dashboard/cards/pnl-trend-chart-card";
import { SummaryRiskCard } from "@/components/dashboard/cards/summary-risk-card";
import { TradesCard } from "@/components/dashboard/cards/trades-card";
import { FirmWidePnlCard } from "@/components/dashboard/cards/firm-wide-pnl-card";
import {
  mockedPnlMetrics,
  mockedPnlTrend,
  mockedRiskMetrics,
  mockedTrades,
} from "@/lib/mock/dashboard";

const mockedFirmWidePnl = {
  totalPnl: 18423671.42,
  valuationTimestamp: "2026-04-04T09:15:00Z",
};

export default function Home() {
  return (
    <section className="flex min-h-full items-start justify-center">
      <div className="flex w-full max-w-[1600px] flex-col gap-4 2xl:max-w-[2400px]">
        <FirmWidePnlCard
          totalPnl={mockedFirmWidePnl.totalPnl}
          valuationTimestamp={mockedFirmWidePnl.valuationTimestamp}
        />
        <SummaryRiskCard
          pnlMetrics={mockedPnlMetrics}
          riskMetrics={mockedRiskMetrics}
          valuationTimestamp="2026-04-04T17:26:35Z"
        />
        <TradesCard portfolioId="PF-MOCK" initialTrades={mockedTrades} />
        <PnlTrendChartCard points={mockedPnlTrend} />
      </div>
    </section>
  );
}
