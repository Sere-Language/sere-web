/**
 * DELETE /api/developers/tokens/:id — revoke a token.
 *
 * Revoking is a soft delete (revoked_at) so the audit trail keeps its subject.
 */

import { recordAudit } from "@/app/lib/audit.server";
import { requireDeveloper, revokeDeveloperToken } from "@/app/lib/developers.server";
import { clientIp, hashIp, isSameOriginRequest, jsonResponse } from "@/app/lib/security.server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  }

  const session = await requireDeveloper();
  if (!session) return jsonResponse({ error: "Sign in to manage publish tokens." }, 401);

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return jsonResponse({ error: "That token id is not valid." }, 400);
  }

  const revoked = await revokeDeveloperToken(session, id);
  if (!revoked) {
    return jsonResponse({ error: "Could not revoke that token." }, 400);
  }

  await recordAudit({
    developerId: session.developer.id,
    kind: "token.revoked",
    subject: id,
    ipHash: await hashIp(clientIp(request)),
  });

  return jsonResponse({ ok: true, id });
}
