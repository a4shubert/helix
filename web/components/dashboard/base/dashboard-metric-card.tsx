import type { ReactNode } from "react";

type Tone = "positive" | "negative" | "neutral";

const toneClassName: Record<Tone, string> = {
  positive: "text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]",
  negative: "text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]",
  neutral: "text-white",
};

const metricTextSizeClassName = "text-[0.875rem] md:text-[1rem]";

export function DashboardMetricCard({
  title,
  subtitle,
  value,
  tone = "neutral",
  valueClassName,
  children,
}: Readonly<{
  title: ReactNode;
  subtitle?: ReactNode;
  value: ReactNode;
  tone?: Tone;
  valueClassName?: string;
  children?: ReactNode;
}>) {
  return (
    <section className="shrink-0 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-5 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <div
            className={`${metricTextSizeClassName} font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent)]`}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              className={`${metricTextSizeClassName} font-medium tracking-[0.08em] text-white/90`}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          className={`text-left ${valueClassName ?? metricTextSizeClassName} font-medium tabular-nums md:text-right ${toneClassName[tone]}`}
        >
          {value}
        </div>
      </div>

      {children}
    </section>
  );
}
