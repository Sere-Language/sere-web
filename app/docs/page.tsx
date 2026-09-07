import type { Metadata } from "next";
import DocMarkdown from "../components/docs/Markdown";
import DocToc from "../components/docs/DocToc";
import DocsPager from "../components/docs/DocsPager";
import { getDoc, neighbors } from "../lib/docs";

export const metadata: Metadata = {
    title: "Docs - Sere",
    description: "Language reference as the Sere compiler implements it.",
  };
  export const revalidate = 300;

async function Page() {
  const doc = await getDoc("index");
  if (!doc) return null;
  const { next } = await neighbors("index");

  return (
    <div className="flex gap-12">
      <article className="min-w-0 flex-1">
        <DocMarkdown source={doc.content} />
        <DocsPager prev={null} next={next} />
      </article>
      <aside className="sticky top-20 hidden h-fit w-48 shrink-0 xl:block">
        <DocToc headings={doc.headings} />
      </aside>
    </div>
  );
}

export default Page;
