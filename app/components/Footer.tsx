import Link from "next/link";
import BrandMark from "./BrandMark";

export default function Footer() {
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
