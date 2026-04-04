import {
  DashboardMetricCard,
  type DashboardMetricCardRow,
} from "@/components/dashboard/base/dashboard-metric-card";
import { formatDecimal, formatSignedDecimal } from "@/lib/format/number";
import type { MetricValue } from "@/lib/types/dashboard";

export function Pnl({
  isExpanded = true,
  metrics,
}: Readonly<{
  isExpanded?: boolean;
  metrics: MetricValue[];
}>) {
  const realizedPnl =
    metrics.find((metric) => metric.metricKey === "realized_pnl")?.value ?? 0;
  const unrealizedPnl =
    metrics.find((metric) => metric.metricKey === "unrealized_pnl")?.value ?? 0;
  const totalPnl =
    metrics.find((metric) => metric.metricKey === "total_pnl")?.value ?? 0;
  const totalGrossExposure =
    metrics.find((metric) => metric.metricKey === "total_gross_exposure")?.value ?? 0;
  const netExposure =
    metrics.find((metric) => metric.metricKey === "net_exposure")?.value ?? 0;
  const valueAtRisk =
    metrics.find((metric) => metric.metricKey === "value_at_risk")?.value ?? 0;

  const metricRows: DashboardMetricCardRow[] = [
    {
      items: [
        {
          label: "Realized",
          value: formatSignedDecimal(realizedPnl),
          tone: realizedPnl >= 0 ? "positive" : "negative",
        },
        {
          label: "Unrealized",
          value: formatSignedDecimal(unrealizedPnl),
          tone: unrealizedPnl >= 0 ? "positive" : "negative",
        },
        {
          label: "Total",
          value: formatSignedDecimal(totalPnl),
          tone: totalPnl >= 0 ? "positive" : "negative",
          valueClassName: "text-[1.386rem] md:text-[1.584rem]",
        },
      ],
    },
    {
      items: [
        {
          label: "Gross Exposure",
          value: formatDecimal(totalGrossExposure),
          tone: totalGrossExposure >= 0 ? "positive" : "negative",
        },
        {
          label: "Net Exposure",
          value: formatSignedDecimal(netExposure),
          tone: netExposure >= 0 ? "positive" : "negative",
        },
        {
          label: "VaR",
          value: formatDecimal(valueAtRisk),
          tone: valueAtRisk >= 0 ? "positive" : "negative",
        },
      ],
    },
  ];

  return (
    <DashboardMetricCard
      title="P&L"
      isExpanded={isExpanded}
      headerClassName="md:pl-12"
      rows={metricRows}
    />
  );
}
