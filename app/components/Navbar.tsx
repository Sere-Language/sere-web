import Link from "next/link";
import BrandMark from "./BrandMark";

interface NavbarProps {
  href?: string;
  label?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
  compact?: boolean;
}

export default function Navbar({
  href = "/",
  label = "Sere",
  aside,
  children,
  fullWidth = false,
  compact = false,
}: NavbarProps) {
  return (
    <nav className="nav-shell sticky top-0 z-30">
      <div
        className={`relative mx-auto flex w-full justify-between gap-2 ${compact ? "items-center" : "flex-col items-start sm:flex-row sm:items-center"} ${
          fullWidth ? "max-w-none px-4" : "max-w-6xl px-4 sm:px-6"
        } ${compact ? "py-1.5" : "py-3"}`}
      >
        {/* Ember filament along the base of the bar */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

        <Link
          href={href}
          className="group flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground no-underline transition-colors duration-200 hover:text-primary"
        >
          <span className="relative flex items-center justify-center">
            <span className="pointer-events-none absolute inset-[-6px] rounded-full bg-primary/25 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
            <BrandMark
              alt=""
              size={compact ? 24 : 30}
              priority
              className="relative transition-transform duration-300 group-hover:scale-105"
            />
          </span>
          {label}
        </Link>
        <div className={`flex min-w-0 items-center gap-1 ${compact ? "" : "w-full sm:w-auto"}`}>
          <div className={`flex items-center gap-0.5 ${compact ? "overflow-x-auto" : "flex-wrap"}`}>{children}</div>
          {aside}
        </div>
      </div>
    </nav>
  );
}
