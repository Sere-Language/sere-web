import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Public connection details for the current Supabase project, if configured. */
export interface SupabaseEnv {
  url: string;
  key: string;
}

/**
 * Reads an environment variable, tolerating the whitespace and surrounding
 * quotes that clipboard pastes into a hosting dashboard tend to carry.
 */
export function envValue(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;

  const unquoted = raw.replace(/^["']|["']$/g, "").trim();
  return unquoted || undefined;
}

/**
 * Reads the public project URL and key. Accepts both the newer publishable-key
 * name and the legacy anon-key name. Returns null when the project is not
 * configured, so callers can degrade instead of throwing.
 */
export function supabaseEnv(): SupabaseEnv | null {
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured(): boolean {
  return supabaseEnv() !== null;
}

/**
 * Server-side client. Pass a user's access token to run queries as that user —
 * row level security then applies exactly as it does in the browser.
 *
 * Returns null when Supabase is not configured.
 */
export function getSupabaseServerClient(accessToken?: string): SupabaseClient | null {
  const env = supabaseEnv();
  if (!env) return null;

  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  });
}

/**
 * Service-role client, used by the publish endpoint when it is called with the
 * shared publish token instead of a user session. This key bypasses row level
 * security, so it must never be exposed to the browser and never reach a code
 * path that an unvalidated request body can steer.
 *
 * Returns null when the service role key is not set.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const env = supabaseEnv();
  const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const kind = serviceKeyKind();

  // A publishable key in this variable would "work" right up until every write
  // failed on row level security, so treat it as missing and say why instead.
  if (!env || !serviceKey || kind === "missing" || kind === "public-key") return null;

  return createClient(env.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The bucket that holds published package payloads. */
export const PACKAGES_BUCKET = "packages";

export interface RegistryErrorInfo {
  code: string | null;
  message: string | null;
  /** An actionable sentence, when the failure is one we recognise. */
  hint: string | null;
  /** `hint`, else "code: message", else null — safe to show a token holder. */
  summary: string | null;
}

/**
 * Interprets a PostgREST or Storage failure in terms of what has to be fixed.
 *
 * The failures seen in practice are: the schema was never applied, the key
 * belongs to a different project, the publishable key was used where the secret
 * one belongs, and the database is unreachable. Each has a different fix, so
 * each gets its own sentence rather than a generic "try again".
 */
export function describeRegistryError(error: unknown): RegistryErrorInfo {
  const record =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = typeof record.code === "string" ? record.code : null;
  const rawMessage = typeof record.message === "string" ? record.message : null;
  const message = rawMessage ? rawMessage.slice(0, 200) : null;
  const haystack = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  let hint: string | null = null;

  // Order matters. A missing function and a missing table both mention the
  // schema cache, and they need different fixes, so they are separated before
  // the generic cache case is considered.
  const missingTable =
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .* does not exist|could not find the table/.test(haystack);

  const missingFunction =
    code === "PGRST202" || /could not find the function/.test(haystack);

  if (missingTable) {
    hint =
      "the registry tables are missing from this project — run supabase/schema.sql in the SQL editor";
  } else if (missingFunction) {
    hint =
      "that function is not installed — run supabase/schema.sql in full, then refresh the API with: notify pgrst, 'reload schema'";
  } else if (/invalid api key|invalid jwt|invalid claim|pgrst301|no api key/.test(haystack)) {
    hint =
      "the server-side key was rejected — check that SUPABASE_SERVICE_ROLE_KEY belongs to the same project as NEXT_PUBLIC_SUPABASE_URL, and that it has not been rotated";
  } else if (/permission denied|42501|row-level security|violates row-level/.test(haystack)) {
    hint =
      "the server-side key was refused by row level security — it is probably the publishable key rather than the secret one";
  } else if (/fetch failed|enotfound|econnrefused|econnreset|network|timed out|timeout/.test(haystack)) {
    hint =
      "the deployment could not reach the database — check that the project URL is right and the project is running";
  } else if (/schema cache/.test(haystack)) {
    hint =
      "the API has not picked up the schema yet — refresh it with: notify pgrst, 'reload schema'";
  }

  return {
    code,
    message,
    hint,
    summary: hint ?? (code && message ? `${code}: ${message}` : message),
  };
}

/* ------------------------------------------------------------------ */
/* Deployment diagnostics                                             */
/* ------------------------------------------------------------------ */

export type ServiceKeyKind =
  | "missing"
  | "secret"
  | "service-role"
  | "public-key"
  | "unrecognised";

/**
 * Classifies the server-side key without using it.
 *
 * The commonest deployment mistake is pasting the publishable key into
 * `SUPABASE_SERVICE_ROLE_KEY`: everything looks configured, then every write
 * fails on permissions. Both key generations are recognised — legacy keys are
 * JWTs carrying a `role` claim, newer ones are prefixed.
 */
export function serviceKeyKind(): ServiceKeyKind {
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) return "missing";
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "public-key";

  if (key.startsWith("eyJ")) {
    const role = jwtRole(key);
    if (role === "service_role") return "service-role";
    if (role === "anon" || role === "authenticated") return "public-key";
  }

  return "unrecognised";
}

