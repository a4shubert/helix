import { formatSignedDecimal } from "@/lib/format/number";
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

  const metricItems = [
    { label: "Realized", value: realizedPnl },
    { label: "Unrealized", value: unrealizedPnl },
    { label: "Total", value: totalPnl },
  ];

  return (
    <section
      data-initial-state={isExpanded ? "expanded" : "collapsed"}
      className="shrink-0 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-5 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]"
    >
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-10">
        <div className="text-[0.875rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent)] md:text-[1rem]">
          P&L
        </div>
        <div className="grid gap-3 md:grid-cols-3 md:gap-6">
          {metricItems.map((metric) => (
            <div key={metric.label} className="flex items-center justify-center gap-2 md:justify-self-center">
              <span className="text-[1.155rem] font-medium uppercase tracking-[0.12em] text-white/70 md:text-[1.32rem]">
                {metric.label}:
              </span>
              <span
                className={[
                  metric.label === "Total"
                    ? "text-[1.386rem] font-medium tabular-nums md:text-[1.584rem]"
                    : "text-[1.155rem] font-medium tabular-nums md:text-[1.32rem]",
                  metric.value >= 0
                    ? "text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]"
                    : "text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]",
                ].join(" ")}
              >
                {formatSignedDecimal(metric.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
