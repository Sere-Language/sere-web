"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
    DEFAULT_PACKAGE_SORT,
    PACKAGE_SORTS,
    filterPackages,
    sortPackages,
    type PackageSort,
    type PackageSummary,
} from "../../lib/packages";
import PackageCard from "./PackageCard";

interface PackageExplorerProps {
  packages: PackageSummary[];
  registryConfigured: boolean;
}

export default function PackageExplorer({
  packages,
  registryConfigured,
}: PackageExplorerProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PackageSort>(DEFAULT_PACKAGE_SORT);

  const visible = useMemo(
    () => sortPackages(filterPackages(packages, query), sort, query),
    [packages, query, sort],
  );

  const searching = query.trim().length > 0;
  const activeSort = PACKAGE_SORTS.find((option) => option.value === sort);

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar — ruled, not boxed. */}
      <div className="flex flex-col gap-5 border-b border-border pb-4 lg:flex-row lg:items-baseline lg:justify-between lg:gap-12">
        <div className="flex w-full items-center gap-2.5 border-b border-transparent pb-1.5 text-muted transition-colors focus-within:border-primary focus-within:text-primary lg:max-w-md">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7" cy="7" r="4.25" />
            <path d="M10.25 10.25 13.5 13.5" strokeLinecap="round" />
          </svg>
          <label className="sr-only" htmlFor="package-search">
            Search packages
          </label>
          <input
            id="package-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, keyword, or summary"
            autoComplete="off"
            spellCheck={false}
            className="field-bare w-full text-sm"
          />
          {searching ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-tab shrink-0 text-[10px] tracking-[0.16em] text-muted uppercase"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="text-[11px] tracking-[0.2em] text-muted uppercase">
            Sort
          </span>
          <div
            role="group"
            aria-label="Sort packages"
            className="flex flex-wrap items-baseline gap-x-4 gap-y-2"
          >
            {PACKAGE_SORTS.map((option) => {
              const active = option.value === sort;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  aria-pressed={active}
                  title={option.hint}
                  className={`text-tab text-[13px] ${
                    active ? "text-foreground" : "text-muted"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="m-0 text-[11px] tracking-[0.18em] text-muted uppercase">
          {searching
            ? `${visible.length} of ${packages.length} match "${query.trim()}"`
            : `${packages.length} ${packages.length === 1 ? "package" : "packages"}`}
        </p>
        {activeSort && !searching ? (
          <p className="m-0 text-xs text-muted/80 sm:max-w-sm sm:text-right">
            {activeSort.hint}
          </p>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((pkg) => (
            <PackageCard key={pkg.name} pkg={pkg} />
          ))}
        </div>
      ) : (
        <EmptyState
          registryConfigured={registryConfigured}
          hasPackages={packages.length > 0}
          query={query.trim()}
          onClear={() => setQuery("")}
        />
      )}
    </div>
  );
}

function EmptyState({
  registryConfigured,
  hasPackages,
  query,
  onClear,
}: {
  registryConfigured: boolean;
  hasPackages: boolean;
  query: string;
  onClear: () => void;
}) {
  if (query && hasPackages) {
    return (
      <div className="border-l-2 border-border-strong py-0.5 pl-5">
        <p className="eyebrow">No matches</p>
        <p className="m-0 mt-3 text-sm text-muted-foreground">
          Nothing in the registry matches{" "}
          <span className="font-mono text-foreground">{query}</span>. Try a shorter
          term, or look at everything.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-tab mt-3 text-xs text-muted"
        >
          Show all packages
        </button>
      </div>
    );
  }

  if (!registryConfigured) {
    return (
      <div className="border-l-2 border-primary/50 py-0.5 pl-5">
        <p className="eyebrow">Registry offline</p>
        <p className="m-0 mt-3 text-sm text-muted-foreground">
          Nothing is listed because this deployment has no registry behind it yet.
        </p>
        <ol className="m-0 mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
          <li>
            Create a Supabase project, then paste <code>supabase/schema.sql</code> into the
            SQL editor.
          </li>
          <li>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env</code>.
          </li>
          <li>Reload this page — published packages appear here.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="border-l-2 border-primary/50 py-0.5 pl-5">
      <p className="eyebrow">Empty registry</p>
      <p className="m-0 mt-3 text-sm text-muted-foreground">
        The registry is live and waiting for its first upload. Create a developer
        account, issue a publish token, then push an archive:
      </p>
      <pre className="well m-0 overflow-x-auto px-4 py-3 text-xs leading-6">
        <code>{`curl -X POST https://sere-lang.com/api/packages \\
  -H "Authorization: Bearer $SERE_TOKEN" \\
  -F "name=hello-utils" \\
  -F "version=0.1.0" \\
  -F "summary=Small helpers" \\
  -F tarball=@hello-utils-0.1.0.tar.gz`}</code>
      </pre>
      <Link href="/developers" className="text-sm text-primary no-underline">
        Create a developer account
      </Link>
    </div>
  );
}
