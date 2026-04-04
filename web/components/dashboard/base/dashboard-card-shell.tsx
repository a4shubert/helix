"use client";

import type { ReactNode } from "react";

export function DashboardCardShell({
  title,
  subtitle,
  collapsedValue,
  collapsedValuePositive,
  collapsedValueAlignRight,
  hideTitle,
  centerTitle,
  collapsed,
  onToggle,
  expandedClassName,
  children,
}: Readonly<{
  title: string;
  subtitle?: string;
  collapsedValue?: string;
  collapsedValuePositive?: boolean;
  collapsedValueAlignRight?: boolean;
  hideTitle?: boolean;
  centerTitle?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  expandedClassName?: string;
  children?: ReactNode;
}>) {
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
          className="group inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-visible rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-white transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          title={collapsed ? "Expand card" : "Collapse card"}
        >
          <span
            className={[
              "block translate-y-[-1px] text-[1.2rem] leading-[0.7]",
              collapsed ? "font-light" : "font-medium text-white group-hover:text-[color:var(--color-accent)]",
            ].join(" ")}
          >
            {collapsed ? "+" : "-"}
          </span>
        </button>

        <div
          className={[
            "flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2",
            collapsed && collapsedValue && collapsedValueAlignRight ? "justify-between" : "",
            centerTitle ? "justify-center text-center" : "",
          ].join(" ")}
        >
          {!hideTitle ? (
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--color-accent)] md:text-base">
              {collapsed && collapsedValue && !collapsedValueAlignRight ? (
                <>
                  {title}:{" "}
                  <span
                    className={
                      collapsedValuePositive
                        ? "text-sm font-medium text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)] md:text-base"
                        : "text-sm font-medium text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)] md:text-base"
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
          {collapsed && collapsedValue && collapsedValueAlignRight ? (
            <div
              className={[
                "ml-auto text-sm font-medium tabular-nums md:text-base",
                collapsedValuePositive
                  ? "text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]"
                  : "text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]",
              ].join(" ")}
            >
              {collapsedValue}
            </div>
          ) : null}
          {subtitle ? (
            <div className="text-sm font-medium tracking-[0.04em] text-white md:text-base">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      {!collapsed ? children : null}
    </section>
  );
}
