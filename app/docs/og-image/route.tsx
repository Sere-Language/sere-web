import type { NextRequest } from "next/server";
import { getDoc, normalizeSlug } from "../../lib/docs";
import { renderOgImage } from "../../lib/og";

/**
 * Social card for a docs page, e.g. `/docs/og-image?slug=reference/strings`.
 *
 * A catch-all route segment has to stay last, so `app/docs/[...slug]/` cannot
 * host an `opengraph-image` file convention; the docs pages point their metadata
 * at this handler instead.
 */
export async function GET(request: NextRequest) {
  const slug = normalizeSlug(request.nextUrl.searchParams.get("slug") ?? "");

  // A failed lookup must never break the card, so fall back to generic copy.
  let title = "Sere documentation";
  let subtitle = "The language reference as the Sere compiler implements it.";
  try {
    const doc = await getDoc(slug);
    if (doc) {
      title = doc.title;
      subtitle = doc.description || subtitle;
    }
  } catch {
    // Keep the fallback copy.
  }

  const image = renderOgImage({
    badge: "Documentation",
    title,
    subtitle: subtitle.slice(0, 190),
    command: `sere-lang.com/docs/${slug}`,
  });

  image.headers.set(
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  return image;
}
