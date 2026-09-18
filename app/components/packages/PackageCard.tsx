import Link from "next/link";
import {
    formatDownloads,
    formatRelativeDate,
    packagePath,
    type PackageSummary,
} from "../../lib/packages";

interface PackageCardProps {
  pkg: PackageSummary;
}

export default function PackageCard({ pkg }: PackageCardProps) {
  return (
    <Link
      href={packagePath(pkg.name)}
      className="panel panel-interactive group flex h-full flex-col gap-3 p-5 no-underline"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 truncate font-mono text-sm font-medium text-foreground transition-colors group-hover:text-primary">
          {pkg.name}
        </p>
        {pkg.latestVersion ? (
          <span className="shrink-0 font-mono text-[11px] text-muted">
            {pkg.latestVersion}
          </span>
        ) : null}
      </div>

      {pkg.displayName !== pkg.name ? (
        <p className="m-0 truncate text-xs text-muted">{pkg.displayName}</p>
      ) : null}

      <p className="m-0 flex-1 text-sm leading-6 text-muted-foreground">
        {pkg.summary || "No summary published yet."}
      </p>

      {pkg.keywords.length > 0 ? (
        <p className="m-0 truncate font-mono text-[11px] text-muted">
          {pkg.keywords.slice(0, 4).join("  ·  ")}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-muted pt-3 text-[11px] tracking-[0.12em] text-muted uppercase">
        <span>{formatDownloads(pkg.downloads)} downloads</span>
        {pkg.license ? <span>{pkg.license}</span> : null}
        {pkg.updatedAt ? <span>updated {formatRelativeDate(pkg.updatedAt)}</span> : null}
      </div>
    </Link>
  );
}
