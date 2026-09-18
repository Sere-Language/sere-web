/**
 * Package registry types and pure helpers.
 *
 * This module is deliberately free of any Supabase import so client components
 * can search, sort and format without pulling the SDK into the browser bundle.
 * Server reads live in `packageRegistry.server.ts`.
 */

export type PackageSort = "downloads" | "recent" | "name" | "relevance";

export interface PackageSortOption {
  value: PackageSort;
  label: string;
  hint: string;
}

export const PACKAGE_SORTS: readonly PackageSortOption[] = [
  {
    value: "downloads",
    label: "Most downloaded",
    hint: "The packages the most projects already depend on.",
  },
  {
    value: "recent",
    label: "Recently updated",
    hint: "Newest release first. Good for watching a package you already use.",
  },
  {
    value: "name",
    label: "Name",
    hint: "Alphabetical, for when you know what you are looking for.",
  },
  {
    value: "relevance",
    label: "Best match",
    hint: "Ranks name matches above keyword and summary matches.",
  },
] as const;

export const DEFAULT_PACKAGE_SORT: PackageSort = "downloads";

export const SEARCH_SORT: PackageSort = "relevance";

export interface PackageSummary {
  name: string;
  displayName: string;
  summary: string;
  license: string | null;
  keywords: string[];
  author: string | null;
  latestVersion: string | null;
  versionsCount: number;
  downloads: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PackageVersion {
  version: string;
  entry: string | null;
  tarballPath: string;
  tarballBytes: number;
  checksumSha256: string | null;
  readme: string | null;
  yanked: boolean;
  publishedAt: string | null;
}

export interface PackageDetail extends PackageSummary {
  description: string;
  repositoryUrl: string | null;
  homepageUrl: string | null;
  versions: PackageVersion[];
}

/** Column lists kept in one place so every read returns the same shape. */
export const PACKAGE_SUMMARY_COLUMNS =
  "name, display_name, summary, license, keywords, author, latest_version, versions_count, downloads, created_at, updated_at";

export const PACKAGE_DETAIL_COLUMNS =
  `${PACKAGE_SUMMARY_COLUMNS}, description, repository_url, homepage_url`;

export const PACKAGE_VERSION_COLUMNS =
  "version, entry, tarball_path, tarball_bytes, checksum_sha256, readme, yanked, published_at";

export const PACKAGE_PAGE_SIZE = 24;
export const PACKAGE_MAX_LIMIT = 100;

/* ------------------------------------------------------------------ */
/* Paths and commands                                                  */
/* ------------------------------------------------------------------ */

export function packagePath(name: string): string {
  return `/libraries/${encodeURIComponent(name)}`;
}

export function packageApiPath(name: string): string {
  return `/api/packages/${encodeURIComponent(name)}`;
}

/**
 * Canonical download endpoint. Without a version it resolves to `latest`, and
 * partial versions ("1", "1.2") resolve to the newest release that matches.
 */
export function packageDownloadPath(name: string, version?: string | null): string {
  return version
    ? `${packageApiPath(name)}/${encodeURIComponent(version)}/download`
    : `${packageApiPath(name)}/download`;
}

export function packageInstallCommand(name: string, version?: string | null): string {
  return version ? `sere add ${name}@${version}` : `sere add ${name}`;
}

/* ------------------------------------------------------------------ */
/* Row mapping — rows arrive untyped from PostgREST                    */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readKeywords(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.toLowerCase());
}

function readFlag(row: Record<string, unknown>, key: string): boolean {
  return row[key] === true;
}

export function mapPackageSummary(row: unknown): PackageSummary | null {
  const record = asRecord(row);
  if (!record) return null;

  const name = readText(record, "name");
  if (!name) return null;

  return {
    name,
    displayName: readText(record, "display_name") ?? name,
    summary: readText(record, "summary") ?? "",
    license: readText(record, "license"),
    keywords: readKeywords(record, "keywords"),
    author: readText(record, "author"),
    latestVersion: readText(record, "latest_version"),
    versionsCount: readNumber(record, "versions_count"),
    downloads: readNumber(record, "downloads"),
    createdAt: readText(record, "created_at"),
    updatedAt: readText(record, "updated_at"),
  };
}

