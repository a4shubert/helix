"use client";

import { useState, useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardCardShell } from "@/components/dashboard/base/dashboard-card-shell";
import { formatUkDateTime } from "@/lib/format/date";
import { formatDecimal, formatSignedDecimal } from "@/lib/format/number";
import type { PnlTrendPoint } from "@/lib/types/dashboard";

export function Trend({
  points,
  isExpanded = false,
}: Readonly<{
  points: PnlTrendPoint[];
  isExpanded?: boolean;
}>) {
  const [collapsed, setCollapsed] = useState(!isExpanded);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <DashboardCardShell
      title="Trend"
      collapsed={collapsed}
      onToggle={() => setCollapsed((value) => !value)}
      expandedClassName="h-[540px] shrink-0"
    >
      <div className="mt-5 h-[420px] min-h-[420px] w-full">
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 12, right: 18, left: 12, bottom: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value: string) =>
                  new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "Europe/London",
                  }).format(new Date(value))
                }
                tick={{ fill: "#d6dfeb", fontSize: 16 }}
                axisLine={{ stroke: "rgba(255,255,255,0.14)" }}
                tickLine={true}
              />
              <YAxis
                tickFormatter={(value: number) => formatDecimal(value)}
                tick={{ fill: "#d6dfeb", fontSize: 16 }}
                axisLine={{ stroke: "rgba(255,255,255,0.14)" }}
                tickLine={false}
                width={108}
              />
              <Tooltip
                contentStyle={{
                  background: "#192244",
                  border: "1px solid #24305a",
                  borderRadius: "12px",
                  color: "#e8f0f6",
                }}
                labelFormatter={(value) => formatUkDateTime(String(value))}
                formatter={(value, name) => [
                  formatSignedDecimal(
                    typeof value === "number" ? value : Number(value ?? 0),
                  ),
                  String(name) === "totalPnl"
                    ? "Total P&L"
                    : String(name) === "realizedPnl"
                      ? "Realized P&L"
                      : "Unrealized P&L",
                ]}
              />
              <Line
                type="monotone"
                dataKey="totalPnl"
                name="totalPnl"
                stroke="#2DD3B6"
                strokeWidth={4}
                dot={{ r: 2.5 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="realizedPnl"
                name="realizedPnl"
                stroke="#7aa2f7"
                strokeWidth={3}
                strokeDasharray="10 6"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="unrealizedPnl"
                name="unrealizedPnl"
                stroke="#f97316"
                strokeWidth={3}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/30" />
        )}
      </div>
    </DashboardCardShell>
  );
}
