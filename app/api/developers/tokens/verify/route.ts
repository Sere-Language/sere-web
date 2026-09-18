/**
 * POST /api/developers/tokens/verify — check a publish token without publishing.
 *
 * The CLI asks developers to run `sere login <token>`, so when a publish is
 * refused this is the quickest way to find out whether the value that was stored
 * is the token, the token's public prefix, or something else entirely.
 *
 * Auth: `Authorization: Bearer <token>`. Nothing is written.
 */

import { describeTokenFailure, tokenPrefix, verifyPublishToken } from "@/app/lib/apiTokens.server";
import { RATE_LIMITS, checkIpRateLimit, rateLimitedResponse } from "@/app/lib/rateLimit.server";
import { isSameOriginRequest, jsonResponse } from "@/app/lib/security.server";
import { registryStatus, supabaseEnv } from "@/app/lib/supabase/server";
import type { NextRequest } from "next/server";

/** Host only — never the key. Lets a caller spot a token from another project. */
function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  }

  const limit = await checkIpRateLimit(request, RATE_LIMITS.session);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many checks. Wait a few minutes and try again.");
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  const verified = await verifyPublishToken(bearer);

  if (!verified.ok) {
    const failure = describeTokenFailure(verified);
    return jsonResponse(
      {
        valid: false,
        reason: verified.reason,
        prefix: bearer ? tokenPrefix(bearer) : null,
        error: failure.error,
      },
      failure.status,
    );
  }

  const env = supabaseEnv();
    const status = registryStatus();

  return jsonResponse({
    valid: true,
    scope: verified.scope,
    tokenId: verified.tokenId,
    developerId: verified.developerId,
      // Capability flags only. `publishDiagnosis` is deliberately left out: this
      // route answers anyone holding a token, and the diagnosis names variables.
      deployment: {
          supabase: status.supabase,
          serviceRole: status.serviceRole,
          sharedPublishToken: status.sharedPublishToken,
          // The URL is public — it ships in every page — and comparing the host is
          // the fastest way to spot a token made against a different project.
          supabaseHost: env ? safeHost(env.url) : null,
      },
  });
}
