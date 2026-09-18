/**
 * GET  /api/developers/session — who is signed in, if anyone.
 * POST /api/developers/session — accept a session handed over by the email
 *                                confirmation link and store it in httpOnly
 *                                cookies.
 *
 * The confirmation redirect arrives with the session in the URL fragment, which
 * never reaches the server — so the callback page posts it here. Tokens are
 * validated before being trusted, and cross-site posts are rejected so this
 * cannot be used to fix a stranger's session.
 */

import { recordAudit } from "@/app/lib/audit.server";
import { getCurrentDeveloper, listDeveloperTokens, requireDeveloper, writeSessionCookies } from "@/app/lib/developers.server";
import { checkIpRateLimit, RATE_LIMITS, rateLimitedResponse } from "@/app/lib/rateLimit.server";
import { clientIp, hashIp, isSameOriginRequest, jsonResponse, safeText } from "@/app/lib/security.server";
import { validateAccessToken } from "@/app/lib/supabase/session";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const developer = await getCurrentDeveloper();
  if (!developer) return jsonResponse({ signedIn: false });

  const session = await requireDeveloper();
  const tokens = session ? await listDeveloperTokens(session) : [];

  return jsonResponse({ signedIn: true, developer, tokens });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  }

  const limit = await checkIpRateLimit(request, RATE_LIMITS.session);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many attempts. Wait a few minutes.");
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Send a JSON body." }, 400);
  }

  const accessToken = safeText(payload.accessToken, 4096);
  const refreshToken = safeText(payload.refreshToken, 4096);
  if (!accessToken || !refreshToken) {
    return jsonResponse({ error: "That confirmation link is incomplete." }, 400);
  }

  const user = await validateAccessToken(accessToken);
  if (!user) {
    return jsonResponse({ error: "That confirmation link has expired. Sign in instead." }, 401);
  }

  const expiresIn = Number(payload.expiresIn);

  await writeSessionCookies({
    accessToken,
    refreshToken,
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
  });

  await recordAudit({
    developerId: user.id,
    kind: "developer.confirmed",
    subject: user.email,
    ipHash: await hashIp(clientIp(request)),
  });

  return jsonResponse({ ok: true, email: user.email });
}
