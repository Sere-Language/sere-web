"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isProjectEditorPath } from "@/app/lib/routes";
import BrandMark from "./BrandMark";

export default function Footer() {
  const pathname = usePathname();

  if (isProjectEditorPath(pathname)) {
    return null;
  }

  return (
    <footer className="border-t border-border-muted mt-16" style={{
      borderTopColor: "var(--color-border-muted)",
      background: "linear-gradient(180deg, transparent 0%, rgba(12, 14, 16, 0.5) 100%)"
    }}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm text-muted no-underline hover:text-primary hover:no-underline transition-colors"
        >
          <BrandMark alt="" size={28} />
          <span className="font-medium tracking-tight">Sere</span>
        </Link>
        <nav className="flex items-center gap-4 text-xs text-muted">
          <Link href="https://github.com/Sere-Language/sere" className="text-muted hover:text-primary hover:no-underline transition-colors">
            GitHub
          </Link>
          <Link href="/docs" className="text-muted hover:text-primary hover:no-underline transition-colors">
            Docs
          </Link>
          <Link href="/community" className="text-muted hover:text-primary hover:no-underline transition-colors">
            Community
          </Link>
        </nav>
      </div>
    </footer>
  );
}
