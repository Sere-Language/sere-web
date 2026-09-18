/**
 * Publishing pipeline for the package registry.
 *
 * Kept out of the route handler so the HTTP layer only deals with parsing and
 * authentication. Everything here assumes the caller has already decided which
 * Supabase client to use and who the owner is.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
    extensionForUpload,
    highestVersion,
    packageStoragePath,
    type PackageManifest,
} from "./packageManifest";
import { packageApiPath, packageInstallCommand } from "./packages";
import { PACKAGES_BUCKET } from "./supabase/server";

export const MAX_PACKAGE_BYTES = 25 * 1024 * 1024;

export interface PublishInput {
  client: SupabaseClient;
  /** Null when publishing with the shared token instead of a user session. */
  ownerId: string | null;
  manifest: PackageManifest;
  /** The manifest exactly as it was written, stored alongside the version. */
  rawManifest: Record<string, unknown>;
  data: ArrayBuffer;
  fileName: string;
  contentType: string;
}

export interface PublishSuccess {
  name: string;
  version: string;
  summary: string;
  latestVersion: string;
  versionsCount: number;
  /** False when this publish added a version to a package that already existed. */
  created: boolean;
  bytes: number;
  checksumSha256: string;
  tarballPath: string;
  downloadUrl: string;
  url: string;
  install: string;
}

export type PublishResult =
  | { ok: true; status: number; published: PublishSuccess }
  | { ok: false; status: number; error: string };

/* ------------------------------------------------------------------ */
/* Error helpers — PostgREST and Storage report failures differently    */
/* ------------------------------------------------------------------ */

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

