import fs from "node:fs";
import path from "node:path";
import {
  DOCS_REF,
  DOCS_REPO,
  DOCS_DIR as REPO_DOCS_DIR,
  dirForDocPath,
  docSlugsFromMarkdown,
  hrefForSlug,
  isIndexPath,
  slugForDocPath,
} from "./docLinks";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_TREE_API = `https://api.github.com/repos/${DOCS_REPO}/git/trees/${DOCS_REF}?recursive=1`;
/** Raw markdown for the docs folder. Paths are docs-relative, so this prefix is required. */
const GITHUB_DOCS_RAW_BASE = `https://raw.githubusercontent.com/${DOCS_REPO}/${DOCS_REF}/${REPO_DOCS_DIR}/`;

/** How long a fetched copy of the repository docs is reused before refetching. */
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
/** The docs are ~50 small files; a handful of parallel downloads is plenty. */
const FETCH_CONCURRENCY = 8;

export interface DocEntry {
  /**
   * Repository path with the extension dropped: `index` for content/docs/index.md,
   * `reference` for docs/reference/README.md, `reference/strings` for
   * docs/reference/strings.md.
   */
  slug: string;
  title: string;
  description: string;
  href: string;
  headings: DocHeading[];
  lastModified: string | null;
  /** Top-level folder the page lives in (`reference`), or null at the docs root. */
  section: string | null;
  /** Docs-relative folder the page lives in: "" or `reference`. */
  dir: string;
}

export interface DocHeading {
  id: string;
  text: string;
}

export interface DocPage extends DocEntry {
  content: string;
}

interface DocFile {
  slug: string;
  /** Docs-relative path including the extension, e.g. `reference/strings.md`. */
  path: string;
  content: string;
  lastModified: string | null;
}

interface DocsSnapshot {
  files: Map<string, DocFile>;
  /** Where the pages came from; a good snapshot outlives a degraded one. */
  origin: "github" | "local";
  fetchedAt: number;
}

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sere-web",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * The README at the top of the docs folder describes the repository rather than
 * the docs themselves, so it is not a docs page. A folder's own README is kept:
 * it is the index page for the pages next to it.
 */
function isRepositoryReadme(docPath: string): boolean {
  return !docPath.includes("/") && /^readme\.md$/i.test(docPath);
}

/**
 * Lists every markdown file under the repository's docs folder. The Git Trees API
 * is recursive, so `docs/reference/*` comes back with the rest of them, and one
 * request covers the whole folder. Returns docs-relative paths such as
 * `reference/strings.md`.
 */
