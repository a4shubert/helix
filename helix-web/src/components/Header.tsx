import { Clocks } from "./Clocks";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[color:var(--color-border)] [background:var(--color-bg)]">
      <div className="w-full px-[5vw] py-4 [background:var(--color-bg)]">
        <div className="grid w-full grid-cols-1 items-center gap-4 py-4 2xl:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="hidden items-center justify-start 2xl:flex">
            <Clocks showSeconds={false} />
          </div>

          <h1 className="hbc-title min-w-0 w-full text-center whitespace-normal break-normal text-white hyphens-none">
            P&amp;L and Risk Analytical Dashboard
          </h1>

          <nav className="hidden items-center justify-end gap-4 text-xl font-normal 2xl:flex">
            <a
              href="https://github.com/a4shubert/helix"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-2xl text-[color:var(--color-text)] transition-[text-decoration-color] hover:underline hover:decoration-2 hover:underline-offset-4 hover:decoration-[var(--color-accent)]"
            >
              Documentation
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
