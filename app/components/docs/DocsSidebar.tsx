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
        className="mb-6 w-full px-3 py-2 text-sm md:hidden"
        value={pathname}
        onChange={(event) => router.push(event.target.value)}
      >
        {docs.map((doc) => (
          <option key={doc.slug} value={doc.href}>
            {doc.title}
          </option>
        ))}
      </select>

      <nav className="hidden md:block">
        <div className="mb-4 flex items-center gap-2">
          <BrandMark size={22} />
          <p className="m-0 text-xs font-medium uppercase tracking-wider text-muted">
            Language
          </p>
        </div>
        <ul className="flex flex-col gap-0.5">
          {docs.map((doc) => {
            const active = pathname === doc.href;
            return (
              <li key={doc.slug}>
                <Link
                  href={doc.href}
                  className={`block rounded-md px-2.5 py-1.5 text-sm no-underline transition-colors hover:no-underline ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-primary/10 hover:text-foreground"
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
