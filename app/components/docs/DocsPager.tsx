import Link from "next/link";
import type { DocEntry } from "../../lib/docs";

interface DocsPagerProps {
  prev: DocEntry | null;
  next: DocEntry | null;
}

export default function DocsPager({ prev, next }: DocsPagerProps) {
  return (
    <nav aria-label="Documentation pages" className="mt-14 grid grid-cols-1 gap-3 border-t border-border pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="rounded-lg border border-border bg-card px-4 py-3 no-underline transition-colors hover:border-muted hover:no-underline"
        >
          <div className="text-xs text-muted">Previous</div>
          <div className="mt-1 text-sm text-foreground">{prev.title}</div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          className="rounded-lg border border-border bg-card px-4 py-3 text-right no-underline transition-colors hover:border-muted hover:no-underline sm:justify-self-end sm:text-right"
        >
          <div className="text-xs text-muted">Next</div>
          <div className="mt-1 text-sm text-foreground">{next.title}</div>
        </Link>
      ) : null}
    </nav>
  );
}
