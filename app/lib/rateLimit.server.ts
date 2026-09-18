/**
 * Rate limiting for the registry APIs.
 *
 * Counters live in Postgres so limits hold across every serverless instance.
 * If the shared store is unreachable the limiter falls back to a per-instance
 * window rather than rejecting every request — availability first, but a
 * single-instance deployment still cannot be hammered.
 */

import { clientIp, hashIp } from "./security.server";
import { getSupabaseAdminClient } from "./supabase/server";

export interface RateLimitRule {
  name: string;
  max: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  signup: { name: "signup", max: 5, windowSeconds: 3600 },
  login: { name: "login", max: 10, windowSeconds: 900 },
  session: { name: "session", max: 30, windowSeconds: 900 },
  resend: { name: "resend", max: 3, windowSeconds: 3600 },
  tokenCreate: { name: "token-create", max: 20, windowSeconds: 3600 },
  publish: { name: "publish", max: 30, windowSeconds: 3600 },
  publishIp: { name: "publish-ip", max: 120, windowSeconds: 3600 },
  read: { name: "read", max: 240, windowSeconds: 60 },
  download: { name: "download", max: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryWindows = new Map<string, MemoryEntry>();

function pruneMemory(now: number): void {
  if (memoryWindows.size < 5000) return;
  for (const [key, entry] of memoryWindows) {
    if (entry.resetAt <= now) memoryWindows.delete(key);
  }
}

function memoryCheck(bucket: string, rule: RateLimitRule): RateLimitVerdict {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const existing = memoryWindows.get(bucket);

  if (!existing || existing.resetAt <= now) {
    pruneMemory(now);
    memoryWindows.set(bucket, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      limit: rule.max,
      remaining: rule.max - 1,
      retryAfterSeconds: rule.windowSeconds,
    };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 0);

  return {
    allowed: existing.count <= rule.max,
    limit: rule.max,
    remaining: Math.max(rule.max - existing.count, 0),
    retryAfterSeconds,
  };
}

/**
 * Counts one hit against `subject` for the given rule.
 *
 * `subject` should already be a stable, non-sensitive identity: a hashed IP, a
 * token prefix, or a developer id. It is hashed again before becoming a bucket
 * key so the table never holds raw values.
 */
export async function checkRateLimit(
  rule: RateLimitRule,
  subject: string,
): Promise<RateLimitVerdict> {
  const bucket = `${rule.name}:${(await hashIp(subject)).slice(0, 24)}`;
  const admin = getSupabaseAdminClient();

  if (admin) {
    try {
      const { data, error } = await admin.rpc("consume_rate_limit", {
        p_bucket: bucket,
        p_window_seconds: rule.windowSeconds,
        p_max_hits: rule.max,
      });

      if (!error) {
        const row = (Array.isArray(data) ? data[0] : data) as
          | { allowed?: unknown; remaining?: unknown; retry_after?: unknown }
          | null
          | undefined;

        if (row) {
          return {
            allowed: row.allowed === true,
            limit: rule.max,
            remaining: Number(row.remaining ?? 0) || 0,
            retryAfterSeconds: Number(row.retry_after ?? 0) || 0,
          };
        }
      }
    } catch {
      // Fall through to the in-process window.
    }
  }

  return memoryCheck(bucket, rule);
}

export async function checkIpRateLimit(
  request: Request,
  rule: RateLimitRule,
): Promise<RateLimitVerdict> {
  return checkRateLimit(rule, clientIp(request));
}

export function rateLimitHeaders(verdict: RateLimitVerdict): Record<string, string> {
  return {
    "ratelimit-limit": String(verdict.limit),
    "ratelimit-remaining": String(verdict.remaining),
    "ratelimit-reset": String(verdict.retryAfterSeconds),
  };
}

/** 429 response with the standard headers a client needs to back off. */
export function rateLimitedResponse(verdict: RateLimitVerdict, message: string): Response {
  return Response.json(
    { error: message, retryAfterSeconds: verdict.retryAfterSeconds },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(verdict),
        "retry-after": String(verdict.retryAfterSeconds),
        "cache-control": "no-store",
      },
    },
  );
}
