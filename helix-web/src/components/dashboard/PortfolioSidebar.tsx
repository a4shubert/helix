"use client";

type PortfolioSidebarItem<K extends string> = {
  key: K;
  label: string;
  description: string;
};

function SidebarContent<K extends string>({
  portfolios,
  selected,
  onSelect,
  onRecompute,
  recomputingKey,
  groupName,
}: {
  portfolios: readonly PortfolioSidebarItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  onRecompute: (key: K) => void;
  recomputingKey: K | null;
  groupName: string;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 [background:var(--color-bg)]">
      <div className="text-xl font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
        Portfolios
      </div>
      <div className="flex flex-col gap-3">
        {portfolios.map((portfolio) => (
          <div
            key={portfolio.key}
            className="flex items-start justify-between gap-3 rounded-md border border-[color:var(--color-border)] [background:var(--color-card)] px-3 py-2 text-[color:var(--color-text)] hover:border-[color:var(--color-accent)]"
          >
            <label className="flex min-w-0 cursor-pointer items-start gap-2">
              <input
                type="radio"
                name={groupName}
                value={portfolio.key}
                checked={selected === portfolio.key}
                onChange={() => onSelect(portfolio.key)}
                className="mt-1 accent-[color:var(--color-accent)]"
              />
              <span className="min-w-0">
                <div className="text-lg font-medium">{portfolio.label}</div>
                <div className="text-m break-words leading-snug whitespace-normal text-[color:var(--color-muted)]">
                  {portfolio.description}
                </div>
              </span>
            </label>
            <button
              type="button"
              aria-label={`Recompute ${portfolio.label}`}
              title={`Recompute ${portfolio.label}`}
              onClick={() => onRecompute(portfolio.key)}
              disabled={recomputingKey === portfolio.key}
              className="mt-0.5 shrink-0 rounded-md border border-[color:var(--color-border)] px-2 py-1 text-sm text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {recomputingKey === portfolio.key ? "..." : "↻"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioSidebar<K extends string>({
  portfolios,
  selected,
  onSelect,
  onRecompute = () => {},
  recomputingKey = null,
}: {
  portfolios: readonly PortfolioSidebarItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  onRecompute?: (key: K) => void;
  recomputingKey?: K | null;
}) {
  return (
    <aside className="sticky top-0 self-start w-[15vw] min-w-[280px] shrink-0 rounded-lg border border-[color:var(--color-border)] [background:var(--color-card)]">
      <SidebarContent
        portfolios={portfolios}
        selected={selected}
        onSelect={onSelect}
        onRecompute={onRecompute}
        recomputingKey={recomputingKey}
        groupName="portfolio-static"
      />
    </aside>
  );
}
