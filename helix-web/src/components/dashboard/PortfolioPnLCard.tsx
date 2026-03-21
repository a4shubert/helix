import type { MetricValue } from "@/lib/mock/portfolio";
import { formatSignedInteger } from "@/lib/format/number";

export function PortfolioPnLCard({
  metrics,
}: {
  metrics: MetricValue[];
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-6 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
      <div className="mb-4 text-xl font-semibold uppercase tracking-[0.18em] text-white">
        P&amp;L Summary
      </div>
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
    </section>
  );
}
