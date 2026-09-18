/**
 * Audit trail for credential and publish events.
 *
 * Writes go through the service-role client and are best effort: a failure to
 * log must never fail the action the developer asked for.
 */

import { getSupabaseAdminClient } from "./supabase/server";

export interface AuditEntry {
  developerId?: string | null;
  /** Dotted event name, e.g. `token.created`, `package.published`. */
  kind: string;
  /** Non-sensitive identifier: a token prefix, a package name, an email. */
  subject?: string | null;
  ipHash?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  try {
    await admin.from("audit_log").insert({
      developer_id: entry.developerId ?? null,
      kind: entry.kind,
      subject: entry.subject ? entry.subject.slice(0, 200) : null,
      ip_hash: entry.ipHash ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch {
    // Logging is best effort.
  }
}
