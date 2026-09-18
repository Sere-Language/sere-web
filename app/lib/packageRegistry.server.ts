/**
 * Server-side reads for the package registry.
 *
 * Every function degrades to an empty result when Supabase is not configured or
 * the registry tables have not been created yet, so pages render an empty state
 * instead of failing the build.
 */

import { compareVersions, normalizePackageName } from "./packageManifest";
import {
    PACKAGE_DETAIL_COLUMNS,
    PACKAGE_MAX_LIMIT,
    PACKAGE_PAGE_SIZE,
    PACKAGE_SUMMARY_COLUMNS,
    PACKAGE_VERSION_COLUMNS,
    mapPackageDetail,
    mapPackageSummary,
    mapPackageVersion,
    type PackageDetail,
    type PackageSort,
    type PackageSummary,
    type PackageVersion,
} from "./packages";
import {
    PACKAGES_BUCKET,
    getSupabaseServerClient,
    isSupabaseConfigured,
} from "./supabase/server";

export interface ListPackagesOptions {
  query?: string;
  sort?: PackageSort;
  limit?: number;
}

function clampLimit(limit: number | undefined): number {
  const value = Math.trunc(limit ?? PACKAGE_PAGE_SIZE);
  if (!Number.isFinite(value)) return PACKAGE_PAGE_SIZE;
  return Math.min(Math.max(value, 1), PACKAGE_MAX_LIMIT);
}

/**
 * PostgREST reads `,` `(` `)` and `%` as filter syntax, so free text has to be
 * stripped before it goes into an `or` filter.
 */
function sanitizeFilterValue(value: string): string {
  return value.replace(/[%,()\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function orderFor(sort: PackageSort | undefined): { column: string; ascending: boolean } {
  switch (sort) {
    case "name":
      return { column: "name", ascending: true };
    case "recent":
      return { column: "updated_at", ascending: false };
    default:
      // Relevance is ranked in the browser; the server just ships the popular ones.
      return { column: "downloads", ascending: false };
  }
}

export async function listPackages(
  options: ListPackagesOptions = {},
): Promise<PackageSummary[]> {
  const client = getSupabaseServerClient();
  if (!client) return [];

  const limit = clampLimit(options.limit);
  const order = orderFor(options.sort);
  const needle = sanitizeFilterValue(options.query ?? "");

  try {
    const base = client
      .from("packages")
      .select(PACKAGE_SUMMARY_COLUMNS)
      .eq("published", true);

    const filtered = needle
      ? base.or(
          [
            `name.ilike.%${needle}%`,
            `display_name.ilike.%${needle}%`,
            `summary.ilike.%${needle}%`,
          ].join(","),
        )
      : base;

    const { data, error } = await filtered
      .order(order.column, { ascending: order.ascending })
      .order("name", { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);

    return (data ?? []).flatMap((row) => {
      const pkg = mapPackageSummary(row);
      return pkg ? [pkg] : [];
    });
  } catch {
    return [];
  }
}

export async function getPackage(name: string): Promise<PackageDetail | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const normalized = normalizePackageName(name);
  if (!normalized) return null;

  try {
    const { data, error } = await client
      .from("packages")
      .select(`${PACKAGE_DETAIL_COLUMNS}, package_versions (${PACKAGE_VERSION_COLUMNS})`)
      .eq("name", normalized)
      .eq("published", true)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const detail = mapPackageDetail(data);
    if (!detail) return null;

    const record = (data ?? {}) as Record<string, unknown>;
    const embedded = Array.isArray(record.package_versions) ? record.package_versions : [];

    const versions: PackageVersion[] = embedded
      .flatMap((row) => {
        const version = mapPackageVersion(row);
        return version && !version.yanked ? [version] : [];
      })
      .sort((a, b) => compareVersions(b.version, a.version));

    return { ...detail, versions };
  } catch {
    return null;
  }
}

export async function listPackageNames(limit = PACKAGE_MAX_LIMIT): Promise<string[]> {
  const packages = await listPackages({ limit });
  return packages.map((pkg) => pkg.name);
}

/** True when Supabase is configured well enough for the registry to answer. */
export function isRegistryConfigured(): boolean {
  return isSupabaseConfigured();
}

/**
 * Public CDN URL for a stored payload. The packages bucket is public-read, so
 * a plain URL is all a package manager needs to download a version.
 */
export function packageDownloadUrl(tarballPath: string): string | null {
  const client = getSupabaseServerClient();
  if (!client || !tarballPath) return null;
  return client.storage.from(PACKAGES_BUCKET).getPublicUrl(tarballPath).data.publicUrl;
}

/**
 * Bumps the download counter through a security-definer function, so it works
 * with the publishable key. Best effort — counting must never fail a download.
 */
export async function countPackageDownload(packageName: string): Promise<void> {
  const client = getSupabaseServerClient();
  if (!client) return;

  try {
    await client.rpc("package_download_count", { package_name: packageName });
  } catch {
    // Counting is best effort.
  }
}
