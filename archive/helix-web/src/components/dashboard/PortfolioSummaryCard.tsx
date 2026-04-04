import { DashboardCardShell } from "@/components/dashboard/DashboardCardShell";
import { formatSignedDecimal } from "@/lib/format/number";
import type { MetricValue } from "@/lib/api/types";
import { formatUkDateTime } from "@/lib/format/date";

function formatAsOfTimestamp(timestamp?: string | null): string | undefined {
  if (!timestamp) {
    return undefined;
  }

  const formatted = formatUkDateTime(timestamp);
  if (!formatted) {
    return undefined;
  }

  return `(${formatted})`;
}

function MetricRows({ metrics }: { metrics: MetricValue[] }) {
  return (
    <div className="w-full space-y-4">
      {metrics.map((metric) => (
        <div
          key={metric.metricKey}
          className="grid w-full grid-cols-2 items-end border-b border-white/6 pb-3 last:border-b-0 last:pb-0"
        >
          <span className="text-center text-xl text-white">{metric.label}</span>
          <span
            className={`text-center text-xl font-light tabular-nums md:text-2xl ${
              metric.value >= 0
                ? "font-medium text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]"
                : "font-medium text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]"
            }`}
          >
            {formatSignedDecimal(metric.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PortfolioSummaryCard({
  pnlMetrics,
  riskMetrics,
  valuationTimestamp,
  collapsed,
  onToggle,
}: {
  pnlMetrics: MetricValue[];
  riskMetrics: MetricValue[];
  valuationTimestamp?: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const totalPnL = pnlMetrics.find((metric) => metric.isPrimary)?.value ?? pnlMetrics[0]?.value ?? 0;
  const subtitle = formatAsOfTimestamp(valuationTimestamp);

  return (
    <DashboardCardShell
      title="P&L Summary and Risk"
      subtitle={subtitle}
      collapsed={collapsed}
      collapsedValue={formatSignedDecimal(totalPnL)}
      collapsedValuePositive={totalPnL >= 0}
      onToggle={onToggle}
    >
      <div className="mt-4 w-full">
        <div className="grid w-full gap-12 xl:grid-cols-2">
          <div className="w-full">
            <MetricRows metrics={pnlMetrics} />
          </div>
          <div className="w-full">
            <MetricRows metrics={riskMetrics} />
          </div>
        </div>
      </div>
    </DashboardCardShell>
  );
}
