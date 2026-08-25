"use client";

import Button from "./Button";

interface HomeHeroActionsProps {
  downloadHref: string;
  downloadLabel: string;
}

export default function HomeHeroActions({
  downloadHref,
  downloadLabel,
}: HomeHeroActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button href={downloadHref} variant="ghost" className="px-4 py-2">
        {downloadLabel}
      </Button>
      <Button href="/docs" variant="ghost" className="px-4 py-2">
        Docs
      </Button>
    </div>
  );
}