/** Decodes a JWT payload without verifying it — a self-check, never auth. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) return null;

  const normalised = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalised.length % 4)) % 4);

  try {
    const json = JSON.parse(atob(normalised + padding));
    return json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Reads a JWT's `role` claim. */
function jwtRole(token: string): string | null {
  const payload = decodeJwtPayload(token);
  return typeof payload?.role === "string" ? payload.role : null;
}

/**
 * The project a legacy Supabase key belongs to, when the key is a JWT.
 *
 * Legacy `anon` and `service_role` keys carry `ref` (and an `iss` issuer URL),
 * which makes it possible to prove that a key and a project URL disagree
 * without making a single request. Newer `sb_secret_…` keys are opaque, so this
 * returns null for them and the live probes have to answer instead.
 */
export function keyProjectRef(key: string): string | null {
  if (!key.startsWith("eyJ")) return null;

  const payload = decodeJwtPayload(key);
  if (!payload) return null;

  if (typeof payload.ref === "string" && payload.ref) return payload.ref;

  if (typeof payload.iss === "string") {
    const match = /https:\/\/([a-z0-9]+)\.supabase\.(?:co|in)/i.exec(payload.iss);
    if (match) return match[1];
  }

  return null;
}

export interface RegistryStatus {
  /** Project URL and publishable key are present: reads and accounts work. */
  supabase: boolean;
  /** A server-side key is present, and is not obviously the wrong one. */
  serviceRole: boolean;
  /** The shared CI publish token is configured. */
  sharedPublishToken: boolean;
  /** Accounts are activated without email. */
  autoConfirm: boolean;
  /** Why publishing is unavailable, or null when it is ready. */
  publishProblem: string | null;
}

/**
 * What this deployment is actually capable of, for error messages and for the
 * developer dashboard. Never includes a key or any part of one.
 */
export function registryStatus(): RegistryStatus {
  const supabase = isSupabaseConfigured();
  const kind = serviceKeyKind();

  let publishProblem: string | null = null;
  if (!supabase) {
    publishProblem =
      "This deployment has no Supabase project configured, so the registry cannot store anything. The site operator needs to set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then redeploy.";
  } else if (kind === "missing") {
    publishProblem =
      "This deployment is missing SUPABASE_SERVICE_ROLE_KEY, the server-side key publishing writes with, so no package can be stored. The site operator needs to add it to the deployment environment and redeploy.";
  } else if (kind === "public-key") {
    publishProblem =
      "SUPABASE_SERVICE_ROLE_KEY holds a publishable key rather than the secret one, so writes are refused. The site operator needs to replace it with the secret (service_role) key and redeploy.";
  }

  return {
    supabase,
    serviceRole: kind === "secret" || kind === "service-role" || kind === "unrecognised",
    sharedPublishToken: (envValue("PACKAGE_PUBLISH_TOKEN")?.length ?? 0) >= 24,
    autoConfirm: ["1", "true", "yes"].includes(
      (envValue("DEVELOPER_AUTO_CONFIRM") ?? "").toLowerCase(),
    ),
    publishProblem,
  };
}
