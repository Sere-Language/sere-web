"use client";

import { isProjectEditorPath } from "@/app/lib/routes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "./BrandMark";

export default function Footer() {
  const pathname = usePathname();

  if (isProjectEditorPath(pathname)) {
    return null;
  }

  return (
    <footer className="relative mt-20 border-t border-border-muted">

      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.012] to-transparent" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-9">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-sm text-muted no-underline transition-colors hover:text-primary hover:no-underline"
        >
          <BrandMark alt="" size={28} className="transition-transform duration-300 group-hover:scale-105" />
          <span className="font-medium tracking-tight">Sere</span>
        </Link>
        <a href="https://smollaunch.com" target="_blank" rel="noopener">
  <img src="https://smollaunch.com/badges/featured-dark.svg" alt="Sere — Featured on Smol Launch" loading="lazy" width="250" height="60" />
</a>
<a href="https://www.launchit.site/launches/sere-language" target="_blank" rel="noopener">
  <img src="https://www.launchit.site/badges/launchit-dark.svg" alt="Sere Language - Featured on Launchit" width="200" height="54" />
</a>

        <nav className="flex items-center gap-1 text-xs text-muted">
          <Link href="https://github.com/Sere-Language/sere" className="rounded-md px-2.5 py-1.5 text-muted no-underline transition-colors hover:bg-white/[0.04] hover:text-foreground hover:no-underline">
            GitHub
          </Link>
          <Link href="/docs" className="rounded-md px-2.5 py-1.5 text-muted no-underline transition-colors hover:bg-white/[0.04] hover:text-foreground hover:no-underline">
            Docs
          </Link>
          <Link href="/community" className="rounded-md px-2.5 py-1.5 text-muted no-underline transition-colors hover:bg-white/[0.04] hover:text-foreground hover:no-underline">
            Community
          </Link>
        </nav>
      </div>
    </footer>
  );
}
