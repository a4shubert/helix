"use client";

import { Market } from "@/components/dashboard/cards/market";
import { Pnl } from "@/components/dashboard/cards/pnl";
import { Position } from "@/components/dashboard/cards/position";
import { Risks } from "@/components/dashboard/cards/risks";
import { Trades } from "@/components/dashboard/cards/trades";
import { Trend } from "@/components/dashboard/cards/trend";
import { StrategySelector } from "@/components/dashboard/strategy-selector";
import { useStrategyContext } from "@/components/strategy-context";
import type {
  MarketDataRow,
  MetricValue,
  PnlTrendPoint,
  PositionRow,
  StrategyTrade,
} from "@/lib/types/dashboard";

export function DashboardView({
  mockedMarketData,
  mockedPnlMetrics,
  mockedPnlTrend,
  mockedPositions,
  mockedReturnMetrics,
  mockedRiskMetrics,
  mockedRiskAdjustedMetrics,
  mockedTrades,
}: Readonly<{
  mockedMarketData: MarketDataRow[];
  mockedPnlMetrics: MetricValue[];
  mockedPnlTrend: PnlTrendPoint[];
  mockedPositions: PositionRow[];
  mockedReturnMetrics: MetricValue[];
  mockedRiskMetrics: MetricValue[];
  mockedRiskAdjustedMetrics: MetricValue[];
  mockedTrades: StrategyTrade[];
}>) {
  const { selectedStrategy, setSelectedStrategy } = useStrategyContext();

  return (
    <section className="flex min-h-full items-start justify-center">
      <div className="flex w-full max-w-[1600px] flex-col gap-8 2xl:max-w-[2400px]">
        <div className="flex flex-col gap-8">
          <StrategySelector
            selectedStrategy={selectedStrategy}
            onSelect={setSelectedStrategy}
          />
          <div className="flex flex-col gap-4">
            <Pnl metrics={mockedPnlMetrics} />
            <Trend points={mockedPnlTrend} />
            <Risks
              returnMetrics={mockedReturnMetrics}
              riskMetrics={mockedRiskMetrics}
              riskAdjustedMetrics={mockedRiskAdjustedMetrics}
            />
            <Position rows={mockedPositions} />
            <Trades strategyId="STRAT-MOCK" initialTrades={mockedTrades} />
            <Market rows={mockedMarketData} />
          </div>
        </div>
      </div>
    </section>
  );
}
