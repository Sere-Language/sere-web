"use client";

import BrandMark from "../BrandMark";

interface ProjectLoadingScreenProps {
  projectName: string;
  percent: number;
  label: string;
}

export default function ProjectLoadingScreen({
  projectName,
  percent,
  label,
}: ProjectLoadingScreenProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div className="flex h-full w-full items-center justify-center bg-transparent px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-lg border border-border bg-card px-8 py-10">
        <BrandMark size={56} priority className="opacity-90" />
        <div className="text-center">
          <p className="m-0 text-sm font-medium tracking-tight text-foreground">{projectName}</p>
          <p role="status" className="mt-1 m-0 text-xs text-muted">{label}</p>
        </div>
        <div className="w-full">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-border-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clamped}
            aria-label={label}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${clamped}%` }}
            />
          </div>
          <p className="mt-2 m-0 text-center font-mono text-[11px] text-muted">{clamped}%</p>
        </div>
      </div>
    </div>
  );
}