function isConflict(error: unknown): boolean {
  const code = errorCode(error);
  if (code === "23505" || code === "409") return true;
  return /already exists|duplicate key/i.test(errorMessage(error));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------------ */
/* Name ownership                                                      */
/* ------------------------------------------------------------------ */

interface ExistingPackage {
  id: string | null;
  ownerId: string | null;
  error?: string;
}

async function readPackageRow(
  client: SupabaseClient,
  name: string,
): Promise<ExistingPackage> {
  const result = await client
    .from("packages")
    .select("id, owner_id")
    .eq("name", name)
    .maybeSingle();

  // PGRST116 is "no rows", which simply means the name is free.
  if (result.error && errorCode(result.error) !== "PGRST116") {
    return { id: null, ownerId: null, error: errorMessage(result.error) };
  }

  const row = asRecord(result.data);
  return {
    id: typeof row.id === "string" ? row.id : null,
    ownerId: typeof row.owner_id === "string" ? row.owner_id : null,
  };
}

/**
 * A package name belongs to exactly one publisher.
 *
 * - Same publisher: this is an update. A new version is added and the package's
 *   metadata is refreshed from the new manifest.
 * - Someone else: refused, so nobody can publish under another developer's name.
 * - Nobody (the first release came from the shared CI token): reserved for that
 *   token, so a developer cannot claim the name just by asking first.
 */
function checkNameOwnership(
  existingOwnerId: string | null,
  publisherId: string | null,
  name: string,
): { ok: true } | { ok: false; status: number; error: string } {
  if (existingOwnerId === publisherId) return { ok: true };

  if (existingOwnerId === null) {
    return {
      ok: false,
      status: 403,
      error: `The name "${name}" is reserved for this deployment's own releases.`,
    };
  }

  return {
    ok: false,
    status: 403,
    error: `The name "${name}" is already taken by another developer. Publish under a different name.`,
  };
}

/* ------------------------------------------------------------------ */
/* Publishing                                                          */
/* ------------------------------------------------------------------ */

export async function publishPackage(input: PublishInput): Promise<PublishResult> {
  const { client, ownerId, manifest, rawManifest, data, fileName, contentType } = input;
  const { name, version } = manifest;

  const extension = extensionForUpload(fileName, contentType);
  const tarballPath = packageStoragePath(name, version, extension);
  const checksumSha256 = await sha256Hex(data);

  const upload = await client.storage.from(PACKAGES_BUCKET).upload(tarballPath, data, {
    contentType: contentType || "application/gzip",
    upsert: false,
    cacheControl: "3600",
  });

  if (upload.error) {
    return isConflict(upload.error)
      ? { ok: false, status: 409, error: `${name}@${version} is already published.` }
      : { ok: false, status: 502, error: `Upload failed: ${errorMessage(upload.error)}` };
  }

  const discard = async () => {
    await client.storage.from(PACKAGES_BUCKET).remove([tarballPath]);
  };

  /* -- find the package, and check this publisher may write to it ---- */
  const existing = await readPackageRow(client, name);
  if (existing.error) {
    await discard();
    return { ok: false, status: 502, error: existing.error };
  }

  let id = existing.id;
  let createdPackage = false;

  if (id) {
    const ownership = checkNameOwnership(existing.ownerId, ownerId, name);
    if (!ownership.ok) {
      await discard();
      return ownership;
    }
  } else {
    const created = await client
      .from("packages")
      .insert({
        name,
        display_name: name,
        summary: manifest.summary ?? "",
        description: manifest.description ?? manifest.summary ?? "",
        license: manifest.license ?? null,
        repository_url: manifest.repository ?? null,
        homepage_url: manifest.homepage ?? null,
        author: manifest.author ?? null,
        keywords: manifest.keywords ?? [],
        owner_id: ownerId,
        latest_version: version,
        versions_count: 0,
      })
      .select("id")
      .single();

    if (created.error || !created.data) {
      // Another publisher may have claimed the name in the meantime, so re-read
      // it and apply the ownership rule rather than guessing.
      const raced = isConflict(created.error) ? await readPackageRow(client, name) : null;

      if (raced?.id) {
        const ownership = checkNameOwnership(raced.ownerId, ownerId, name);
        if (!ownership.ok) {
          await discard();
          return ownership;
        }
        id = raced.id;
      } else {
        await discard();
        return {
          ok: false,
          status: 502,
          error: `Could not create the package row: ${errorMessage(created.error)}`,
        };
      }
    } else {
      id = String(asRecord(created.data).id ?? "");
      createdPackage = true;

      if (!id) {
        await discard();
        return { ok: false, status: 502, error: "Package row came back without an id." };
      }
    }
  }

  /* -- the immutable version row ------------------------------------ */
  const inserted = await client.from("package_versions").insert({
    package_id: id,
    version,
    entry: manifest.entry ?? null,
    tarball_path: tarballPath,
    tarball_bytes: data.byteLength,
    checksum_sha256: checksumSha256,
    manifest: rawManifest,
    readme: manifest.readme ?? null,
  });

  if (inserted.error) {
    await discard();
    if (createdPackage) {
      // The package row only exists because of this request, so do not leave a
      // name claimed by a publish that failed.
      await client.from("packages").delete().eq("id", id);
    }
    return isConflict(inserted.error)
      ? { ok: false, status: 409, error: `${name}@${version} is already published.` }
      : { ok: false, status: 502, error: errorMessage(inserted.error) };
  }

  /* -- keep the denormalised columns on packages in sync ------------- */
  const versionRows = await client
    .from("package_versions")
    .select("version, yanked")
    .eq("package_id", id);

  const released = (Array.isArray(versionRows.data) ? versionRows.data : [])
    .map((row) => asRecord(row))
    .filter((row) => row.yanked !== true)
    .map((row) => (typeof row.version === "string" ? row.version : ""))
    .filter(Boolean);

  const latestVersion = highestVersion(released) ?? version;
  const versionsCount = released.length;

  await client
    .from("packages")
    .update({
      latest_version: latestVersion,
      versions_count: versionsCount,
      summary: manifest.summary ?? undefined,
      description: manifest.description ?? undefined,
      license: manifest.license ?? undefined,
      repository_url: manifest.repository ?? undefined,
      homepage_url: manifest.homepage ?? undefined,
      author: manifest.author ?? undefined,
      keywords: manifest.keywords ?? undefined,
    })
    .eq("id", id);

  const publicUrl = client.storage.from(PACKAGES_BUCKET).getPublicUrl(tarballPath);

  return {
    ok: true,
    // 201 when the name was claimed by this request, 200 when a version was
    // added to a package that already existed.
    status: createdPackage ? 201 : 200,
    published: {
      name,
      version,
      summary: manifest.summary ?? "",
      latestVersion,
      versionsCount,
      created: createdPackage,
      bytes: data.byteLength,
      checksumSha256,
      tarballPath,
      downloadUrl: publicUrl.data.publicUrl,
      url: packageApiPath(name),
      install: packageInstallCommand(name, version),
    },
  };
}
