/**
 * GET  /api/packages/:name/download?version=…&stream=1
 * HEAD /api/packages/:name/download?version=…
 *
 * Downloads a package without needing to know the storage layout.
 *
 *   version   exact ("1.2.3"), partial ("1", "1.2") or "latest" (the default)
 *   stream=1  proxy the bytes through this endpoint instead of redirecting
 *
 * Every response carries `X-Package-Version`, `X-Checksum-Sha256` and
 * `X-Package-Bytes`, and is cached immutably. GET counts as a download; HEAD
 * does not, so a client can check size and checksum before committing.
 */

import { handleDownload, wantsStream } from "@/app/lib/packageDownload.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ name: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { name } = await context.params;

  return handleDownload(
    request,
    { name, selector: request.nextUrl.searchParams.get("version") },
    { count: true, stream: wantsStream(request) },
  );
}

export async function HEAD(request: NextRequest, context: RouteContext): Promise<Response> {
  const { name } = await context.params;

  return handleDownload(
    request,
    { name, selector: request.nextUrl.searchParams.get("version") },
    { count: false, stream: false },
  );
}
