"use client";

export const strategyOptions = [
  "Combined",
  "Global Macro Carry",
  "Equity Mean Reversion",
  "Rates Momentum",
  "Commodities Trend",
] as const;

export function StrategySelector({
  selectedStrategy,
  onSelect,
}: Readonly<{
  selectedStrategy: (typeof strategyOptions)[number];
  onSelect: (strategy: (typeof strategyOptions)[number]) => void;
}>) {
  function getButtonClassName(isSelected: boolean): string {
    return [
      "inline-flex shrink-0 items-center justify-center rounded-xl border px-4 py-2.5 text-[0.9rem] font-semibold uppercase tracking-[0.14em] transition-colors md:px-5 md:text-[0.98rem]",
      isSelected
        ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/14 text-white"
        : "border-transparent bg-transparent text-white hover:border-[color:var(--color-border)] hover:text-white",
    ].join(" ");
  }

  return (
    <section className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/55 p-2 shadow-[0_20px_60px_rgba(2,6,23,0.28)] md:min-w-0 md:justify-between">
        {strategyOptions.map((strategy) => (
          <button
            key={strategy}
            type="button"
            onClick={() => onSelect(strategy)}
            aria-pressed={selectedStrategy === strategy}
            className={getButtonClassName(selectedStrategy === strategy)}
          >
            {strategy}
          </button>
        ))}
      </div>
    </section>
  );
}
