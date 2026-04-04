"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { strategyOptions } from "@/components/dashboard/strategy-selector";
import { mockedPnlMetrics } from "@/lib/mock/dashboard";

const mockedAsOfTime = "18:30:00";
const mockedTotalPnl =
  mockedPnlMetrics.find((metric) => metric.metricKey === "total_pnl")?.value ?? 0;

type StrategyContextValue = {
  selectedStrategy: (typeof strategyOptions)[number];
  setSelectedStrategy: (strategy: (typeof strategyOptions)[number]) => void;
  asOfTime: string;
  totalPnl: number;
};

const StrategyContext = createContext<StrategyContextValue | null>(null);

export function StrategyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [selectedStrategy, setSelectedStrategy] = useState<(typeof strategyOptions)[number]>(
    "Combined",
  );

  return (
    <StrategyContext.Provider
      value={{
        selectedStrategy,
        setSelectedStrategy,
        asOfTime: mockedAsOfTime,
        totalPnl: mockedTotalPnl,
      }}
    >
      {children}
    </StrategyContext.Provider>
  );
}

export function useStrategyContext() {
  const context = useContext(StrategyContext);

  if (!context) {
    throw new Error("useStrategyContext must be used within a StrategyProvider");
  }

  return context;
}
