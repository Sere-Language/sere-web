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
    <nav className="sticky top-0 z-30 border-b border-border bg-surface shadow-sm">
      <div
        className={`mx-auto flex w-full justify-between gap-2 ${compact ? "items-center" : "flex-col items-start sm:flex-row sm:items-center"} ${
          fullWidth ? "max-w-none px-4" : "max-w-6xl px-4 sm:px-6"
        } ${compact ? "py-1.5" : "py-3"}`}
        style={{
          background: "linear-gradient(180deg, #0c0e10 0%, #0a0c0e 100%)"
        }}
      >
        <Link
          href={href}
          className="flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground no-underline hover:text-primary transition-colors duration-200 group"
        >
          <BrandMark alt="" size={compact ? 24 : 30} priority className="transition-transform duration-300 group-hover:scale-105" />
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
