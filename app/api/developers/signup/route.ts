/**
 * POST /api/developers/signup — create a developer account.
 *
 * The response deliberately does not say whether the address was already
 * registered: with email confirmation on, both paths look identical.
 */

import { recordAudit } from "@/app/lib/audit.server";
import { signUpDeveloper } from "@/app/lib/developers.server";
import { checkIpRateLimit, RATE_LIMITS, rateLimitedResponse } from "@/app/lib/rateLimit.server";
import { clientIp, hashIp, isSameOriginRequest, jsonResponse } from "@/app/lib/security.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  }

  const limit = await checkIpRateLimit(request, RATE_LIMITS.signup);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many sign-up attempts from this network.");
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Send a JSON body." }, 400);
  }

  const result = await signUpDeveloper({
    email: payload.email,
    password: payload.password,
    handle: payload.handle,
  });

  if (!result.ok) return jsonResponse({ error: result.error }, 400);

  await recordAudit({
    // A distinct kind makes "no email arrived" obvious in the audit trail:
    // an address that already has an account is never sent a confirmation mail.
    kind: result.existingAccount ? "developer.signup_existing" : "developer.signup",
    subject: result.email,
    ipHash: await hashIp(clientIp(request)),
    metadata: {
      needsConfirmation: result.needsConfirmation,
      confirmationEmailSent: !result.existingAccount,
    },
  });

  return jsonResponse(
    {
      ok: true,
      needsConfirmation: result.needsConfirmation,
      email: result.email,
    },
    201,
  );
}
