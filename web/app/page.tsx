import { DashboardView } from "@/components/dashboard/dashboard-view";
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
    <DashboardView
      mockedMarketData={mockedMarketData}
      mockedPnlMetrics={mockedPnlMetrics}
      mockedPnlTrend={mockedPnlTrend}
      mockedPositions={mockedPositions}
      mockedReturnMetrics={mockedReturnMetrics}
      mockedRiskMetrics={mockedRiskMetrics}
      mockedRiskAdjustedMetrics={mockedRiskAdjustedMetrics}
      mockedTrades={mockedTrades}
    />
  );
}
