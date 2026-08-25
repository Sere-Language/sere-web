"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/app/lib/auth";
import { isProjectEditorPath } from "@/app/lib/routes";
import { useAuthSession } from "@/app/hooks/useAuthSession";
import Button from "./Button";
import Navbar from "./Navbar";
import NavbarButton from "./NavbarButton";
import TryInCloudButton from "./TryInCloudButton";

export default function SiteNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { email, signedIn, ready } = useAuthSession();
  const [signingOut, setSigningOut] = useState(false);
  const onCloud = pathname === "/cloud" || pathname.startsWith("/cloud/");
  const cloudNav = ready && signedIn && onCloud;
  const editor = isProjectEditorPath(pathname);

  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);

    if (!error) {
      router.push("/");
      router.refresh();
    }
  }

  if (cloudNav) {
    return (
      <Navbar
        href="/cloud/dashboard"
        label="Sere Cloud"
        fullWidth={editor}
        compact={editor}
        aside={
          <div className="flex shrink-0 items-center gap-2 border-l border-border-muted pl-3">
            <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
            <span className="hidden max-w-48 truncate text-xs text-muted sm:inline">
              {email}
            </span>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              disabled={signingOut}
              className="px-2 py-1 text-xs"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        }
      >
        {editor ? null : (
          <NavbarButton href="/cloud" exact>
            Overview
          </NavbarButton>
        )}
        <NavbarButton href="/cloud/dashboard">Dashboard</NavbarButton>
        <NavbarButton href="/cloud/projects">Projects</NavbarButton>
      </Navbar>
    );
  }

  return (
    <Navbar
      aside={
        onCloud ? undefined : (
          <TryInCloudButton className="hidden px-3 py-1 text-xs sm:inline-flex" />
        )
      }
    >
      <NavbarButton href="/install">Install</NavbarButton>
      <NavbarButton href="/cloud">Cloud</NavbarButton>
      <NavbarButton href="/docs">Docs</NavbarButton>
      <NavbarButton href="/libraries">Libraries</NavbarButton>
      <NavbarButton href="/community">Community</NavbarButton>
      <NavbarButton href="/contribution">Contribution</NavbarButton>
    </Navbar>
  );
}
