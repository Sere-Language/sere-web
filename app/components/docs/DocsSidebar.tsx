"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { DocEntry } from "../../lib/docs";
import BrandMark from "../BrandMark";

interface DocsSidebarProps {
  docs: DocEntry[];
}

export default function DocsSidebar({ docs }: DocsSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

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
        {docs.map((doc) => (
          <option key={doc.slug} value={doc.href}>
            {doc.title}
          </option>
        ))}
      </select>

      <nav aria-label="Documentation" className="hidden md:block">
        <div className="mb-4 flex items-center gap-2">
          <BrandMark alt="" size={22} />
          <p className="m-0 text-xs font-medium uppercase tracking-wider text-muted">
            Language
          </p>
        </div>
        <ul className="flex flex-col gap-0.5 border-l border-border pl-3">
          {docs.map((doc) => {
            const active = pathname === doc.href;
            return (
              <li key={doc.slug}>
                <Link
                  href={doc.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-md px-2.5 py-1.5 text-sm no-underline transition-all duration-200 hover:no-underline ${
                    active
                      ? "bg-secondary text-foreground border-l-2 border-primary pl-3"
                      : "text-muted hover:bg-secondary hover:text-foreground hover:pl-4"
                  }`}
                >
                  {doc.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
