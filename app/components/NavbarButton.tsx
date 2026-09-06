"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarButtonProps {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}export default function NavbarButton({ href, exact = false, children }: NavbarButtonProps) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-2 sm:px-3.5 text-sm no-underline transition-all duration-150 hover:no-underline ${
        active
          ? "bg-secondary border border-secondary-border text-foreground shadow-sm"
          : "text-muted hover:border-border hover:bg-secondary hover:text-foreground hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0"
      }`}
    >
      {children}
    </Link>
  );
}