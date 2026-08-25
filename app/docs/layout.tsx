import DocsSidebar from "../components/docs/DocsSidebar";
import { listDocs } from "../lib/docs";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  const docs = listDocs();

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-10 px-6 py-10">
      <aside className="md:sticky md:top-16 md:h-[calc(100svh-5rem)] md:w-56 md:shrink-0 md:overflow-y-auto">
        <DocsSidebar docs={docs} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
