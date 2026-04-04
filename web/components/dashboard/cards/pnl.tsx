import { DashboardMetricCard } from "@/components/dashboard/base/dashboard-metric-card";
import { formatSignedDecimal } from "@/lib/format/number";

export function Pnl({
  totalPnl,
  isExpanded = true,
}: Readonly<{
  totalPnl: number;
  isExpanded?: boolean;
}>) {
  return (
    <DashboardMetricCard
      title="P&L"
      value={formatSignedDecimal(totalPnl)}
      tone={totalPnl >= 0 ? "positive" : "negative"}
      isExpanded={isExpanded}
      valueClassName="text-[1.3125rem] md:text-[1.5rem]"
    />
  );
}
