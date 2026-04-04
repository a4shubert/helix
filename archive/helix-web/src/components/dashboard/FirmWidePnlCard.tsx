import { formatUkDateTime } from "@/lib/format/date";
import { formatSignedDecimal } from "@/lib/format/number";

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

export function FirmWidePnlCard({
  totalPnl,
  valuationTimestamp,
}: {
  totalPnl: number;
  valuationTimestamp?: string;
}) {
  const subtitle = formatAsOfTimestamp(valuationTimestamp);

  return (
    <section className="shrink-0 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-6 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="text-xl font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
            Firm Wide P&amp;L
          </div>
          {subtitle ? <div className="text-lg font-medium tracking-[0.08em] text-white/90">{subtitle}</div> : null}
        </div>
        <div
          className={`text-right text-2xl font-medium tabular-nums md:text-3xl ${
            totalPnl >= 0
              ? "text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]"
              : "text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]"
          }`}
        >
          {formatSignedDecimal(totalPnl)}
        </div>
      </div>
    </section>
  );
}
