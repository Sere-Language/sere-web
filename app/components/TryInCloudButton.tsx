"use client";

import { useAuthSession } from "@/app/hooks/useAuthSession";
import Button from "./Button";

export default function TryInCloudButton({ className }: { className?: string }) {
  const { signedIn, ready } = useAuthSession();
  const href = signedIn ? "/cloud/dashboard" : "/cloud";
  const label = ready && signedIn ? "Open cloud" : "Try in cloud";

  return (
    <Button
      href={href}
      className={`px-4 py-2 shadow-[0_0_28px_-6px_rgba(194,82,72,0.85)] ${className ?? ""}`}
    >
      {label}
    </Button>
  );
}
