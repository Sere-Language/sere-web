/**
 * POST /api/developers/logout — end the session.
 */

import { signOutDeveloper } from "@/app/lib/developers.server";
import { isSameOriginRequest, jsonResponse } from "@/app/lib/security.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  }

  await signOutDeveloper();
  return jsonResponse({ ok: true });
}
