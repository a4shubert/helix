"use client";

import { HeaderActions } from "@/components/header-actions";
import { MobileHeaderMenu } from "@/components/mobile-header-menu";
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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[color:var(--color-border)] [background:var(--color-bg)]">
      <div className="w-full px-4 py-4 sm:px-6 lg:px-[5vw] [background:var(--color-bg)]">
        {headerMode === "wide" ? (
          <div className="grid items-center gap-6 py-2 [grid-template-columns:auto_minmax(0,1fr)_auto]">
            <div className="min-w-0 justify-self-start">
              <WorldClocks clocks={headerClocks} showSeconds={false} />
            </div>

            <h1 className="hbc-title hbc-title-wide min-w-0 justify-self-center text-center text-white">
              {headerTitle}
            </h1>

            <div className="justify-self-end">
              <HeaderActions />
            </div>
          </div>
        ) : headerMode === "medium" ? (
          <div className="grid items-center gap-6 py-2 [grid-template-columns:auto_minmax(0,1fr)_auto]">
            <div className="min-w-0 justify-self-start">
              <WorldClocks clocks={headerClocks} showSeconds={false} />
            </div>

            <h1 className="hbc-title hbc-title-medium text-center text-white">
              <span className="block whitespace-nowrap">
                {headerTitleMediumLines[0]}
              </span>
              <span className="block whitespace-nowrap">
                {headerTitleMediumLines[1]}
              </span>
            </h1>

            <div className="justify-self-end">
              <HeaderActions />
            </div>
          </div>
        ) : (
          <div className="grid items-center gap-3 py-2 [grid-template-columns:2.75rem_minmax(0,1fr)_2.75rem]">
            <div className="h-11 w-11" aria-hidden="true" />

            <h1 className="hbc-title hbc-title-compact min-w-0 text-center text-white">
              {headerTitle}
            </h1>

            <div className="justify-self-end">
              <MobileHeaderMenu />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
