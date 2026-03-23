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

          <nav className="hidden items-center justify-end gap-3 text-xl font-normal 2xl:flex">
            <span className="rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-lg text-[color:var(--color-text)]">
              user: shubale
            </span>
            <a
              href="https://github.com/a4shubert/helix"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-2xl text-[color:var(--color-text)] transition-[text-decoration-color] hover:underline hover:decoration-2 hover:underline-offset-4 hover:decoration-[var(--color-accent)]"
            >
              Documentation
            </a>
            <div className="group relative">
              <button
                type="button"
                className="rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-2xl text-[color:var(--color-text)] transition-[text-decoration-color] hover:underline hover:decoration-2 hover:underline-offset-4 hover:decoration-[var(--color-accent)]"
              >
                APIs
              </button>
              <div className="invisible absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2 opacity-0 shadow-[0_16px_40px_rgba(2,6,23,0.45)] transition-all duration-150 group-hover:visible group-hover:opacity-100">
                <a
                  href="http://localhost:5057/swagger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded px-3 py-2 text-lg text-[color:var(--color-text)] hover:bg-[color:var(--color-link-surface)]"
                >
                  RestSwagger
                </a>
                <a
                  href="http://localhost:15672"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded px-3 py-2 text-lg text-[color:var(--color-text)] hover:bg-[color:var(--color-link-surface)]"
                >
                  RabitMQ UI
                </a>
                <a
                  href="http://localhost:8080"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded px-3 py-2 text-lg text-[color:var(--color-text)] hover:bg-[color:var(--color-link-surface)]"
                >
                  Kafka UI
                </a>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
