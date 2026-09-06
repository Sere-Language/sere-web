import type { DocHeading } from "../../lib/docs";

export default function DocToc({ headings }: { headings: DocHeading[] }) {
  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="hidden xl:block">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
        On this page
      </p>
      <ul className="flex flex-col gap-1.5 border-l border-border pl-3">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className="block text-sm text-muted no-underline hover:text-foreground hover:no-underline"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
