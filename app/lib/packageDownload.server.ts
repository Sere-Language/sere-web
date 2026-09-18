/**
 * Serving package archives.
 *
 * A download resolves a selector — `latest`, an exact version, or a partial one
 * like `1.2` — to a stored object, then either redirects to it or streams it.
 *
 * The redirect is the default: the URL stays on this domain, the bytes come
 * straight from the CDN, and the archive never passes through the app. Add
 * `stream=1` to proxy the bytes instead, which is useful when a client wants the
 * file name and checksum from the same response.
 */

import type { NextRequest } from "next/server";
import { normalizePackageName } from "./packageManifest";
import { countPackageDownload, getPackage, packageDownloadUrl } from "./packageRegistry.server";
import type { PackageDetail, PackageVersion } from "./packages";
import {
    RATE_LIMITS,
    checkIpRateLimit,
    rateLimitHeaders,
    rateLimitedResponse,
} from "./rateLimit.server";
import { jsonResponse } from "./security.server";

export interface ResolvedDownload {
  pkg: PackageDetail;
  version: PackageVersion;
  url: string;
}

export type DownloadResolution =
  | ({ ok: true } & ResolvedDownload)
  | { ok: false; status: number; error: string; versions?: string[] };

/** Version bytes are immutable, so they can be cached indefinitely. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

/**
 * Picks a version from a selector:
 *
 *   omitted / `latest` / `*`  the newest release, preferring non-prereleases
 *   `1.2.3`                   exactly that version
 *   `1` / `1.2`               the newest release with that prefix
 */
export function selectVersion(
  versions: PackageVersion[],
  selector: string | null,
): PackageVersion | null {
  if (versions.length === 0) return null;

  const wanted = (selector ?? "").trim().toLowerCase();
  if (!wanted || wanted === "latest" || wanted === "*") {
    return versions.find((entry) => !entry.version.includes("-")) ?? versions[0] ?? null;
  }

  const exact = versions.find((entry) => entry.version.toLowerCase() === wanted);
  if (exact) return exact;

  if (/^\d+(\.\d+)?$/.test(wanted)) {
    const prefix = `${wanted}.`;
    return (
      versions.find(
        (entry) => entry.version.startsWith(prefix) && !entry.version.includes("-"),
      ) ?? null
    );
  }

  return null;
}

export async function resolveDownload(
  rawName: string,
  selector: string | null,
): Promise<DownloadResolution> {
  const name = normalizePackageName(decodeURIComponent(rawName));
  if (!name) return { ok: false, status: 400, error: "A package name is required." };

  const pkg = await getPackage(name);
  if (!pkg) return { ok: false, status: 404, error: `No package named "${name}".` };

  if (pkg.versions.length === 0) {
    return { ok: false, status: 404, error: `${pkg.name} has no published versions yet.` };
  }

  const version = selectVersion(pkg.versions, selector);
  if (!version) {
    return {
      ok: false,
      status: 404,
      error: `${pkg.name} has no version matching "${selector}".`,
      versions: pkg.versions.map((entry) => entry.version),
    };
  }

  const url = packageDownloadUrl(version.tarballPath);
  if (!url) {
    return {
      ok: false,
      status: 503,
      error: "Downloads are not configured on this deployment.",
    };
  }

  return { ok: true, pkg, version, url };
}

/** The stored file already carries its own name; fall back if it somehow does not. */
function fileNameFor(pkgName: string, version: PackageVersion): string {
  const stored = version.tarballPath.split("/").pop() ?? "";
  return stored.includes(".") ? stored : `${pkgName}-${version.version}.tar.gz`;
}

export function downloadHeaders(
  resolution: ResolvedDownload,
  extra: Record<string, string> = {},
): Record<string, string> {
  const { pkg, version } = resolution;

  const headers: Record<string, string> = {
    "cache-control": IMMUTABLE_CACHE,
    "x-package-name": pkg.name,
    "x-package-version": version.version,
    ...extra,
  };

  // The checksum doubles as a strong validator: the bytes cannot change.
  if (version.checksumSha256) {
    headers["x-checksum-sha256"] = version.checksumSha256;
    headers.etag = `"${version.checksumSha256}"`;
  }
  if (version.tarballBytes > 0) {
    headers["x-package-bytes"] = String(version.tarballBytes);
  }

  return headers;
}

export async function downloadResponse(
  resolution: ResolvedDownload,
  options: { stream: boolean; extraHeaders?: Record<string, string> },
): Promise<Response> {
  const { pkg, version, url } = resolution;
  const headers = downloadHeaders(resolution, options.extraHeaders);

  if (!options.stream) {
    return new Response(null, { status: 302, headers: { ...headers, location: url } });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return jsonResponse({ error: "The stored archive could not be read." }, 502);
  }

  const length = upstream.headers.get("content-length");

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...headers,
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${fileNameFor(pkg.name, version)}"`,
      ...(length ? { "content-length": length } : {}),
    },
  });
}

/**
 * Shared handler for both download routes.
 *
 * `count` is false for HEAD so a probe does not inflate the counter.
 */
export async function handleDownload(
  request: NextRequest,
  target: { name: string; selector: string | null },
  options: { count: boolean; stream: boolean },
): Promise<Response> {
  const limit = await checkIpRateLimit(request, RATE_LIMITS.download);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many downloads. Slow down and try again.");
  }

  const resolution = await resolveDownload(target.name, target.selector);
  if (!resolution.ok) {
    return jsonResponse(
      {
        error: resolution.error,
        ...(resolution.versions ? { versions: resolution.versions } : {}),
      },
      resolution.status,
    );
  }

  if (options.count) {
    await countPackageDownload(resolution.pkg.name);
  }

  return downloadResponse(resolution, {
    stream: options.stream,
    extraHeaders: rateLimitHeaders(limit),
  });
}

export function wantsStream(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get("stream") === "1";
}
