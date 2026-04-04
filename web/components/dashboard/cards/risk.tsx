"use client";

import { useState } from "react";
import { DashboardCardShell } from "@/components/dashboard/base/dashboard-card-shell";
import { formatSignedDecimal } from "@/lib/format/number";
import type { MetricValue } from "@/lib/types/dashboard";

function MetricsTable({ metrics }: Readonly<{ metrics: MetricValue[] }>) {
  return (
    <table className="w-full border-separate border-spacing-0">
      <tbody>
        {metrics.map((metric) => (
          <tr key={metric.metricKey}>
            <td className="border-b border-white/6 px-4 py-3 text-center text-sm text-white md:text-base last:border-b-0">
              {metric.label}
            </td>
            <td
              className={[
                "border-b border-white/6 px-4 py-3 text-center text-sm font-medium tabular-nums md:text-base last:border-b-0",
                metric.value >= 0
                  ? "text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]"
                  : "text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]",
              ].join(" ")}
            >
              {formatSignedDecimal(metric.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Risk({
  pnlMetrics,
  riskMetrics,
  isExpanded = false,
}: Readonly<{
  pnlMetrics: MetricValue[];
  riskMetrics: MetricValue[];
  isExpanded?: boolean;
}>) {
  const [collapsed, setCollapsed] = useState(!isExpanded);
  const totalPnl =
    pnlMetrics.find((metric) => metric.isPrimary)?.value ?? pnlMetrics[0]?.value ?? 0;

  return (
    <DashboardCardShell
      title="Risk"
      collapsed={collapsed}
      collapsedValue={formatSignedDecimal(totalPnl)}
      collapsedValuePositive={totalPnl >= 0}
      collapsedValueAlignRight
      onToggle={() => setCollapsed((value) => !value)}
    >
      <div className="mt-4 w-full">
        <div className="grid w-full gap-8 xl:grid-cols-2">
          <MetricsTable metrics={pnlMetrics} />
          <MetricsTable metrics={riskMetrics} />
        </div>
      </div>
    </DashboardCardShell>
  );
}
