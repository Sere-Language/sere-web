import fs from "node:fs";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");
const GITHUB_DOCS_API = "https://api.github.com/repos/Sere-Language/sere/contents/docs";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

export interface DocEntry {
  slug: string;
  title: string;
  description: string;
  href: string;
  headings: DocHeading[];
  lastModified: string | null;
}

export interface DocHeading {
  id: string;
  text: string;
}

export interface DocPage extends DocEntry {
  content: string;
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

async function fetchFromGitHub(): Promise<Map<string, { content: string; sha: string; lastModified: string | null }>> {
  try {
    const response = await fetch(GITHUB_DOCS_API, {
      headers: githubHeaders(),
      // Cache the listing for a few minutes, not forever.
      next: { revalidate: 300 },
    });
    if (!response.ok) return new Map();
    const files = (await response.json()) as Array<{
      name: string;
      download_url: string;
      sha: string;
      updated_at: string | null;
    }>;

    const result = new Map<string, { content: string; sha: string; lastModified: string | null }>();
    for (const file of files) {
      if (!file.name.endsWith(".md")) continue;
      const contentResponse = await fetch(file.download_url, {
        headers: githubHeaders(),
      });
      if (!contentResponse.ok) continue;
      const content = await contentResponse.text();
      result.set(file.name.replace(".md", ""), {
        content,
        sha: file.sha,
        lastModified: file.updated_at,
      });
    }
    return result;
  } catch {
    return new Map();
  }
}

function readLocalDocs(): Map<string, { content: string; sha: null; lastModified: null }> {
  const result = new Map<string, { content: string; sha: null; lastModified: null }>();
  try {
    const files = fs.readdirSync(DOCS_DIR).filter((name) => name.endsWith(".md"));
    for (const file of files) {
      const slug = file.replace(".md", "");
      result.set(slug, {
        content: fs.readFileSync(path.join(DOCS_DIR, file), "utf8"),
        sha: null,
        lastModified: null,
      });
    }
  } catch {
    // Fall back to empty if content dir is missing.
  }
  return result;
}

// GitHub first, local files as fallback so the site still works offline.


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

function hrefForSlug(slug: string): string {
  return slug === "index" ? "/docs" : `/docs/${slug}`;
}

function orderFromIndex(source: string): string[] {
  const slugs: string[] = [];
  for (const match of source.matchAll(/\]\(([a-z0-9-]+)\.md\)/gi)) {
    const slug = match[1];
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

function toEntry(slug: string, source: string, lastModified: string | null): DocEntry {
  return {
    slug,
    title: titleFromSource(source, slug),
    description: descriptionFromSource(source),
    href: hrefForSlug(slug),
    headings: headingsFromSource(source),
    lastModified,
  };
}

async function readDocsDir(): Promise<string[]> {
  const local = readLocalDocs();
  const github = await fetchFromGitHub();
  const slugs = new Set([...local.keys(), ...github.keys()]);
  return [...slugs];
}

async function readSourceContent(slug: string): Promise<{ source: string; sha: string | null; lastModified: string | null }> {
  const github = await fetchFromGitHub();
  if (github.has(slug)) {
    return { source: github.get(slug)!.content, sha: github.get(slug)!.sha, lastModified: github.get(slug)!.lastModified };
  }
  const local = readLocalDocs();
  if (local.has(slug)) {
    return { source: local.get(slug)!.content, sha: local.get(slug)!.sha, lastModified: local.get(slug)!.lastModified };
  }
  return { source: "", sha: null, lastModified: null };
}

async function listDocsInternal(): Promise<DocEntry[]> {
  const slugs = await readDocsDir();
  const sources: Map<string, { source: string; lastModified: string | null }> = new Map();

  for (const slug of slugs) {
    const data = await readSourceContent(slug);
    sources.set(slug, { source: data.source, lastModified: data.lastModified });
  }

  const indexSource = sources.get("index")?.source ?? "";
  const preferred = orderFromIndex(indexSource);

  const rest = slugs.filter((slug) => slug !== "index");
  rest.sort((left, right) => {
    const leftIndex = preferred.indexOf(left);
    const rightIndex = preferred.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) {
      const leftSource = sources.get(left)?.source ?? "";
      const rightSource = sources.get(right)?.source ?? "";
      return titleFromSource(leftSource, left).localeCompare(titleFromSource(rightSource, right));
    }
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  const ordered = slugs.includes("index") ? ["index", ...rest] : rest;
  const entries: DocEntry[] = [];
  for (const slug of ordered) {
    const data = sources.get(slug);
    if (data) {
      entries.push(toEntry(slug, data.source, data.lastModified));
    }
  }
  return entries;
}

export async function listDocs(): Promise<DocEntry[]> {
  return listDocsInternal();
}

// Sync docs on-demand - can be called via API or scheduler
export async function syncDocsFromGitHub(): Promise<{ synced: number; errors: string[] }> {
  const github = await fetchFromGitHub();
  const errors: string[] = [];
  let synced = 0;

  for (const [slug, data] of github) {
    try {
      const filePath = path.join(DOCS_DIR, `${slug}.md`);
      fs.writeFileSync(filePath, data.content, "utf8");
      synced++;
    } catch (e) {
      errors.push(`Failed to sync ${slug}: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  return { synced, errors };
}

export async function getDoc(slug: string): Promise<DocPage | null> {
  const { source, lastModified } = await readSourceContent(slug);
  if (!source) return null;
  const entry = toEntry(slug, source, lastModified);
  return { ...entry, content: source };
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
