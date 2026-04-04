import type { ReactNode } from "react";

type Tone = "positive" | "negative" | "neutral";
type Alignment = "left" | "center" | "right";

const toneClassName: Record<Tone, string> = {
  positive: "text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]",
  negative: "text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]",
  neutral: "text-white",
};

const metricTextSizeClassName = "text-[0.875rem] md:text-[1rem]";

export type DashboardMetricCardItem = {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  valueClassName?: string;
  labelClassName?: string;
};

export type DashboardMetricCardRow = {
  items: DashboardMetricCardItem[];
  align?: Alignment;
  itemClassName?: string;
};

function rowAlignmentClassName(align: Alignment): string {
  if (align === "left") {
    return "md:justify-items-start";
  }

  if (align === "right") {
    return "md:justify-items-end";
  }

  return "md:justify-items-center";
}

export function DashboardMetricCard({
  title,
  subtitle,
  value,
  tone = "neutral",
  isExpanded = true,
  valueClassName,
  centerHeader = false,
  headerClassName,
  rows,
  children,
}: Readonly<{
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  tone?: Tone;
  isExpanded?: boolean;
  valueClassName?: string;
  centerHeader?: boolean;
  headerClassName?: string;
  rows?: DashboardMetricCardRow[];
  children?: ReactNode;
}>) {
  return (
    <section
      data-initial-state={isExpanded ? "expanded" : "collapsed"}
      className="shrink-0 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 px-5 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]"
    >
      <div
        className={[
          "flex flex-col gap-4 md:flex-row md:items-center md:gap-6",
          centerHeader ? "justify-center" : "md:justify-between",
          headerClassName ?? "",
        ].join(" ")}
      >
        <div
          className={[
            "flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2",
            centerHeader ? "justify-center text-center" : "",
          ].join(" ")}
        >
          <div
            className={`${metricTextSizeClassName} font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent)]`}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              className={`${metricTextSizeClassName} font-medium tracking-[0.08em] text-white`}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {value ? (
          <div
            className={`text-left ${valueClassName ?? metricTextSizeClassName} font-medium tabular-nums md:text-right ${toneClassName[tone]}`}
          >
            {value}
          </div>
        ) : null}
      </div>

      {children}

      {rows ? (
        <div className="mt-4 grid gap-3">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={[
                "grid gap-3 md:grid-cols-3 md:gap-6",
                rowAlignmentClassName(row.align ?? "center"),
              ].join(" ")}
            >
              {row.items.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className={[
                    "flex items-center justify-center gap-2",
                    row.itemClassName ?? "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-[1.155rem] font-medium uppercase tracking-[0.12em] text-white md:text-[1.32rem]",
                      item.labelClassName ?? "",
                    ].join(" ")}
                  >
                    {item.label}:
                  </span>
                  <span
                    className={[
                      "text-[1.155rem] font-medium tabular-nums md:text-[1.32rem]",
                      toneClassName[item.tone ?? "neutral"],
                      item.valueClassName ?? "",
                    ].join(" ")}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
