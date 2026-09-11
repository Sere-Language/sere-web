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
      aria-current={active ? "page" : undefined}
      className={`nav-item shrink-0 whitespace-nowrap px-2.5 py-2 text-sm sm:px-3.5 ${
        active ? "nav-item-active" : ""
      }`}
    >
      {children}
    </Link>
  );
}
