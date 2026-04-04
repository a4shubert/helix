"use client";

import { useEffect, useState } from "react";
import { formatUkTime } from "@/lib/format/date";

type CityClock = {
  label: string;
  zone: string;
};

type ClocksProps = {
  cities?: CityClock[];
  showSeconds?: boolean;
};

const defaultCities: CityClock[] = [
  { label: "New York", zone: "America/New_York" },
  { label: "London", zone: "Europe/London" },
  { label: "Dubai", zone: "Asia/Dubai" },
  { label: "Hong Kong", zone: "Asia/Hong_Kong" },
];

export function Clocks({
  cities = defaultCities,
  showSeconds = false,
}: ClocksProps) {
  const [times, setTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    const update = () => {
      const next: Record<string, string> = {};

      for (const city of cities) {
        next[city.label] = formatUkTime(new Date(), city.zone, showSeconds);
      }

      setTimes(next);
    };

    update();
    const intervalId = setInterval(update, 1000);
    return () => clearInterval(intervalId);
  }, [cities, showSeconds]);

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-4 text-base text-slate-200">
      {cities.map((city) => (
        <div
          key={city.label}
          className="min-w-0 rounded-md border border-slate-800 bg-[color:var(--color-bg)] px-4 py-3 shadow-sm"
        >
          <div className="w-full text-center text-2xl font-normal tabular-nums text-indigo-100">
            {times[city.label] ?? (showSeconds ? "--:--:--" : "--:--")}
          </div>
          <div className="mt-1 w-full truncate text-center text-base font-medium text-white 2xl:text-lg">
            {city.label}
          </div>
        </div>
      ))}
    </div>
  );
}
