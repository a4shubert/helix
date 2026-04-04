"use client";

import { HeaderActions } from "@/components/header-actions";
import { MobileHeaderMenu } from "@/components/mobile-header-menu";
import { useStrategyContext } from "@/components/strategy-context";
import { formatSignedDecimal } from "@/lib/format/number";
import { WorldClocks } from "@/components/world-clocks";
import {
  headerClocks,
  headerTitle,
  headerTitleMediumLines,
} from "@/config/header";
import { useEffect, useState } from "react";

const COMPACT_HEADER_MAX_WIDTH = 1440;
const WIDE_HEADER_MIN_WIDTH = 2091;

type HeaderMode = "compact" | "medium" | "wide";

export function SiteHeader() {
  const [headerMode, setHeaderMode] = useState<HeaderMode>("compact");
  const { selectedStrategy, asOfTime, totalPnl } = useStrategyContext();

  useEffect(() => {
    const syncLayout = () => {
      const width = window.innerWidth;

      if (width >= WIDE_HEADER_MIN_WIDTH) {
        setHeaderMode("wide");
        return;
      }

      if (width <= COMPACT_HEADER_MAX_WIDTH) {
        setHeaderMode("compact");
        return;
      }

      setHeaderMode("medium");
    };

    syncLayout();
    window.addEventListener("resize", syncLayout);

    return () => {
      window.removeEventListener("resize", syncLayout);
    };
  }, []);

  const strategyContext = (
    <div className="mt-5 flex justify-center">
      <div className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/72 px-5 py-2 shadow-[0_12px_28px_rgba(2,6,23,0.22)] backdrop-blur-sm">
        <div className="min-w-0 text-center text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-white sm:text-[0.82rem] md:text-[0.88rem]">
          <span>{selectedStrategy.toUpperCase()}</span>
          <span className="px-3 text-white/38">|</span>
          <span className="text-white/68">As of:</span>{" "}
          <span>{asOfTime}</span>
          <span className="px-3 text-white/38">|</span>
          <span className="text-white/68">Total P&amp;L:</span>{" "}
          <span
            className={[
              "text-[1.14rem] md:text-[1.32rem]",
              totalPnl >= 0
                ? "text-[#2DD3B6] drop-shadow-[0_0_10px_rgba(45,211,182,0.28)]"
                : "text-[#f87171] drop-shadow-[0_0_10px_rgba(248,113,113,0.30)]",
            ].join(" ")}
          >
            {formatSignedDecimal(totalPnl)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[color:var(--color-border)] [background:var(--color-bg)]">
      <div className="w-full px-4 py-4 sm:px-6 lg:px-[5vw] [background:var(--color-bg)]">
        {headerMode === "wide" ? (
          <div className="grid items-center gap-6 py-2 [grid-template-columns:auto_minmax(0,1fr)_auto]">
            <div className="min-w-0 justify-self-start">
              <WorldClocks clocks={headerClocks} showSeconds={false} />
            </div>

            <div className="min-w-0 justify-self-center">
              <h1 className="helix-title hbc-title helix-title-wide hbc-title-wide min-w-0 text-center text-white">
                {headerTitle}
              </h1>
              {strategyContext}
            </div>

            <div className="justify-self-end">
              <HeaderActions />
            </div>
          </div>
        ) : headerMode === "medium" ? (
          <div className="grid items-center gap-6 py-2 [grid-template-columns:auto_minmax(0,1fr)_auto]">
            <div className="min-w-0 justify-self-start">
              <WorldClocks clocks={headerClocks} showSeconds={false} />
            </div>

            <div className="min-w-0 justify-self-center">
              <h1 className="helix-title hbc-title helix-title-medium hbc-title-medium text-center text-white">
                <span className="block whitespace-nowrap">
                  {headerTitleMediumLines[0]}
                </span>
                <span className="block whitespace-nowrap">
                  {headerTitleMediumLines[1]}
                </span>
              </h1>
              {strategyContext}
            </div>

            <div className="justify-self-end">
              <HeaderActions />
            </div>
          </div>
        ) : (
          <div className="grid items-center gap-3 py-2 [grid-template-columns:2.75rem_minmax(0,1fr)_2.75rem]">
            <div className="h-11 w-11" aria-hidden="true" />

            <div className="min-w-0">
              <h1 className="helix-title hbc-title helix-title-compact hbc-title-compact min-w-0 text-center text-white">
                {headerTitle}
              </h1>
              {strategyContext}
            </div>

            <div className="justify-self-end">
              <MobileHeaderMenu />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
