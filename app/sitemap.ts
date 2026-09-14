import type { MetadataRoute } from "next";
import { listDocs } from "./lib/docs";
import { absoluteUrl } from "./lib/seo";

// Regenerate hourly. Doc pages are synced from the Sere repository, so a short
// window keeps new pages discoverable without hammering the GitHub API.
export const revalidate = 3600;

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/install", changeFrequency: "weekly", priority: 0.9 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.9 },
  { path: "/libraries", changeFrequency: "monthly", priority: 0.8 },
  { path: "/issues", changeFrequency: "daily", priority: 0.6 },
  { path: "/community", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contribution", changeFrequency: "monthly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let docEntries: MetadataRoute.Sitemap = [];
  try {
    const docs = await listDocs();
    docEntries = docs
      // "index" is served at /docs, and "README" is a repository artifact
      // rather than a page readers should land on from search.
      .filter(
        (doc) =>
          doc.slug !== "index" && doc.slug.toLowerCase() !== "readme",
      )
      .map((doc) => ({
        url: absoluteUrl(doc.href),
        lastModified: doc.lastModified ? new Date(doc.lastModified) : now,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
  } catch {
    // Sitemap still ships the static routes if the docs source is unavailable.
  }

  return [...staticEntries, ...docEntries];
}
