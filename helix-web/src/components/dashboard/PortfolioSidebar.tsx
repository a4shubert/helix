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
  groupName,
}: {
  portfolios: readonly PortfolioSidebarItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  groupName: string;
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-4 [background:var(--color-bg)]">
      <div className="text-xl font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
        Portfolios
      </div>
      <div className="flex flex-col gap-3">
        {portfolios.map((portfolio) => (
          <label
            key={portfolio.key}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-[color:var(--color-border)] [background:var(--color-card)] px-3 py-2 text-[color:var(--color-text)] hover:border-[color:var(--color-accent)]"
          >
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
        ))}
      </div>
    </div>
  );
}

export function PortfolioSidebar<K extends string>({
  portfolios,
  selected,
  onSelect,
}: {
  portfolios: readonly PortfolioSidebarItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
}) {
  return (
    <aside className="h-full w-[15vw] min-w-[280px] shrink-0 rounded-lg border border-[color:var(--color-border)] [background:var(--color-card)]">
      <SidebarContent
        portfolios={portfolios}
        selected={selected}
        onSelect={onSelect}
        groupName="portfolio-static"
      />
    </aside>
  );
}
