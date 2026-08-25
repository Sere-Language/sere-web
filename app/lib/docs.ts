import fs from "node:fs";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

export interface DocEntry {
  slug: string;
  title: string;
  description: string;
  href: string;
  headings: DocHeading[];
}

export interface DocHeading {
  id: string;
  text: string;
}

export interface DocPage extends DocEntry {
  content: string;
}

function readDocsDir(): string[] {
  return fs
    .readdirSync(DOCS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -3));
}

function readSource(slug: string): string {
  return fs.readFileSync(path.join(DOCS_DIR, `${slug}.md`), "utf8");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function toEntry(slug: string, source: string): DocEntry {
  return {
    slug,
    title: titleFromSource(source, slug),
    description: descriptionFromSource(source),
    href: hrefForSlug(slug),
    headings: headingsFromSource(source),
  };
}

export function listDocs(): DocEntry[] {
  const slugs = readDocsDir();
  const sources = new Map(slugs.map((slug) => [slug, readSource(slug)]));
  const indexSource = sources.get("index") ?? "";
  const preferred = orderFromIndex(indexSource);

  const rest = slugs.filter((slug) => slug !== "index");
  rest.sort((left, right) => {
    const leftIndex = preferred.indexOf(left);
    const rightIndex = preferred.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) {
      return titleFromSource(sources.get(left) ?? "", left).localeCompare(
        titleFromSource(sources.get(right) ?? "", right),
      );
    }
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  const ordered = slugs.includes("index") ? ["index", ...rest] : rest;
  return ordered.map((slug) => toEntry(slug, sources.get(slug) ?? ""));
}

export function getDoc(slug: string): DocPage | null {
  const file = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, "utf8");
  return { ...toEntry(slug, content), content };
}

export function neighbors(slug: string): {
  prev: DocEntry | null;
  next: DocEntry | null;
} {
  const docs = listDocs();
  const index = docs.findIndex((doc) => doc.slug === slug);
  return {
    prev: index > 0 ? (docs[index - 1] ?? null) : null,
    next: index >= 0 && index < docs.length - 1 ? (docs[index + 1] ?? null) : null,
  };
}
