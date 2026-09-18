/**
 * GET /api/registry/status — deployment health check for the package registry.
 *
 * Answers the question a failed publish raises: is this the token, or the
 * deployment? Each probe exercises one dependency with the credential that
 * actually uses it, and every failure is reported in terms of what has to be
 * fixed rather than as a bare status code.
 *
 * Nothing here is secret: no key material is read, and the database messages it
 * can return are schema names and provider errors. Rate limited all the same.
 */

import { RATE_LIMITS, checkIpRateLimit, rateLimitedResponse } from "@/app/lib/rateLimit.server";
import { jsonResponse } from "@/app/lib/security.server";
import {
    PACKAGES_BUCKET,
    describeRegistryError,
    envValue,
    getSupabaseAdminClient,
    getSupabaseServerClient,
    keyProjectRef,
    registryStatus,
    supabaseEnv,
} from "@/app/lib/supabase/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface Check {
  name: string;
  ok: boolean;
  detail: string | null;
}

/**
 * Runs one probe and turns any failure into an actionable sentence.
 *
 * The parameter is `PromiseLike`, not `Promise`: Supabase's query builders are
 * thenable but not real promises, so they are not assignable to `Promise`.
 */
async function check(
  name: string,
  run: () => PromiseLike<{ error: unknown }>,
): Promise<Check> {
  try {
    const { error } = await run();
    if (!error) return { name, ok: true, detail: null };

    const info = describeRegistryError(error);
    return { name, ok: false, detail: info.summary ?? "the provider gave no detail" };
  } catch (error) {
    const info = describeRegistryError(error);
    return { name, ok: false, detail: info.summary ?? String(error) };
  }
}

function skipped(name: string, why: string): Check {
  return { name, ok: false, detail: why };
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** The project ref a Supabase URL points at, e.g. `abcdefghijklm`. */
function projectRefFromUrl(url: string): string | null {
  const host = safeHost(url);
  return host ? (host.split(".")[0] ?? null) : null;
}

/**
 * Draws one conclusion from the probes instead of leaving four results to be
 * interpreted. The interesting signal is a disagreement between them: a project
 * that answers with the publishable key but rejects the server key is a wrong
 * key, not a broken deployment.
 */
function buildDiagnosis(input: {
  checks: Check[];
  urlRef: string | null;
  serviceRef: string | null;
  projectMismatch: boolean;
}): string {
  const publicRead = input.checks[0];
  const tokens = input.checks[1];

  if (input.checks.every((entry) => entry.ok)) {
    return "The registry is ready: reads, tokens, storage and the rate limiter all answered.";
  }

  if (input.projectMismatch) {
    return `SUPABASE_SERVICE_ROLE_KEY belongs to project "${input.serviceRef}", but NEXT_PUBLIC_SUPABASE_URL is project "${input.urlRef}". Copy the secret key from "${input.urlRef}" and redeploy.`;
  }

  const rejected =
    tokens?.detail?.includes("was rejected") || tokens?.detail?.includes("Invalid") || false;

  if (publicRead?.ok && rejected) {
    return `Project "${input.urlRef ?? "this URL"}" answers with the publishable key, so the URL is right — SUPABASE_SERVICE_ROLE_KEY is the wrong key for it, or it has been rotated. Copy the secret key from that project's API settings and redeploy.`;
  }

  if (!publicRead?.ok && rejected) {
    return "Neither key is accepted, so the URL and the keys probably come from different projects. Check all three variables belong to the same Supabase project, then redeploy.";
  }

  if (tokens?.detail?.includes("tables are missing")) {
    return "The keys work and the project is reachable, but the registry tables are missing — run supabase/schema.sql in the SQL editor.";
  }

  const failures = input.checks
    .filter((entry) => !entry.ok)
    .map((entry) => `${entry.name}: ${entry.detail ?? "failed"}`);

  return `Not ready. ${failures.join("; ")}.`;
}

export async function GET(request: NextRequest): Promise<Response> {
  const limit = await checkIpRateLimit(request, RATE_LIMITS.session);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many status checks. Wait a few minutes.");
  }

  const config = registryStatus();
  const anon = getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const env = supabaseEnv();

  const noPublic = "no public Supabase client — the project URL or publishable key is missing";
  const noServer = "no server-side client — SUPABASE_SERVICE_ROLE_KEY is missing or is the publishable key";

  const checks = await Promise.all([
    anon
      ? check("packages table, public read", () =>
          anon.from("packages").select("id", { head: true, count: "exact" }).limit(1),
        )
      : Promise.resolve(skipped("packages table, public read", noPublic)),

    admin
      ? check("api_tokens table, server key", () =>
          admin.from("api_tokens").select("id", { head: true, count: "exact" }).limit(1),
        )
      : Promise.resolve(skipped("api_tokens table, server key", noServer)),

    admin
      ? check("packages storage bucket", () =>
          admin.storage.from(PACKAGES_BUCKET).list("", { limit: 1 }),
        )
      : Promise.resolve(skipped("packages storage bucket", noServer)),

    // A rate-limited reply still proves the function ran, so only an error counts.
    admin
      ? check("rate limiter function", () =>
          admin.rpc("consume_rate_limit", {
            p_bucket: "healthcheck",
            p_window_seconds: 60,
            p_max_hits: 1,
          }),
        )
      : Promise.resolve(skipped("rate limiter function", noServer)),
  ]);

  const urlRef = env ? projectRefFromUrl(env.url) : null;
  const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY") ?? null;
  const serviceRef = serviceKey ? keyProjectRef(serviceKey) : null;

  // Only derivable for legacy JWT keys; new-format keys are opaque, so a null
  // here means "unknown", never "no mismatch".
  const projectMismatch = Boolean(urlRef && serviceRef && urlRef !== serviceRef);

  return jsonResponse({
    config: {
      ...config,
      // Which project this deployment talks to. The URL is public already.
      supabaseHost: env ? safeHost(env.url) : null,
      projectRef: urlRef,
      serviceKeyProjectRef: serviceRef,
      projectMismatch,
    },
    checks,
    diagnosis: buildDiagnosis({ checks, urlRef, serviceRef, projectMismatch }),
    ready: checks.every((entry) => entry.ok),
  });
}
