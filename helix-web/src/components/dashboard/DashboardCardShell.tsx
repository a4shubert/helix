"use client";

import type { ReactNode } from "react";

export function DashboardCardShell({
  title,
  subtitle,
  collapsedValue,
  collapsedValuePositive,
  hideTitle,
  centerTitle,
  collapsed,
  onToggle,
  expandedClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  collapsedValue?: string;
  collapsedValuePositive?: boolean;
  hideTitle?: boolean;
  centerTitle?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  expandedClassName?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 shadow-[0_20px_60px_rgba(2,6,23,0.35)]",
        collapsed ? "shrink-0 px-6 py-5" : `flex flex-col px-5 py-5 ${expandedClassName ?? ""}`,
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-2xl font-light leading-none text-white transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          title={collapsed ? "Expand card" : "Collapse card"}
        >
          {collapsed ? "+" : "-"}
        </button>

        <div
          className={[
            "flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2",
            centerTitle ? "justify-center text-center" : "",
          ].join(" ")}
        >
          {!hideTitle ? (
            <div className="text-xl font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
              {collapsed && collapsedValue ? (
                <>
                  {title}:{" "}
                  <span
                    className={
                      collapsedValuePositive
                        ? "text-xl font-medium text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)] md:text-2xl"
                        : "text-xl font-medium text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)] md:text-2xl"
                    }
                  >
                    {collapsedValue}
                  </span>
                </>
              ) : (
                title
              )}
            </div>
          ) : null}
          {subtitle ? (
            <div className="text-lg font-medium tracking-[0.08em] text-white/90">{subtitle}</div>
          ) : null}
        </div>
      </div>

      {!collapsed ? children : null}
    </section>
  );
}
