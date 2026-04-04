import { DashboardMetricCard } from "@/components/dashboard/base/dashboard-metric-card";
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
}: Readonly<{
  totalPnl: number;
  valuationTimestamp?: string;
}>) {
  const subtitle = formatAsOfTimestamp(valuationTimestamp);

  return (
    <DashboardMetricCard
      title="Total"
      subtitle={subtitle}
      value={formatSignedDecimal(totalPnl)}
      tone={totalPnl >= 0 ? "positive" : "negative"}
      valueClassName="text-[1.3125rem] md:text-[1.5rem]"
    />
  );
}
