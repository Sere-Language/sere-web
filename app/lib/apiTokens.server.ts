/**
 * API tokens — the credentials a developer uses to publish.
 *
 * Format: `sere_<prefix>_<secret>`
 *   prefix  8 random characters, stored in clear so a token can be found and
 *           displayed without keeping the secret around
 *   secret  256 bits of entropy, only ever stored as a SHA-256 hash
 *
 * Verification is a single indexed lookup on the prefix followed by a
 * constant-time hash comparison, so a wrong token costs one query and no
 * information leaks through timing.
 */

import { constantTimeEqual, randomToken, sha256Hex } from "./security.server";
import { describeRegistryError, getSupabaseAdminClient } from "./supabase/server";

const TOKEN_SCHEME = "sere";
const PREFIX_CHARS = 8;
const TOKEN_PATTERN = /^sere_([a-z0-9]{8})_([A-Za-z0-9_-]{20,})$/;

/**
 * Just the public part of a token, as the dashboard lists it — the value shown
 * in the table after creation, which is not usable as a credential.
 */
const PREFIX_ONLY_PATTERN = /^sere_[a-z0-9]{1,16}$/i;

export interface GeneratedToken {
  /** Shown to the developer once and never stored. */
  token: string;
  /** Public identifier safe to store, log and display, e.g. `sere_1a2b3c4d`. */
  prefix: string;
  hash: string;
}

export async function generateApiToken(): Promise<GeneratedToken> {
  const prefix = randomToken(8).replace(/[-_]/g, "a").slice(0, PREFIX_CHARS).toLowerCase();
  const secret = randomToken(32);
  const token = `${TOKEN_SCHEME}_${prefix}_${secret}`;

  return { token, prefix: `${TOKEN_SCHEME}_${prefix}`, hash: await sha256Hex(token) };
}

/**
 * Cleans up a presented token: shells and config files routinely add whitespace
 * or wrap a value in quotes, neither of which a token itself ever contains.
 */
export function normalizeToken(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "").trim();
}

/** The displayable prefix of a presented token, or null if it is malformed. */
export function tokenPrefix(token: string): string | null {
  const match = TOKEN_PATTERN.exec(normalizeToken(token));
  return match ? `${TOKEN_SCHEME}_${match[1]}` : null;
}

export interface VerifiedToken {
  tokenId: string;
  developerId: string;
  scope: string;
}

export type TokenFailureReason =
  | "empty"
  | "prefix-only"
  | "malformed"
  | "not-configured"
  | "store-unavailable"
  | "revoked"
  | "expired"
  | "unknown";

/**
 * Why a token was refused, in the detail the holder needs.
 *
 * A caller that holds a token learns nothing it does not already know from
 * "revoked" or "expired". The two that matter most are "prefix-only" — someone
 * copied the public part of the token instead of the whole value — and
 * "store-unavailable", a deployment problem. Both used to look identical to
 * "wrong token", which sent people round in circles creating new ones.
 */
export type TokenVerification =
  | ({ ok: true } & VerifiedToken)
  | { ok: false; reason: TokenFailureReason; detail?: string };

/**
 * Resolves a presented token to its owner.
 *
 * Requires the service role key: `api_tokens` is not readable by clients.
 */
export async function verifyPublishToken(token: string): Promise<TokenVerification> {
  const presented = normalizeToken(token);
  if (!presented) return { ok: false, reason: "empty" };

  // The dashboard lists `sere_xxxxxxxx…`; copying that is a common mistake.
  if (PREFIX_ONLY_PATTERN.test(presented)) return { ok: false, reason: "prefix-only" };

  if (!TOKEN_PATTERN.test(presented)) return { ok: false, reason: "malformed" };

  const prefix = tokenPrefix(presented);
  if (!prefix) return { ok: false, reason: "malformed" };

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, reason: "not-configured" };

  const hash = await sha256Hex(presented);

  const { data, error } = await admin
    .from("api_tokens")
    .select("id, developer_id, token_hash, scope, expires_at, revoked_at")
    .eq("token_prefix", prefix)
    .limit(5);

  if (error) {
    // Never a bare "try again": the summary names the actual problem, and for a
    // deployment failure there is nothing about the caller left to protect.
    return {
      ok: false,
      reason: "store-unavailable",
      detail: describeRegistryError(error).summary ?? undefined,
    };
  }
  if (!Array.isArray(data)) return { ok: false, reason: "unknown" };

  const now = Date.now();

  for (const raw of data) {
    const row = raw as Record<string, unknown>;
    const storedHash = typeof row.token_hash === "string" ? row.token_hash : "";

    // Only a hash match unlocks the revoked/expired detail: anything else would
    // tell a caller things about a token it does not hold.
    if (!storedHash || !constantTimeEqual(storedHash, hash)) continue;

    if (row.revoked_at) return { ok: false, reason: "revoked" };

    const expiresAt = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : Number.NaN;
    if (Number.isFinite(expiresAt) && expiresAt <= now) return { ok: false, reason: "expired" };

    const developerId = typeof row.developer_id === "string" ? row.developer_id : "";
    const tokenId = typeof row.id === "string" ? row.id : "";
    if (!developerId || !tokenId) return { ok: false, reason: "unknown" };

    return {
      ok: true,
      tokenId,
      developerId,
      scope: typeof row.scope === "string" ? row.scope : "publish",
    };
  }

  return { ok: false, reason: "unknown" };
}

/** Turns a verification failure into the status and message a caller should get. */
export function describeTokenFailure(failure: {
  reason: TokenFailureReason;
  detail?: string;
}): { status: number; error: string } {
  switch (failure.reason) {
    case "empty":
      return {
        status: 401,
        error: "No token was sent. Send it as `Authorization: Bearer <token>`.",
      };
    case "prefix-only":
      return {
        status: 400,
        error:
          "That is a token's public prefix, not the token. The full value is shown once, when it is created — create a new token and copy the whole thing.",
      };
    case "malformed":
      return {
        status: 400,
        error:
          "That does not look like a registry token. They read `sere_<prefix>_<secret>`, for example `sere_4f0c9a21_…`.",
      };
    case "not-configured":
      return {
        status: 503,
        error: "The registry cannot check tokens right now. Try again shortly.",
      };
    case "store-unavailable":
      // The underlying provider detail names environment variables and schema
      // files, and this response is served to anyone who presents a token. It
      // is logged server-side instead; operators read /api/registry/status.
      return {
        status: 503,
        error: "The registry could not check that token right now. Try again shortly.",
      };
    case "revoked":
      return {
        status: 401,
        error: "That token has been revoked. Create a new one on /developers.",
      };
    case "expired":
      return {
        status: 401,
        error: "That token has expired. Create a new one on /developers.",
      };
    default:
      return {
        status: 401,
        error:
          "That publish token is not valid. Check you copied the whole token, or create a new one on /developers.",
      };
  }
}

/** Records use so a developer can see which credentials are still live. */
export async function markTokenUsed(tokenId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  try {
    await admin
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenId);
  } catch {
    // Usage tracking is best effort and must never fail a publish.
  }
}
