/**
 * GET /api/packages/:name — one package with every published version.
 */

import { getPackage, packageDownloadUrl } from "@/app/lib/packageRegistry.server";
import { packageApiPath, packageDownloadPath, packageInstallCommand } from "@/app/lib/packages";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ name: string }>;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  const { name } = await context.params;
  const requested = decodeURIComponent(name);
  const pkg = await getPackage(requested);

  if (!pkg) {
    return json({ error: `No package named "${requested}".` }, 404);
  }

  return json({
    package: {
      ...pkg,
      url: packageApiPath(pkg.name),
      install: packageInstallCommand(pkg.name, pkg.latestVersion),
      latestDownload: packageDownloadPath(pkg.name, pkg.latestVersion),
      versions: pkg.versions.map((version) => ({
        ...version,
        install: packageInstallCommand(pkg.name, version.version),
        download: packageDownloadPath(pkg.name, version.version),
        downloadUrl: packageDownloadUrl(version.tarballPath),
      })),
    },
  });
}
