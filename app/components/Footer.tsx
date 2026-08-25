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
    <footer className="border-t border-border-muted">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted no-underline hover:text-primary hover:no-underline"
        >
          <BrandMark size={28} />
          Sere
        </Link>
        <p className="m-0 text-xs text-muted">Simple. Compiled. Powerful.</p>
      </div>
    </footer>
  );
}
