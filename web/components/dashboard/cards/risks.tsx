"use client";

import { useState } from "react";
import { DashboardCardShell } from "@/components/dashboard/base/dashboard-card-shell";
import { formatDecimal } from "@/lib/format/number";
import type { MetricValue } from "@/lib/types/dashboard";

function MetricsTable({
  title,
  metrics,
}: Readonly<{
  title: string;
  metrics: MetricValue[];
}>) {
  return (
    <div className="w-full">
      <div className="mb-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--color-accent)] md:text-base">
        {title}
      </div>
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
                  "text-white",
                ].join(" ")}
              >
                {formatDecimal(metric.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Risks({
  returnMetrics,
  riskMetrics,
  riskAdjustedMetrics,
  isExpanded = false,
}: Readonly<{
  returnMetrics: MetricValue[];
  riskMetrics: MetricValue[];
  riskAdjustedMetrics: MetricValue[];
  isExpanded?: boolean;
}>) {
  const [collapsed, setCollapsed] = useState(!isExpanded);

  return (
    <DashboardCardShell
      title="Risks"
      collapsed={collapsed}
      onToggle={() => setCollapsed((value) => !value)}
    >
      <div className="mt-4 w-full">
        <div className="grid w-full gap-8 xl:grid-cols-3">
          <MetricsTable title="Return Metrics" metrics={returnMetrics} />
          <MetricsTable title="Risk Metrics" metrics={riskMetrics} />
          <MetricsTable title="Risk-Adjusted Performance" metrics={riskAdjustedMetrics} />
        </div>
      </div>
    </DashboardCardShell>
  );
}
