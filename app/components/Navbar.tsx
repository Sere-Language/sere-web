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
    <nav className="sticky top-0 z-20 border-b border-white/6 bg-background/72 backdrop-blur-xl">
      <div
        className={`mx-auto flex w-full items-center justify-between gap-3 ${
          fullWidth ? "max-w-none px-4" : "max-w-6xl px-6"
        } ${compact ? "py-1.5" : "py-3"}`}
      >
        <Link
          href={href}
          className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-foreground no-underline hover:text-primary hover:no-underline"
        >
          <BrandMark size={compact ? 24 : 30} priority />
          {label}
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center gap-0.5 overflow-x-auto">{children}</div>
          {aside}
        </div>
      </div>
    </nav>
  );
}
