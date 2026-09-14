import { listDocs } from "../lib/docs";
import { absoluteUrl, SERE_GITHUB_REPO, SITE_DESCRIPTION, SITE_TAGLINE } from "../lib/seo";

export const revalidate = 3600;

const STATIC_LINKS: Array<{ title: string; path: string; note: string }> = [
  { title: "Home", path: "/", note: "What Sere is and why it exists." },
  {
    title: "Install",
    path: "/install",
    note: "Download the toolchain, put it on PATH, and compile a native binary.",
  },
  {
    title: "Docs",
    path: "/docs",
    note: "The language reference as the Sere compiler implements it.",
  },
  {
    title: "Libraries",
    path: "/libraries",
    note: "Standard library modules and drop-in .slib packages.",
  },
  {
    title: "Community",
    path: "/community",
    note: "Releases, issues, and design conversations in the open.",
  },
  {
    title: "Contribution",
    path: "/contribution",
    note: "How to contribute to the compiler, runtime, and tooling.",
  },
];

/**
 * Serves /llms.txt — a compact, plain-text map of the site aimed at LLM and
 * AI answer engines. https://llmstxt.org/
 */
export async function GET() {
  const lines: string[] = [
    "# Sere",
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `Sere is ${SITE_TAGLINE.toLowerCase()}. Source, standard library, and tooling: ${SERE_GITHUB_REPO}`,
    "",
    "## Pages",
    "",
    ...STATIC_LINKS.map(
      (link) => `- [${link.title}](${absoluteUrl(link.path)}): ${link.note}`,
    ),
    "",
  ];

  try {
    const docs = await listDocs();
    const docLinks = docs
      .filter((doc) => doc.slug !== "index")
      .map((doc) => {
        const note = doc.description ? `: ${doc.description}` : "";
        return `- [${doc.title}](${absoluteUrl(doc.href)})${note}`;
      });

    if (docLinks.length > 0) {
      lines.push("## Documentation", "", ...docLinks, "");
    }
  } catch {
    // Static page list is still useful if the docs source is unavailable.
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
