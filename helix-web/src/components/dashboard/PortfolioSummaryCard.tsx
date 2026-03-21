import { DashboardCardShell } from "@/components/dashboard/DashboardCardShell";
import { formatSignedInteger } from "@/lib/format/number";
import type { MetricValue } from "@/lib/mock/portfolio";

function MetricRows({ metrics }: { metrics: MetricValue[] }) {
  return (
    <div className="space-y-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="flex items-end justify-between gap-6 border-b border-white/6 pb-3 last:border-b-0 last:pb-0"
        >
          <span className="text-xl text-white">{metric.label}</span>
          <span
            className={`text-xl font-light tabular-nums md:text-2xl ${
              metric.value >= 0
                ? "font-medium text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]"
                : "font-medium text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]"
            }`}
          >
            {formatSignedInteger(metric.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PortfolioSummaryCard({
  pnlMetrics,
  riskMetrics,
  collapsed,
  onToggle,
}: {
  pnlMetrics: MetricValue[];
  riskMetrics: MetricValue[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const totalPnL = pnlMetrics.find((metric) => metric.label === "Total P&L")?.value ?? 0;

  return (
    <DashboardCardShell
      title="P&L Summary and Risk"
      collapsed={collapsed}
      collapsedValue={formatSignedInteger(totalPnL)}
      collapsedValuePositive={totalPnL >= 0}
      onToggle={onToggle}
    >
      <div className="mt-4 grid gap-8 xl:grid-cols-2">
        <div>
          <MetricRows metrics={pnlMetrics} />
        </div>
        <div>
          <MetricRows metrics={riskMetrics} />
        </div>
      </div>
    </DashboardCardShell>
  );
}
