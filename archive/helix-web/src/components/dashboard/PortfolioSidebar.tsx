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
}: {
  portfolios: readonly PortfolioSidebarItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  onRecompute: (key: K) => void;
  recomputingKey: K | null;
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
            role="button"
            tabIndex={0}
            onClick={() => onSelect(portfolio.key)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(portfolio.key);
              }
            }}
            className={`flex items-start justify-between gap-3 rounded-md border [background:var(--color-card)] px-3 py-2 text-[color:var(--color-text)] transition-colors ${
              selected === portfolio.key
                ? "border-[color:var(--color-accent)]"
                : "border-[color:var(--color-border)] hover:border-[color:var(--color-accent)]"
            }`}
          >
            <span className="min-w-0">
              <div className="text-lg font-medium">{portfolio.label}</div>
              <div className="text-m break-words leading-snug whitespace-normal text-[color:var(--color-muted)]">
                {portfolio.description}
              </div>
            </span>
            <button
              type="button"
              aria-label={`Recompute ${portfolio.label}`}
              title={`Recompute ${portfolio.label}`}
              onClick={(event) => {
                event.stopPropagation();
                onRecompute(portfolio.key);
              }}
              disabled={selected !== portfolio.key || recomputingKey === portfolio.key}
              className="mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-lg border border-[color:var(--color-border)] text-white hover:border-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="block translate-y-[2px] rotate-[200deg] text-[2.5rem] leading-[0.8]">
                {recomputingKey === portfolio.key ? "..." : "↻"}
              </span>
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
    <>
      <div aria-hidden className="w-[15vw] min-w-[280px] shrink-0" />
      <aside className="fixed left-[5vw] top-[calc(var(--hbc-header-h)+2.5rem)] z-20 w-[15vw] min-w-[280px] max-h-[calc(100dvh-var(--hbc-header-h)-3.75rem)] overflow-y-auto rounded-lg border border-[color:var(--color-border)] [background:var(--color-card)]">
        <SidebarContent
          portfolios={portfolios}
          selected={selected}
          onSelect={onSelect}
          onRecompute={onRecompute}
          recomputingKey={recomputingKey}
        />
      </aside>
    </>
  );
}
