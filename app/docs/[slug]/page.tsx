import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DocMarkdown from "../../components/docs/Markdown";
import DocToc from "../../components/docs/DocToc";
import DocsPager from "../../components/docs/DocsPager";
import { getDoc, neighbors } from "../../lib/docs";

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
  if (!doc) return { title: "Docs - Sere" };
  return {
    title: `${doc.title} - Sere`,
    description: doc.description,
  };
}

export default async function DocSlugPage({ params }: DocSlugPageProps) {
  const { slug } = await params;
  if (slug === "index") notFound();

  const doc = await getDoc(slug);
  if (!doc) notFound();

  const { prev, next } = await neighbors(slug);

  return (
    <div className="flex gap-12">
      <article className="min-w-0 flex-1">
        <DocMarkdown source={doc.content} />
        <DocsPager prev={prev} next={next} />
      </article>
      <aside className="sticky top-20 hidden h-fit w-48 shrink-0 xl:block">
        <DocToc headings={doc.headings} />
      </aside>
    </div>
  );
}
