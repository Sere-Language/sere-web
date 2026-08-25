"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarButtonProps {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}

export default function NavbarButton({ href, exact = false, children }: NavbarButtonProps) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm no-underline transition-colors hover:no-underline ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted hover:bg-primary/10 hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}