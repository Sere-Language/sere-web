/**
 * POST /api/developers/login — start a session.
 *
 * Rate limited per IP, and every failure returns the same message so the
 * endpoint cannot be used to discover which addresses have accounts.
 */

import { recordAudit } from "@/app/lib/audit.server";
import { signInDeveloper } from "@/app/lib/developers.server";
import { checkIpRateLimit, RATE_LIMITS, rateLimitedResponse } from "@/app/lib/rateLimit.server";
import { clientIp, hashIp, isSameOriginRequest, jsonResponse } from "@/app/lib/security.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  }

  const limit = await checkIpRateLimit(request, RATE_LIMITS.login);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many sign-in attempts. Wait a few minutes.");
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Send a JSON body." }, 400);
  }

  const result = await signInDeveloper({ email: payload.email, password: payload.password });

  if (!result.ok) {
    await recordAudit({
      kind: "developer.login_failed",
      subject: typeof payload.email === "string" ? payload.email.slice(0, 200) : null,
      ipHash: await hashIp(clientIp(request)),
    });
    return jsonResponse({ error: result.error }, 401);
  }

  await recordAudit({
    kind: "developer.login",
    subject: result.email,
    ipHash: await hashIp(clientIp(request)),
  });

  return jsonResponse({ ok: true, email: result.email });
}
