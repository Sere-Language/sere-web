import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Forces a re-fetch of the GitHub releases catalog used by /install and /.
 *
 * Trigger this from a GitHub "release" webhook (or manually with curl):
 *   curl -X POST https://<site>/api/releases/sync
 */
export async function POST() {
  revalidateTag("releases", "max");
  return NextResponse.json({ success: true, revalidated: "releases" });
}
