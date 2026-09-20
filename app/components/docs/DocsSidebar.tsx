"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sectionLabel } from "../../lib/docLinks";
import type { DocEntry } from "../../lib/docs";
import BrandMark from "../BrandMark";

interface DocsSidebarProps {
  docs: DocEntry[];
}

interface DocGroup {
  /** Folder the pages live in, or null for the pages at the docs root. */
  section: string | null;
  docs: DocEntry[];
}

/** Folder pages are already ordered together, so runs of a section become a group. */
function groupDocs(docs: DocEntry[]): DocGroup[] {
  const groups: DocGroup[] = [];
  for (const doc of docs) {
    const last = groups[groups.length - 1];
    if (last && last.section === doc.section) last.docs.push(doc);
    else groups.push({ section: doc.section, docs: [doc] });
  }
  return groups;
}

function linkClass(active: boolean): string {
  return `block rounded-md px-2.5 py-1.5 text-sm no-underline transition-all duration-200 hover:no-underline ${
    active
      ? "bg-secondary text-foreground border-l-2 border-primary pl-3"
      : "text-muted hover:bg-secondary hover:text-foreground hover:pl-4"
  }`;
}

export default function DocsSidebar({ docs }: DocsSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const groups = groupDocs(docs);

  return (
    <>
      <label className="sr-only" htmlFor="docs-jump">
        Jump to a docs page
      </label>
      <select
        id="docs-jump"
        className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md shadow-sm md:hidden"
        value={pathname}
        onChange={(event) => router.push(event.target.value)}
      >
        {groups.map((group) => {
          const options = group.docs.map((doc) => (
            <option key={doc.slug} value={doc.href}>
              {doc.title}
            </option>
          ));
          if (!group.section) return options;
          return (
            <optgroup key={group.section} label={sectionLabel(group.section)}>
              {options}
            </optgroup>
          );
        })}
      </select>

      <nav aria-label="Documentation" className="hidden md:block">
        <div className="mb-4 flex items-center gap-2">
          <BrandMark alt="" size={22} />
          <p className="m-0 text-xs font-medium uppercase tracking-wider text-muted">
            Language
          </p>
        </div>
        {groups.map((group, index) => (
          <div
            key={group.section ?? `root-${index}`}
            className={index > 0 ? "mt-6" : undefined}
          >
            {group.section ? (
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                {sectionLabel(group.section)}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5 border-l border-border pl-3">
              {group.docs.map((doc) => {
                const active = pathname === doc.href;
                return (
                  <li key={doc.slug}>
                    <Link
                      href={doc.href}
                      aria-current={active ? "page" : undefined}
                      className={linkClass(active)}
                    >
                      {doc.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
