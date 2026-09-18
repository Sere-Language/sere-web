/**
 * GET  /api/packages/:name/:version  — metadata plus a download URL.
 * POST /api/packages/:name/:version  — record an install, returns the URL.
 *
 * The POST exists so a package manager can count a download without needing
 * write access to the registry tables (it calls a security-definer function).
 */

import {
    countPackageDownload,
    getPackage,
    packageDownloadUrl,
} from "@/app/lib/packageRegistry.server";
import {
    packageDownloadPath,
    packageInstallCommand,
    type PackageSummary,
    type PackageVersion,
} from "@/app/lib/packages";
import { RATE_LIMITS, checkIpRateLimit, rateLimitedResponse } from "@/app/lib/rateLimit.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ name: string; version: string }>;
}

type Resolution =
  | { ok: true; pkg: PackageSummary; version: PackageVersion }
  | { ok: false; status: number; error: string };

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function resolve(context: RouteContext): Promise<Resolution> {
  const params = await context.params;
  const name = decodeURIComponent(params.name);
  const wanted = decodeURIComponent(params.version);

  const pkg = await getPackage(name);
  if (!pkg) {
    return { ok: false, status: 404, error: `No package named "${name}".` };
  }

  const version = pkg.versions.find((entry) => entry.version === wanted);
  if (!version) {
    return {
      ok: false,
      status: 404,
      error: `${pkg.name} has no published version ${wanted}.`,
    };
  }

  return { ok: true, pkg, version };
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const limit = await checkIpRateLimit(request, RATE_LIMITS.download);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many requests. Slow down and try again.");
  }

  const resolved = await resolve(context);
  if (!resolved.ok) return json({ error: resolved.error }, resolved.status);

  const { pkg, version } = resolved;

  return json({
    name: pkg.name,
    version: version.version,
    summary: pkg.summary,
    license: pkg.license,
    entry: version.entry,
    bytes: version.tarballBytes,
    checksumSha256: version.checksumSha256,
    publishedAt: version.publishedAt,
    download: packageDownloadPath(pkg.name, version.version),
    downloadUrl: packageDownloadUrl(version.tarballPath),
    install: packageInstallCommand(pkg.name, version.version),
  });
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const limit = await checkIpRateLimit(request, RATE_LIMITS.download);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many requests. Slow down and try again.");
  }

  const resolved = await resolve(context);
  if (!resolved.ok) return json({ error: resolved.error }, resolved.status);

  const { pkg, version } = resolved;

  // Best effort: the counter uses a security-definer function so it works with
  // the publishable key, and a failure must not fail the caller.
  await countPackageDownload(pkg.name);

  return json({
    ok: true,
    name: pkg.name,
    version: version.version,
    downloads: pkg.downloads + 1,
    download: packageDownloadPath(pkg.name, version.version),
    downloadUrl: packageDownloadUrl(version.tarballPath),
  });
}
