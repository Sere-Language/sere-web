/**
 * Manifest handling for the Sere package registry.
 *
 * A publisher ships a `sere.toml` (or `sere.json`) next to the sources. Only the
 * keys the registry understands are read — anything else is ignored so packages
 * stay free to carry their own tooling metadata.
 */

export const PACKAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

export interface PackageManifest {
  name: string;
  version: string;
  summary?: string;
  description?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  author?: string;
  keywords?: string[];
  entry?: string;
  readme?: string;
}

export type ManifestResult =
  | { ok: true; manifest: PackageManifest; raw: Record<string, unknown> }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Coordinates                                                         */
/* ------------------------------------------------------------------ */

export function normalizePackageName(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function isValidPackageName(value: string): boolean {
  return PACKAGE_NAME_PATTERN.test(value);
}

export function isValidVersion(value: string): boolean {
  return VERSION_PATTERN.test(value.trim());
}

/** Orders two semantic versions. Build metadata is ignored, as semver says. */
export function compareVersions(left: string, right: string): number {
  const a = VERSION_PATTERN.exec(left.trim());
  const b = VERSION_PATTERN.exec(right.trim());
  if (!a || !b) return left.localeCompare(right);

  for (let index = 1; index <= 3; index += 1) {
    const delta = Number(a[index]) - Number(b[index]);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }

  const preA = a[4];
  const preB = b[4];
  if (preA === preB) return 0;
  if (preA === undefined) return 1;
  if (preB === undefined) return -1;

  const partsA = preA.split(".");
  const partsB = preB.split(".");
  const length = Math.max(partsA.length, partsB.length);

  for (let index = 0; index < length; index += 1) {
    const one = partsA[index];
    const two = partsB[index];
    if (one === two) continue;
    if (one === undefined) return -1;
    if (two === undefined) return 1;

    const numeric = /^\d+$/.test(one) && /^\d+$/.test(two);
    if (numeric) return Number(one) > Number(two) ? 1 : -1;
    return one > two ? 1 : -1;
  }

  return 0;
}

export function highestVersion(versions: string[]): string | null {
  let best: string | null = null;
  for (const version of versions) {
    if (!isValidVersion(version)) continue;
    if (best === null || compareVersions(version, best) > 0) best = version;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Storage layout                                                      */
/* ------------------------------------------------------------------ */

/** `<name>/<version>/<name>-<version>.<ext>` inside the packages bucket. */
export function packageStoragePath(name: string, version: string, extension: string): string {
  return `${name}/${version}/${packageArchiveName(name, version, extension)}`;
}

export function packageArchiveName(name: string, version: string, extension: string): string {
  return `${name}-${version}.${extension}`;
}

/** Picks the archive extension to store under, from the upload's filename. */
export function extensionForUpload(fileName: string, contentType: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar.gz";
  if (lower.endsWith(".slib")) return "slib";
  if (lower.endsWith(".tar")) return "tar";
  if (lower.endsWith(".zip")) return "zip";
  if (contentType.includes("zip")) return "zip";
  return "tar.gz";
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/* Field caps: big enough for real projects, small enough that a crafted upload
   cannot stuff megabytes of text into the database. */
export const MAX_SUMMARY = 280;
export const MAX_DESCRIPTION = 4000;
export const MAX_README = 64 * 1024;
export const MAX_MANIFEST_BYTES = 32 * 1024;

/** Trimmed, length-capped text, or undefined when there is nothing to store. */
function bounded(value: unknown, maxLength: number): string | undefined {
  const trimmed = text(value);
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

/** Reads a single non-empty string field from a multipart form. */
export function readFormField(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Builds a manifest from an upload: the `manifest` field (raw sere.toml or
 * sere.json) supplies defaults, and explicit fields win — so CI can patch a
 * version without rewriting the file.
 */
export function manifestFromFormData(form: FormData): ManifestResult {
  const fields = {
    name: readFormField(form, "name"),
    version: readFormField(form, "version"),
    summary: readFormField(form, "summary"),
    description: readFormField(form, "description"),
    license: readFormField(form, "license"),
    repository: readFormField(form, "repository"),
    homepage: readFormField(form, "homepage"),
    author: readFormField(form, "author"),
    keywords: readFormField(form, "keywords"),
    entry: readFormField(form, "entry"),
    readme: readFormField(form, "readme"),
  };

  const manifestText = readFormField(form, "manifest");
  if (!manifestText) return manifestFromFields(fields);

  if (manifestText.length > MAX_MANIFEST_BYTES) {
    return { ok: false, error: "That manifest is too large." };
  }

  const parsed = parseManifest(manifestText);
  if (!parsed.ok) return parsed;

  const merged: Record<string, unknown> = { ...parsed.raw };
  for (const [key, value] of Object.entries(fields)) {
    if (value) merged[key] = value;
  }

  return manifestFromRaw(merged);
}

export function parseManifest(text: string): ManifestResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Manifest is empty." };

  let raw: Record<string, unknown>;
  try {
    raw = trimmed.startsWith("{")
      ? (JSON.parse(trimmed) as Record<string, unknown>)
      : parseToml(trimmed);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error
        ? error.message
        : "Manifest is neither valid JSON nor valid TOML.",
    };
  }

  return manifestFromRaw(raw);
}

/** Builds a manifest from flat request fields (form data or query values). */
export function manifestFromFields(
  fields: Record<string, string | null | undefined>,
): ManifestResult {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) raw[key] = trimmed;
  }

  return manifestFromRaw(raw);
}

export function manifestFromRaw(input: Record<string, unknown>): ManifestResult {
  const raw = unwrapPackageSection(input);

  const name = normalizePackageName(text(raw.name) ?? "");
  const version = (text(raw.version) ?? "").replace(/^v/, "");

  if (!name) return { ok: false, error: "Manifest is missing a name." };
  if (!isValidPackageName(name)) {
    return {
      ok: false,
      error:
        `"${name}" is not a valid package name. Use lowercase letters, digits, ` +
        "dots, dashes or underscores, starting with a letter or digit (max 64).",
    };
  }
  if (!version) return { ok: false, error: "Manifest is missing a version." };
  if (!isValidVersion(version)) {
    return {
      ok: false,
      error: `"${version}" is not a semantic version. Expected MAJOR.MINOR.PATCH.`,
    };
  }

  const keywords = toKeywords(raw.keywords);
  const summary = bounded(raw.summary, MAX_SUMMARY) ?? bounded(raw.description, MAX_SUMMARY);
  const description = bounded(raw.description, MAX_DESCRIPTION);
  const license = bounded(raw.license, 60);
  const repository = bounded(raw.repository, 300);
  const homepage = bounded(raw.homepage, 300);
  const author = bounded(raw.author, 120);
  const entry = bounded(raw.entry, 200);
  const readme = bounded(raw.readme, MAX_README);

  const manifest: PackageManifest = { name, version };
  if (summary) manifest.summary = summary;
  if (description) manifest.description = description;
  if (license) manifest.license = license;
  if (repository) manifest.repository = repository;
  if (homepage) manifest.homepage = homepage;
  if (author) manifest.author = author;
  if (keywords.length > 0) manifest.keywords = keywords;
  if (entry) manifest.entry = entry;
  if (readme) manifest.readme = readme;

  return { ok: true, manifest, raw };
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

function unwrapPackageSection(input: Record<string, unknown>): Record<string, unknown> {
  const nested = input.package;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>), ...input };
  }
  return input;
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function toKeywords(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const seen = new Set<string>();
  for (const entry of list) {
    const keyword = text(entry)?.toLowerCase();
    if (keyword && !seen.has(keyword)) seen.add(keyword);
  }

  return Array.from(seen).slice(0, 12);
}

/** Minimal TOML reader: `key = value`, `[section]` headers, `#` comments. */
function parseToml(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let section = "";

  for (const line of source.split(/\r?\n/)) {
    const stripped = stripComment(line).trim();
    if (!stripped) continue;

    const header = /^\[([^\]]+)\]$/.exec(stripped);
    if (header) {
      section = header[1].trim();
      continue;
    }

    const equals = stripped.indexOf("=");
    if (equals <= 0) {
      throw new Error(`Cannot read manifest line: ${line.trim()}`);
    }

    const key = stripped.slice(0, equals).trim().replace(/^["']|["']$/g, "");
    const value = parseTomlValue(stripped.slice(equals + 1).trim());

    // Keys outside a section and inside [package] both belong to the manifest.
    if (section === "" || section === "package") {
      if (!(key in result)) result[key] = value;
    }
  }

  return result;
}

function stripComment(line: string): string {
  let quote: string | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === "\\" && quote === '"') {
        index += 1;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#") return line.slice(0, index);
  }

  return line;
}

function parseTomlValue(raw: string): string | number | boolean | string[] {
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return splitTopLevel(raw.slice(1, -1))
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => String(parseTomlValue(part)));
  }

  // Quoted string — checked by hand so the bundle never needs the dotAll flag.
  if (raw.length >= 2) {
    const quote = raw[0];
    if ((quote === '"' || quote === "'") && raw[raw.length - 1] === quote) {
      return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }

  if (raw === "true") return true;
  if (raw === "false") return false;

  const numeric = Number(raw);
  if (raw !== "" && Number.isFinite(numeric)) return numeric;

  return raw;
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  let depth = 0;

  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  parts.push(current);
  return parts;
}
