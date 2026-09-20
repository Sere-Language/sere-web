/**
 * Helpers for translating the links and paths used by the docs in the Sere
 * repository into things this website can serve.
 *
 * The repository lays its docs out like this:
 *
 *   docs/README.md            -> /docs
 *   docs/language.md          -> /docs/language
 *   docs/reference/README.md  -> /docs/reference
 *   docs/reference/strings.md -> /docs/reference/strings
 *
 * Everything here is pure string work (no Node or React imports) so the docs
 * data layer and the markdown renderer can share it.
 */

export const DOCS_REPO = "Sere-Language/sere";
export const DOCS_REF = "main";

/** Folder inside the repository that holds the docs. */
export const DOCS_DIR = "docs";

export const DOCS_REPO_BLOB_BASE = `https://github.com/${DOCS_REPO}/blob/${DOCS_REF}/`;
export const DOCS_REPO_TREE_BASE = `https://github.com/${DOCS_REPO}/tree/${DOCS_REF}/`;
export const DOCS_REPO_RAW_BASE = `https://raw.githubusercontent.com/${DOCS_REPO}/${DOCS_REF}/`;

const SITE_DOCS_ROOT = "/docs";

function splitPath(value: string): string[] {
  return value.split("/").filter(Boolean);
}

/**
 * Turns a docs-relative path into a slug: `reference/strings.md` becomes
 * `reference/strings`, and a folder's own index page (`README.md`, `index.md`)
 * takes the folder's name — including the docs root's `README.md`, which becomes
 * `index` and is served at `/docs`.
 */
export function slugForDocPath(docPath: string): string {
  const parts = splitPath(docPath.replace(/\.md$/i, ""));
  const base = parts[parts.length - 1]?.toLowerCase();
  if (base === "readme" || base === "index") parts.pop();
  return parts.join("/") || "index";
}

export function hrefForSlug(slug: string): string {
  const clean = slug.replace(/^\/+|\/+$/g, "");
  if (!clean || clean === "index") return SITE_DOCS_ROOT;
  return `${SITE_DOCS_ROOT}/${clean}`;
}

/** `docs/reference/strings.md` -> `reference`. */
export function dirForDocPath(docPath: string): string {
  const index = docPath.lastIndexOf("/");
  return index === -1 ? "" : docPath.slice(0, index);
}

/** True for `README.md`, `docs/reference/readme.md`, `index.md`, and friends. */
export function isIndexPath(docPath: string): boolean {
  const base = docPath.split("/").pop()?.toLowerCase() ?? "";
  return base === "readme.md" || base === "index.md";
}

/** `reference` -> `Reference`, `standard-library` -> `Standard Library`. */
export function sectionLabel(section: string): string {
  return section
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveSegments(base: readonly string[], target: string): string[] | null {
  const parts = [...base];
  for (const segment of target.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return parts;
}

/**
 * Resolves a link found on a page in `dir` against the docs folder. Returns null
 * when the target points above the docs folder, e.g. `../CONTRIBUTING.md`.
 */
export function resolveDocPath(dir: string, target: string): string | null {
  const parts = resolveSegments(splitPath(dir), target);
  return parts ? parts.join("/") : null;
}

/**
 * Resolves a link found on a page in `dir` against the repository root, so
 * files outside the docs folder (and images) can still be linked to on GitHub.
 */
export function resolveRepoPath(dir: string, target: string): string | null {
  const parts = resolveSegments([DOCS_DIR, ...splitPath(dir)], target);
  return parts ? parts.join("/") : null;
}

/**
 * The docs pages a markdown index page points at, in the order it lists them.
 * Folder links (`reference/README.md`) resolve to the folder's own page.
 */
export function docSlugsFromMarkdown(source: string, dir: string): string[] {
  const slugs: string[] = [];
  for (const match of source.matchAll(/\]\(\s*([^)\s]+?\.md)(?:#[^)]*)?\s*\)/gi)) {
    const target = match[1];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const docPath = resolveDocPath(dir, target);
    if (!docPath) continue;
    const slug = slugForDocPath(docPath);
    if (!slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

export type DocLink =
  | { kind: "anchor"; href: string }
  | { kind: "internal"; href: string }
  | { kind: "external"; href: string };

/**
 * Rewrites a link from a repository doc. Docs inside the docs folder become site
 * routes; anything else is linked on GitHub so it does not 404 here.
 */
export function resolveDocLink(href: string | undefined, dir: string): DocLink | null {
  const raw = href?.trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return { kind: "anchor", href: raw };
  if (raw.startsWith("//")) return { kind: "external", href: `https:${raw}` };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return { kind: "external", href: raw };

  const hashIndex = raw.indexOf("#");
  const target = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : raw.slice(hashIndex);

  // Root-relative links already name a site route (e.g. /install, /docs/types),
  // so pass them through instead of treating them as a doc path.
  if (target.startsWith("/")) return { kind: "internal", href: raw };

  if (!target) return { kind: "anchor", href: hash || "#" };

  if (/\.md$/i.test(target)) {
    const docPath = resolveDocPath(dir, target);
    if (docPath) {
      return { kind: "internal", href: `${hrefForSlug(slugForDocPath(docPath))}${hash}` };
    }
  }

  const repoPath = resolveRepoPath(dir, target);
  if (!repoPath) return null;
  const base = target.endsWith("/") ? DOCS_REPO_TREE_BASE : DOCS_REPO_BLOB_BASE;
  return { kind: "external", href: `${base}${repoPath.replace(/\/$/, "")}${hash}` };
}

/** `https://github.com/<owner>/<repo>/blob/<ref>/<path>` and `.../raw/<ref>/<path>`. */
const GITHUB_FILE_PAGE = new RegExp(
  `^https?://(?:www\\.)?github\\.com/${DOCS_REPO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(?:blob|raw)/${DOCS_REF}/(.+)$`,
  "i",
);

/**
 * Relative images resolve to the raw file in the repository, and GitHub web URLs
 * (`.../blob/main/docs/icon.png`) are rewritten to raw ones — a browser cannot
 * load an image from a GitHub blob page.
 */
export function resolveDocImage(src: string | undefined, dir: string): string | null {
  const raw = src?.trim();
  if (!raw) return null;
  if (raw.startsWith("/") || raw.startsWith("//")) return raw;

  const webFile = GITHUB_FILE_PAGE.exec(raw);
  if (webFile?.[1]) return DOCS_REPO_RAW_BASE + webFile[1];

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  const repoPath = resolveRepoPath(dir, raw);
  return repoPath ? DOCS_REPO_RAW_BASE + repoPath : null;
}

const IMAGE_TAG = /<img\b[^>]*>/gi;

const HTML_ATTRIBUTE =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function attributesOf(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(HTML_ATTRIBUTE)) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attributes[name] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return attributes;
}

/**
 * Markdown is rendered without raw HTML, so an `<img>` tag written in a doc shows
 * up as literal text. Turning those tags into markdown images keeps the rest of
 * the docs' angle brackets (`<lib>`, `<path>`, and friends) as plain text while
 * images actually load. Fenced code blocks are left alone: they are samples.
 */
export function expandHtmlImages(source: string): string {
  if (!source.includes("<img")) return source;

  const lines = source.split("\n");
  let inFence = false;
  for (const [index, line] of lines.entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !/<img\b/i.test(line)) continue;
    lines[index] = line.replace(IMAGE_TAG, (tag) => {
      const attributes = attributesOf(tag);
      const src = attributes.src;
      if (!src) return tag;
      return `![${attributes.alt ?? ""}](${src})`;
    });
  }
  return lines.join("\n");
}