export function mapPackageDetail(row: unknown): Omit<PackageDetail, "versions"> | null {
  const summary = mapPackageSummary(row);
  const record = asRecord(row);
  if (!summary || !record) return null;

  return {
    ...summary,
    description: readText(record, "description") ?? "",
    repositoryUrl: readText(record, "repository_url"),
    homepageUrl: readText(record, "homepage_url"),
  };
}

export function mapPackageVersion(row: unknown): PackageVersion | null {
  const record = asRecord(row);
  if (!record) return null;

  const version = readText(record, "version");
  if (!version) return null;

  return {
    version,
    entry: readText(record, "entry"),
    tarballPath: readText(record, "tarball_path") ?? "",
    tarballBytes: readNumber(record, "tarball_bytes"),
    checksumSha256: readText(record, "checksum_sha256"),
    readme: readText(record, "readme"),
    yanked: readFlag(record, "yanked"),
    publishedAt: readText(record, "published_at"),
  };
}

/* ------------------------------------------------------------------ */
/* Search and sort — run in the browser so typing feels instant         */
/* ------------------------------------------------------------------ */

function searchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function haystack(pkg: PackageSummary): string {
  return [
    pkg.name,
    pkg.displayName,
    pkg.summary,
    pkg.author ?? "",
    pkg.license ?? "",
    pkg.keywords.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function filterPackages(
  packages: PackageSummary[],
  query: string,
): PackageSummary[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return packages;

  return packages.filter((pkg) => {
    const text = haystack(pkg);
    return terms.every((term) => text.includes(term));
  });
}

/** Higher is better. Exact name wins, then prefix, then keyword, then prose. */
function matchScore(pkg: PackageSummary, query: string): number {
  const terms = searchTerms(query);
  if (terms.length === 0) return 0;

  const name = pkg.name.toLowerCase();
  const display = pkg.displayName.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (name === term) score += 120;
    else if (name.startsWith(term)) score += 80;
    else if (name.includes(term)) score += 55;

    if (display !== name) {
      if (display === term) score += 60;
      else if (display.includes(term)) score += 25;
    }

    if (pkg.keywords.some((keyword) => keyword === term)) score += 40;
    else if (pkg.keywords.some((keyword) => keyword.includes(term))) score += 20;

    if (pkg.summary.toLowerCase().includes(term)) score += 10;
  }

  return score;
}

function updatedTime(pkg: PackageSummary): number {
  const stamp = pkg.updatedAt ?? pkg.createdAt;
  const parsed = stamp ? Date.parse(stamp) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortPackages(
  packages: PackageSummary[],
  sort: PackageSort,
  query = "",
): PackageSummary[] {
  const byName = (a: PackageSummary, b: PackageSummary) => a.name.localeCompare(b.name);
  const list = [...packages];

  if (sort === "relevance" && searchTerms(query).length > 0) {
    return list.sort(
      (a, b) =>
        matchScore(b, query) - matchScore(a, query) ||
        b.downloads - a.downloads ||
        byName(a, b),
    );
  }

  switch (sort) {
    case "name":
      return list.sort(byName);
    case "recent":
      return list.sort((a, b) => updatedTime(b) - updatedTime(a) || byName(a, b));
    default:
      return list.sort((a, b) => b.downloads - a.downloads || byName(a, b));
  }
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatDownloads(count: number): string {
  if (count < 1000) return String(count);

  const units = ["k", "M", "B"] as const;
  let value = count / 1000;
  let unit = 0;

  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }

  return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")}${units[unit]}`;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const digits = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/** "3 days ago" style. Falls back to an absolute date past two weeks. */
export function formatRelativeDate(iso: string | null): string {
  if (!iso) return "";

  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";

  const deltaMs = Date.now() - time;
  const dayMs = 86_400_000;
  const days = Math.round(deltaMs / dayMs);

  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(time));
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(time));
}
