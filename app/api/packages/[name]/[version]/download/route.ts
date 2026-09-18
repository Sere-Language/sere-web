/**
 * GET  /api/packages/:name/:version/download?stream=1
 * HEAD /api/packages/:name/:version/download
 *
 * Downloads one exact version. This is the URL every package page and every
 * install command resolves to, so it is the one to pin in a lockfile.
 *
 * The version segment is literal here — partial selectors ("1", "1.2") and
 * "latest" belong to `/api/packages/:name/download`. `stream=1` proxies the
 * bytes instead of redirecting to the stored archive.
 */

import { handleDownload, wantsStream } from "@/app/lib/packageDownload.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ name: string; version: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { name, version } = await context.params;

  return handleDownload(
    request,
    { name, selector: decodeURIComponent(version) },
    { count: true, stream: wantsStream(request) },
  );
}

export async function HEAD(request: NextRequest, context: RouteContext): Promise<Response> {
  const { name, version } = await context.params;

  return handleDownload(
    request,
    { name, selector: decodeURIComponent(version) },
    { count: false, stream: false },
  );
}
