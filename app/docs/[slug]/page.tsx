import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DocsPager from "../../components/docs/DocsPager";
import DocToc from "../../components/docs/DocToc";
import DocMarkdown from "../../components/docs/Markdown";
import JsonLd from "../../components/JsonLd";
import { getDoc, neighbors } from "../../lib/docs";
import { breadcrumbJsonLd, pageMetadata, techArticleJsonLd } from "../../lib/seo";

interface DocSlugPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = true;

// Not statically generated. Docs are synced from the sere repo on demand,
// so new pages show up without a rebuild.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: DocSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDoc(slug);

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
  });
}

export default async function DocSlugPage({ params }: DocSlugPageProps) {
  const { slug } = await params;
  if (slug === "index") notFound();

  const doc = await getDoc(slug);
  if (!doc) notFound();

  const { prev, next } = await neighbors(slug);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Docs", path: "/docs" },
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
            <li>
              <Link
                href="/"
                className="text-muted no-underline transition-colors hover:text-primary"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-muted/50">
              /
            </li>
            <li>
              <Link
                href="/docs"
                className="text-muted no-underline transition-colors hover:text-primary"
              >
                Docs
              </Link>
            </li>
            <li aria-hidden="true" className="text-muted/50">
              /
            </li>
            <li aria-current="page" className="text-foreground/80">
              {doc.title}
            </li>
          </ol>
        </nav>
        <DocMarkdown source={doc.content} />
        <DocsPager prev={prev} next={next} />
      </article>
      <aside className="sticky top-20 hidden h-fit w-48 shrink-0 xl:block">
        <DocToc headings={doc.headings} />
      </aside>
    </div>
  );
}
