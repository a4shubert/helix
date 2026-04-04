import {
  headerApiLinks,
  headerDocumentationLink,
  headerUserLabel,
} from "@/config/header";

export function HeaderActions() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
      <span className="rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-sm text-[color:var(--color-text)] sm:text-base">
        {headerUserLabel}
      </span>

      <a
        href={headerDocumentationLink.href}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-sm text-[color:var(--color-text)] transition-[text-decoration-color] hover:underline hover:decoration-2 hover:underline-offset-4 hover:decoration-[var(--color-accent)] sm:text-base"
      >
        {headerDocumentationLink.label}
      </a>

      <details className="group relative">
        <summary className="list-none rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-sm text-[color:var(--color-text)] marker:hidden hover:underline hover:decoration-2 hover:underline-offset-4 hover:decoration-[var(--color-accent)] sm:text-base">
          APIs
        </summary>
        <div className="hidden absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2 shadow-[0_16px_40px_rgba(2,6,23,0.45)] group-open:block">
          {headerApiLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded px-3 py-2 text-sm text-[color:var(--color-text)] hover:bg-[color:var(--color-link-surface)] sm:text-base"
            >
              {link.label}
            </a>
          ))}
        </div>
      </details>
    </div>
  );
}