async function fetchGitHubDocPaths(): Promise<string[]> {
  try {
    const response = await fetch(GITHUB_TREE_API, {
      headers: githubHeaders(),
      // Cache the listing for a few minutes, not forever.
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      console.error(
        `Docs: could not list ${DOCS_REPO}/${REPO_DOCS_DIR} (GitHub returned ${response.status}).`,
      );
      return [];
    }
    const payload = (await response.json()) as {
      tree?: Array<{ path?: string; type?: string }>;
    };
    const prefix = `${REPO_DOCS_DIR}/`;
    return (payload.tree ?? [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path ?? "")
      // Only the docs folder, and only markdown.
      .filter((filePath) => filePath.startsWith(prefix) && /\.md$/i.test(filePath))
      .map((filePath) => filePath.slice(prefix.length))
      .filter((docPath) => !isRepositoryReadme(docPath))
      .sort();
  } catch (error) {
    console.error(
      `Docs: could not list ${DOCS_REPO}/${REPO_DOCS_DIR}: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return [];
  }
}

/** Downloads the raw markdown for each docs-relative path. */
async function fetchGitHubFiles(docPaths: string[]): Promise<DocFile[]> {
  const files: DocFile[] = [];
  const failures: string[] = [];
  let cursor = 0;

  async function download() {
    while (cursor < docPaths.length) {
      const docPath = docPaths[cursor];
      cursor += 1;
      if (!docPath) continue;
      try {
        const response = await fetch(GITHUB_DOCS_RAW_BASE + docPath, {
          headers: githubHeaders(),
          next: { revalidate: 300 },
        });
        if (!response.ok) {
          failures.push(`${docPath} (${response.status})`);
          continue;
        }
        files.push({
          slug: slugForDocPath(docPath),
          path: docPath,
          content: await response.text(),
          lastModified: null,
        });
      } catch (error) {
        // One unreadable page must not take the whole docs tree down.
        failures.push(`${docPath} (${error instanceof Error ? error.message : "unknown error"})`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, docPaths.length) }, download),
  );

  if (failures.length > 0) {
    console.error(`Docs: could not download ${failures.length} page(s): ${failures.join(", ")}`);
  }

  return files;
}

/** Reads the checked-in copy under content/docs, nested folders included. */
function readLocalDocs(): DocFile[] {
  const files: DocFile[] = [];

  const walk = (directory: string, prefix: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      // Fall back to empty if the content dir is missing.
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const docPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, docPath);
        continue;
      }
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
      if (isRepositoryReadme(docPath)) continue;
      try {
        files.push({
          slug: slugForDocPath(docPath),
          path: docPath,
          content: fs.readFileSync(fullPath, "utf8"),
          lastModified: null,
        });
      } catch {
        // Skip unreadable files rather than failing the whole page.
      }
    }
  };

  walk(DOCS_DIR, "");
  return files;
}

function toFileMap(files: DocFile[]): Map<string, DocFile> {
  const map = new Map<string, DocFile>();
  for (const file of files) map.set(file.slug, file);
  return map;
}

/**
 * The repository is the source of truth: for any slug it has, the repository copy
 * wins over the checked-in one. The copy under content/docs fills in the pages
 * the repository does not have (the site's own guides) and keeps the docs
 * readable when GitHub cannot be reached.
 */
async function buildSnapshot(): Promise<DocsSnapshot> {
  const files = toFileMap(readLocalDocs());
  const docPaths = await fetchGitHubDocPaths();
  const remote = docPaths.length > 0 ? await fetchGitHubFiles(docPaths) : [];

  for (const file of remote) files.set(file.slug, file);

  return {
    files,
    origin: remote.length > 0 ? "github" : "local",
    fetchedAt: Date.now(),
  };
}

// One snapshot per process, shared by every page render, plus the in-flight
// promise so concurrent renders do not each fetch the docs again.
let snapshot: DocsSnapshot | null = null;
let pendingSnapshot: Promise<DocsSnapshot> | null = null;

async function loadSnapshot(): Promise<DocsSnapshot> {
  const current = snapshot;
  if (current && Date.now() - current.fetchedAt < SNAPSHOT_TTL_MS) return current;
  if (pendingSnapshot) return pendingSnapshot;

  const pending = buildSnapshot()
    .then((next) => {
      // A GitHub outage should not replace a good copy with a local-only one.
      if (next.origin === "github" || !snapshot) snapshot = next;
      return snapshot ?? next;
    })
    .catch<DocsSnapshot>(
      () => snapshot ?? { files: new Map(), origin: "local", fetchedAt: Date.now() },
    )
    .finally(() => {
      pendingSnapshot = null;
    });

  pendingSnapshot = pending;
  return pending;
}

function titleFromSource(source: string, slug: string): string {
  const match = source.match(/^#\s+(.+)$/m);
  return match?.[1]?.replace(/[`*_]/g, "").trim() ?? slug;
}

function descriptionFromSource(source: string): string {
  const body = source.replace(/^#\s+.+$/m, "").trim();
  const para = body.split(/\n\n/)[0] ?? "";
  return para
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingsFromSource(source: string): DocHeading[] {
  const headings: DocHeading[] = [];
  for (const match of source.matchAll(/^##\s+(.+)$/gm)) {
    const text = match[1]?.replace(/[`*_]/g, "").trim() ?? "";
    if (text) headings.push({ id: slugify(text), text });
  }
  return headings;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A folder's own index page (README.md / index.md) stands in for the folder. */
function indexSlugForDir(files: Map<string, DocFile>, dir: string): string | null {
  if (dir === "") return files.has("index") ? "index" : null;
  for (const file of files.values()) {
    if (dirForDocPath(file.path) === dir && isIndexPath(file.path)) return file.slug;
  }
  return null;
}

function compareByTitle(left: DocFile, right: DocFile): number {
  return titleFromSource(left.content, left.slug).localeCompare(
    titleFromSource(right.content, right.slug),
  );
}

function isFolderIndex(file: DocFile): boolean {
  return dirForDocPath(file.path) !== "" && isIndexPath(file.path);
}

/**
 * Pages in the order the repository's own index pages list them: the docs README
 * ranks the pages at the docs root, and a folder's README ranks the pages inside
 * it. Folders are kept together, and anything unlisted falls back to alphabetical.
 */
function orderDocs(files: Map<string, DocFile>): DocFile[] {
  const ordered: DocFile[] = [];
  const seen = new Set<string>();

  const push = (slug: string) => {
    const file = files.get(slug);
    if (!file || seen.has(slug)) return;
    seen.add(slug);
    ordered.push(file);
  };

  const orderedChildren = (dir: string): DocFile[] => {
    const indexSlug = indexSlugForDir(files, dir);
    const children = [...files.values()].filter(
      (file) => dirForDocPath(file.path) === dir && file.slug !== indexSlug,
    );
    const preferred = indexSlug
      ? docSlugsFromMarkdown(files.get(indexSlug)?.content ?? "", dir)
      : [];
    const ranked = preferred
      .map((slug) => children.find((child) => child.slug === slug))
      .filter((child): child is DocFile => Boolean(child));
    const rest = children
      .filter((child) => !preferred.includes(child.slug))
      .sort(compareByTitle);
    return [...ranked, ...rest];
  };

  const emit = (slug: string) => {
    const file = files.get(slug);
    if (!file || seen.has(slug)) return;
    push(slug);
    // A folder index drags its folder along, right behind itself.
    if (isFolderIndex(file)) {
      for (const child of orderedChildren(dirForDocPath(file.path))) emit(child.slug);
    }
  };

  push("index");

  const rootIndex = files.get("index");
  const rootLinks = rootIndex ? docSlugsFromMarkdown(rootIndex.content, "") : [];

  // Pages at the docs root first, ranked by the docs README.
  for (const slug of rootLinks) {
    const file = files.get(slug);
    if (file && !isFolderIndex(file)) emit(slug);
  }
  for (const file of orderedChildren("")) emit(file.slug);

  // Then one group per folder: its index page followed by the pages inside it.
  for (const slug of rootLinks) {
    const file = files.get(slug);
    if (file && isFolderIndex(file)) emit(slug);
  }
  // Folders the index never mentions, and any other stragglers. A folder's index
  // page leads its folder even when nothing links to it.
  const stragglers = [...files.values()].sort((left, right) => {
    if (isFolderIndex(left) !== isFolderIndex(right)) return isFolderIndex(left) ? -1 : 1;
    return compareByTitle(left, right);
  });
  for (const file of stragglers) emit(file.slug);

  return ordered;
}

function toEntry(file: DocFile): DocEntry {
  const dir = dirForDocPath(file.path);
  return {
    slug: file.slug,
    title: titleFromSource(file.content, file.slug),
    description: descriptionFromSource(file.content),
    href: hrefForSlug(file.slug),
    headings: headingsFromSource(file.content),
    lastModified: file.lastModified,
    section: dir ? (dir.split("/")[0] ?? null) : null,
    dir,
  };
}

/** Accepts `/docs/reference/strings` style input, with or without the .md. */
export function normalizeSlug(slug: string): string {
  const trimmed = slug.replace(/^\/+|\/+$/g, "");
  return trimmed ? slugForDocPath(trimmed) : "index";
}

export async function listDocs(): Promise<DocEntry[]> {
  const { files } = await loadSnapshot();
  return orderDocs(files).map(toEntry);
}

/**
 * Pulls the repository docs down and mirrors them under content/docs, nested
 * folders included. The next render reads what was written.
 */
export async function syncDocsFromGitHub(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const docPaths = await fetchGitHubDocPaths();

  if (docPaths.length === 0) {
    return {
      synced: 0,
      errors: [`Could not list markdown files under ${DOCS_REPO}/${REPO_DOCS_DIR}.`],
    };
  }

  let synced = 0;
  for (const file of await fetchGitHubFiles(docPaths)) {
    const segments = file.path
      .split("/")
      .filter((segment) => segment && segment !== "." && segment !== "..");
    if (segments.length === 0) continue;
    try {
      const destination = path.join(DOCS_DIR, ...segments);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.content, "utf8");
      synced += 1;
    } catch (error) {
      errors.push(
        `Failed to sync ${file.path}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  // Drop the cached copy so the next render picks up the fresh mirror.
  snapshot = null;
  pendingSnapshot = null;

  return { synced, errors };
}

export async function getDoc(slug: string): Promise<DocPage | null> {
  const { files } = await loadSnapshot();
  const file = files.get(normalizeSlug(slug));
  if (!file) return null;
  return { ...toEntry(file), content: file.content };
}

export async function neighbors(slug: string): Promise<{
  prev: DocEntry | null;
  next: DocEntry | null;
}> {
  const docs = await listDocs();
  const index = docs.findIndex((doc) => doc.slug === slug);
  return {
    prev: index > 0 ? (docs[index - 1] ?? null) : null,
    next: index >= 0 && index < docs.length - 1 ? (docs[index + 1] ?? null) : null,
  };
}
