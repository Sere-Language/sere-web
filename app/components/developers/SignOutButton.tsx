"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    if (busy) return;
    setBusy(true);

    try {
      await fetch("/api/developers/logout", { method: "POST" });
      router.push("/developers");
      router.refresh();
    } catch {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
