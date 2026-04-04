import { Trend } from "@/components/dashboard/cards/trend";
import { Risks } from "@/components/dashboard/cards/risks";
import { Trades } from "@/components/dashboard/cards/trades";
import { Pnl } from "@/components/dashboard/cards/pnl";
import { Market } from "@/components/dashboard/cards/market";
import { Position } from "@/components/dashboard/cards/position";
import {
  mockedMarketData,
  mockedPnlMetrics,
  mockedPnlTrend,
  mockedPositions,
  mockedReturnMetrics,
  mockedRiskMetrics,
  mockedRiskAdjustedMetrics,
  mockedTrades,
} from "@/lib/mock/dashboard";

export default function Home() {
  return (
    <section className="flex min-h-full items-start justify-center">
      <div className="flex w-full max-w-[1600px] flex-col gap-4 2xl:max-w-[2400px]">
        <Pnl
          metrics={mockedPnlMetrics}
        />
        <Trend points={mockedPnlTrend} />
        <Risks
          returnMetrics={mockedReturnMetrics}
          riskMetrics={mockedRiskMetrics}
          riskAdjustedMetrics={mockedRiskAdjustedMetrics}
        />
        <Position rows={mockedPositions} />
        <Trades portfolioId="PF-MOCK" initialTrades={mockedTrades} />
        <Market rows={mockedMarketData} />

      </div>
    </section>
  );
}
