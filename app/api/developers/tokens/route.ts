/**
 * GET  /api/developers/tokens — list the caller's tokens (never the secrets).
 * POST /api/developers/tokens — mint a token. The plaintext is returned once.
 *
 * Both run as the signed-in developer, so row level security decides what is
 * visible. The secret is only ever stored as a SHA-256 hash.
 */

import { recordAudit } from "@/app/lib/audit.server";
import {
    createDeveloperToken,
    listDeveloperTokens,
    requireDeveloper,
} from "@/app/lib/developers.server";
import { checkRateLimit, RATE_LIMITS, rateLimitedResponse } from "@/app/lib/rateLimit.server";
import { clientIp, hashIp, isSameOriginRequest, jsonResponse } from "@/app/lib/security.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const UNAUTHORIZED = "Sign in to manage publish tokens.";

export async function GET(): Promise<Response> {
  const session = await requireDeveloper();
  if (!session) return jsonResponse({ error: UNAUTHORIZED }, 401);

  return jsonResponse({
    developer: {
      handle: session.developer.handle,
      displayName: session.developer.displayName,
      email: session.developer.email,
    },
    tokens: await listDeveloperTokens(session),
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  }

  const session = await requireDeveloper();
  if (!session) return jsonResponse({ error: UNAUTHORIZED }, 401);

  const limit = await checkRateLimit(RATE_LIMITS.tokenCreate, session.developer.id);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many tokens created recently. Try again later.");
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const outcome = await createDeveloperToken(session, payload.label, payload.expiresInDays);
  if (!outcome.ok) return jsonResponse({ error: outcome.error }, 400);

  await recordAudit({
    developerId: session.developer.id,
    kind: "token.created",
    subject: outcome.record.prefix,
    ipHash: await hashIp(clientIp(request)),
    metadata: { label: outcome.record.label, expiresAt: outcome.record.expiresAt },
  });

  // The only time the secret leaves the server.
  return jsonResponse({ token: outcome.token.token, record: outcome.record }, 201);
}
