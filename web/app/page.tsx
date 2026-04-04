import { Trend } from "@/components/dashboard/cards/trend";
import { Risk } from "@/components/dashboard/cards/risk";
import { Trades } from "@/components/dashboard/cards/trades";
import { Pnl } from "@/components/dashboard/cards/pnl";
import { Market } from "@/components/dashboard/cards/market";
import { Position } from "@/components/dashboard/cards/position";
import {
  mockedMarketData,
  mockedPnlMetrics,
  mockedPnlTrend,
  mockedPositions,
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
        <Pnl
          totalPnl={mockedFirmWidePnl.totalPnl}
        />
        <Trend points={mockedPnlTrend} />
        <Risk
          pnlMetrics={mockedPnlMetrics}
          riskMetrics={mockedRiskMetrics}
        />
        <Position rows={mockedPositions} />
        <Trades portfolioId="PF-MOCK" initialTrades={mockedTrades} />
        <Market rows={mockedMarketData} />

      </div>
    </section>
  );
}
