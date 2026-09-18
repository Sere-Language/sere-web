/**
 * POST /api/developers/resend — send the confirmation email again.
 *
 * Exists because a confirmation email can be lost, rate limited or never sent
 * at all (an address that already has an account gets nothing). The response is
 * the same either way, so this cannot be used to check whether an address is
 * registered.
 */

import { recordAudit } from "@/app/lib/audit.server";
import { resendConfirmationEmail } from "@/app/lib/developers.server";
import { checkIpRateLimit, RATE_LIMITS, rateLimitedResponse } from "@/app/lib/rateLimit.server";
import { clientIp, hashIp, isSameOriginRequest, jsonResponse, safeText } from "@/app/lib/security.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  }

  const limit = await checkIpRateLimit(request, RATE_LIMITS.resend);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many emails requested. Wait a few minutes.");
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Send a JSON body." }, 400);
  }

  const email = safeText(payload.email, 254);
  const result = await resendConfirmationEmail(email);

  await recordAudit({
    kind: "developer.confirmation_resent",
    subject: email,
    ipHash: await hashIp(clientIp(request)),
    metadata: { delivered: result.ok },
  });

  if (!result.ok) return jsonResponse({ error: result.error }, 502);

  return jsonResponse({
    ok: true,
    message: "If that address still needs confirming, a new link is on its way.",
  });
}
