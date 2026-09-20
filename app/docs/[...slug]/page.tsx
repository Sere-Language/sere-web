import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DocsPager from "../../components/docs/DocsPager";
import DocToc from "../../components/docs/DocToc";
import DocMarkdown from "../../components/docs/Markdown";
import JsonLd from "../../components/JsonLd";
import { sectionLabel } from "../../lib/docLinks";
import { getDoc, neighbors, normalizeSlug } from "../../lib/docs";
import { OG_SIZE } from "../../lib/og";
import {
    absoluteUrl,
    breadcrumbJsonLd,
    pageMetadata,
    techArticleJsonLd,
} from "../../lib/seo";

export const dynamicParams = true;

// Not statically generated. Docs are synced from the sere repo on demand,
// so new pages show up without a rebuild.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/docs/[...slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDoc(normalizeSlug(slug.join("/")));

  if (!doc) {
    return {
      title: "Documentation",
      robots: { index: false, follow: true },
    };
  }

  return pageMetadata({
    title: doc.title,
    description:
      doc.description || `The Sere language reference for ${doc.title}.`,
    path: doc.href,
    ogType: "article",
    modifiedTime: doc.lastModified ?? undefined,
    keywords: [`Sere ${doc.title.toLowerCase()}`, "Sere language reference"],
    images: [
      {
        url: absoluteUrl(`/docs/og-image?slug=${encodeURIComponent(doc.slug)}`),
        ...OG_SIZE,
        alt: `${doc.title} docs on sere-lang.com`,
      },
    ],
  });
}

export default async function DocPage({ params }: PageProps<"/docs/[...slug]">) {
  const { slug } = await params;
  // Nested docs from the repository (docs/reference/strings.md and friends) land
  // here as several path segments.
  const key = normalizeSlug(slug.join("/"));

  // The docs home is served by app/docs/page.tsx.
  if (key === "index") notFound();

  const doc = await getDoc(key);
  if (!doc) notFound();

  const { prev, next } = await neighbors(key);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Docs", path: "/docs" },
    ...(doc.section
      ? [{ name: sectionLabel(doc.section), path: `/docs/${doc.section}` }]
      : []),
    { name: doc.title, path: doc.href },
  ];

  return (
    <div className="flex gap-12">
      <JsonLd
        data={[
          techArticleJsonLd({
            headline: doc.title,
            description:
              doc.description || `The Sere language reference for ${doc.title}.`,
            path: doc.href,
            modifiedTime: doc.lastModified,
            keywords: doc.headings.slice(0, 8).map((heading) => heading.text),
          }),
          breadcrumbJsonLd(breadcrumbs),
        ]}
      />
      <article className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex list-none flex-wrap items-center gap-2 p-0 text-xs text-muted">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <li key={crumb.path} className="flex items-center gap-2">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-muted/50">
                      /
                    </span>
                  ) : null}
                  {last ? (
                    <span aria-current="page" className="text-foreground/80">
                      {crumb.name}
                    </span>
                  ) : (
                    <Link
                      href={crumb.path}
                      className="text-muted no-underline transition-colors hover:text-primary"
                    >
                      {crumb.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <DocMarkdown source={doc.content} dir={doc.dir} />
        <DocsPager prev={prev} next={next} />
      </article>
      <aside className="sticky top-20 hidden h-fit w-48 shrink-0 xl:block">
        <DocToc headings={doc.headings} />
      </aside>
    </div>
  );
}
