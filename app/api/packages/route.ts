/**
 * Package registry API.
 *
 *   GET  /api/packages?q=&sort=&limit=
 *        List or search published packages. Rate limited per IP.
 *        sort: downloads (default) | recent | name | relevance
 *
 *   POST /api/packages
 *        Publish a package version. multipart/form-data with:
 *          tarball    file     the .tar.gz / .slib / .zip payload (required)
 *          name       string   package name, e.g. "matrix-utils" (required)
 *          version    string   semantic version, e.g. "0.2.0" (required)
 *          manifest   string   raw sere.toml / sere.json (optional)
 *          readme     string   markdown shown on the package page (optional)
 *          plus any of: summary, description, license, repository, homepage,
 *          author, keywords (comma separated), entry
 *
 *        A package name belongs to exactly one developer. Publishing a version
 *        under a name you already own updates that package (200); claiming a
 *        free name creates it (201); a name owned by someone else is refused
 *        with 403 and nothing is written.
 *
 *        Auth, one of:
 *          Authorization: Bearer sere_...   a token from /developers
 *          x-publish-token: <secret>        the shared CI token, if configured
 *
 * Rate limits are enforced per IP and per credential, and every publish is
 * written to the audit log.
 */

import { describeTokenFailure, markTokenUsed, normalizeToken, verifyPublishToken } from "@/app/lib/apiTokens.server";
import { recordAudit } from "@/app/lib/audit.server";
import { manifestFromFormData } from "@/app/lib/packageManifest";
import { MAX_PACKAGE_BYTES, publishPackage } from "@/app/lib/packagePublish.server";
import { listPackages } from "@/app/lib/packageRegistry.server";
import {
    DEFAULT_PACKAGE_SORT,
    PACKAGE_SORTS,
    packageApiPath,
    packageInstallCommand,
    type PackageSort,
} from "@/app/lib/packages";
import {
    RATE_LIMITS,
    checkIpRateLimit,
    checkRateLimit,
    rateLimitHeaders,
    rateLimitedResponse,
} from "@/app/lib/rateLimit.server";
import {
    clientIp,
    constantTimeEqual,
    hashIp,
    jsonResponse,
} from "@/app/lib/security.server";
import {
    envValue,
    getSupabaseAdminClient,
    isSupabaseConfigured,
    registryStatus,
} from "@/app/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** A shared secret shorter than this is refused outright. */
const MIN_SHARED_TOKEN_LENGTH = 24;

interface Publisher {
  admin: SupabaseClient;
  developerId: string | null;
  /** Null when publishing with the shared CI token. */
  tokenId: string | null;
}

type PublishAuth =
  | { ok: true; publisher: Publisher }
  | { ok: false; response: Response };

/**
 * Resolves who is publishing.
 *
 * The shared token is a deployment-owned secret for CI: it is only read from
 * `x-publish-token`, so a developer token and an operator token can never be
 * confused for one another.
 */
