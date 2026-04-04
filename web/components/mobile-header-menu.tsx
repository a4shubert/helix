import {
  headerApiLinks,
  headerDocumentationLink,
  headerUserLabel,
} from "@/config/header";

function lowerFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

export function MobileHeaderMenu() {
  return (
    <details className="relative">
      <summary className="flex h-11 w-11 list-none items-center justify-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-link-surface)] text-[color:var(--color-text)] marker:hidden">
        <span className="sr-only">Open navigation menu</span>
        <span className="flex flex-col gap-1">
          <span className="block h-0.5 w-5 rounded bg-current" />
          <span className="block h-0.5 w-5 rounded bg-current" />
          <span className="block h-0.5 w-5 rounded bg-current" />
        </span>
      </summary>

      <div className="mobile-header-panel absolute right-0 top-full z-50 mt-3 w-[min(92vw,20rem)] rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-[0_16px_40px_rgba(2,6,23,0.45)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-sm text-[color:var(--color-text)]">
              {headerUserLabel}
            </span>

            <a
              href={headerDocumentationLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-[color:var(--color-link-surface)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            >
              {lowerFirst(headerDocumentationLink.label)}
            </a>

            <details className="rounded-md bg-[color:var(--color-link-surface)]">
              <summary className="px-3 py-2 text-sm text-[color:var(--color-text)]">
                apis
              </summary>

              <div className="flex flex-col gap-2 border-t border-[color:var(--color-border)] p-2">
                {headerApiLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-[color:var(--color-link-surface-hover)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                  >
                    {lowerFirst(link.label)}
                  </a>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </details>
  );
}
