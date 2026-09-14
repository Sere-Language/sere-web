import { getDoc } from "../../lib/docs";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "../../lib/og";

export const alt = "Sere documentation";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface DocImageProps {
  params: Promise<{ slug: string }>;
}

export default async function DocOpengraphImage({ params }: DocImageProps) {
  const { slug } = await params;

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

  return renderOgImage({
    badge: "Documentation",
    title,
    subtitle: subtitle.slice(0, 190),
    command: `sere-lang.com/docs/${slug}`,
  });
}