async function resolvePublisher(request: NextRequest): Promise<PublishAuth> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      response: jsonResponse(
        {
          error:
            registryStatus().publishProblem ??
            "Publishing is not available on this deployment.",
        },
        503,
      ),
    };
  }

  const sharedToken = envValue("PACKAGE_PUBLISH_TOKEN") ?? "";
  const presentedShared = normalizeToken(request.headers.get("x-publish-token") ?? "");

  if (presentedShared) {
    if (
      sharedToken.length >= MIN_SHARED_TOKEN_LENGTH &&
      constantTimeEqual(presentedShared, sharedToken)
    ) {
      return {
        ok: true,
        publisher: { admin, developerId: null, tokenId: "shared-token" },
      };
    }
    return {
      ok: false,
      response: jsonResponse({ error: "That publish token is not valid." }, 401),
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!bearer) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "Send `Authorization: Bearer <token>` with a token from /developers." },
        401,
      ),
    };
  }

  const verified = await verifyPublishToken(bearer);
  if (!verified.ok) {
    // Each reason gets its own status and sentence: "wrong token" is only one of
    // six things that can be wrong here, and the others are not the caller's
    // fault.
    const failure = describeTokenFailure(verified);
    return { ok: false, response: jsonResponse({ error: failure.error }, failure.status) };
  }
  if (verified.scope !== "publish") {
    return {
      ok: false,
      response: jsonResponse({ error: "That token cannot publish packages." }, 403),
    };
  }

  return {
    ok: true,
    publisher: { admin, developerId: verified.developerId, tokenId: verified.tokenId },
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  const limit = await checkIpRateLimit(request, RATE_LIMITS.read);
  if (!limit.allowed) {
    return rateLimitedResponse(limit, "Too many requests. Slow down and try again.");
  }

  const params = request.nextUrl.searchParams;
  const requestedSort = params.get("sort") ?? DEFAULT_PACKAGE_SORT;
  const sort: PackageSort = PACKAGE_SORTS.some((option) => option.value === requestedSort)
    ? (requestedSort as PackageSort)
    : DEFAULT_PACKAGE_SORT;

  const requestedLimit = Number(params.get("limit") ?? "24");

  const packages = await listPackages({
    query: params.get("q") ?? undefined,
    sort,
    limit: Number.isFinite(requestedLimit) ? requestedLimit : 24,
  });

  return jsonResponse(
    {
      count: packages.length,
      sort,
      registryConfigured: isSupabaseConfigured(),
      // Lets a caller see what this deployment can actually do before trying to
      // publish, without any key material appearing in a response.
      status: registryStatus(),
      packages: packages.map((pkg) => ({
        ...pkg,
        url: packageApiPath(pkg.name),
        install: packageInstallCommand(pkg.name, pkg.latestVersion),
      })),
    },
    200,
    rateLimitHeaders(limit),
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const ipLimit = await checkIpRateLimit(request, RATE_LIMITS.publishIp);
  if (!ipLimit.allowed) {
    return rateLimitedResponse(ipLimit, "Too many uploads from this network.");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonResponse(
      {
        error:
          "Publish with multipart/form-data: a `tarball` file plus `name` and `version` fields.",
      },
      415,
    );
  }

  const auth = await resolvePublisher(request);
  if (!auth.ok) return auth.response;
  const { admin, developerId, tokenId } = auth.publisher;

  // Second limit, keyed to the credential rather than the network.
  const credentialLimit = await checkRateLimit(RATE_LIMITS.publish, tokenId ?? "shared-token");
  if (!credentialLimit.allowed) {
    return rateLimitedResponse(credentialLimit, "This credential has published enough for now.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: "Could not read the uploaded form data." }, 400);
  }

  const tarball = form.get("tarball");
  if (!(tarball instanceof File)) {
    return jsonResponse({ error: "Missing the `tarball` file field." }, 400);
  }
  if (tarball.size === 0) {
    return jsonResponse({ error: "The uploaded archive is empty." }, 400);
  }
  if (tarball.size > MAX_PACKAGE_BYTES) {
    return jsonResponse(
      { error: `Archives are limited to ${MAX_PACKAGE_BYTES / 1024 / 1024} MB.` },
      413,
    );
  }

  const resolved = manifestFromFormData(form);
  if (!resolved.ok) return jsonResponse({ error: resolved.error }, 400);

  const manifest = { ...resolved.manifest };
  const readme = manifest.readme;
  if (readme && readme.length > 64 * 1024) {
    return jsonResponse({ error: "That README is too large." }, 413);
  }

  const result = await publishPackage({
    client: admin,
    ownerId: developerId,
    manifest,
    rawManifest: resolved.raw,
    data: await tarball.arrayBuffer(),
    fileName: tarball.name,
    contentType: tarball.type,
  });

  const ipHash = await hashIp(clientIp(request));

  if (!result.ok) {
    await recordAudit({
      developerId,
      // A name clash gets its own event: it is the one failure a publisher can
      // fix by choosing differently.
      kind: result.status === 403 ? "package.name_conflict" : "package.publish_failed",
      subject: manifest.name,
      ipHash,
      metadata: { version: manifest.version, status: result.status },
    });
    return jsonResponse({ error: result.error }, result.status);
  }

  await recordAudit({
    developerId,
    kind: "package.published",
    subject: manifest.name,
    ipHash,
    metadata: {
      version: manifest.version,
      bytes: result.published.bytes,
      checksum: result.published.checksumSha256,
      via: developerId ? "developer-token" : "shared-token",
    },
  });

  if (developerId) {
    // Best effort; a failed touch must not fail the publish.
    if (tokenId) await markTokenUsed(tokenId);
  }

  return jsonResponse(
    { published: result.published },
    result.status,
    rateLimitHeaders(credentialLimit),
  );
}
