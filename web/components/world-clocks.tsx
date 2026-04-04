"use client";

import { HeaderClock } from "@/config/header";
import { formatTime } from "@/lib/format/time";
import { useEffect, useState } from "react";

type WorldClocksProps = {
  clocks: HeaderClock[];
  showSeconds?: boolean;
};

export function WorldClocks({
  clocks,
  showSeconds = false,
}: Readonly<WorldClocksProps>) {
  const [times, setTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      const nextTimes = Object.fromEntries(
        clocks.map((clock) => [
          clock.label,
          formatTime(now, clock.timeZone, showSeconds),
        ]),
      );

      setTimes(nextTimes);
    };

    updateTimes();

    const intervalId = window.setInterval(updateTimes, 1000);
    return () => window.clearInterval(intervalId);
  }, [clocks, showSeconds]);

  return (
    <div className="flex items-stretch gap-3 text-base text-slate-200">
      {clocks.map((clock) => (
        <div
          key={clock.label}
          className="min-w-[120px] rounded-md border border-slate-800 bg-[color:var(--color-bg)] px-4 py-3 shadow-sm"
        >
          <div className="w-full text-center text-2xl font-normal tabular-nums text-indigo-100">
            {times[clock.label] ?? (showSeconds ? "--:--:--" : "--:--")}
          </div>
          <div className="mt-1 w-full truncate text-center text-base font-medium text-white">
            {clock.label}
          </div>
        </div>
      ))}
    </div>
  );
}
