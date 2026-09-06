import DocsSidebar from "../components/docs/DocsSidebar";
import { listDocs } from "../lib/docs";

export const revalidate = 600;

async function DocsLayout({ children }: LayoutProps<"/docs">) {
  const docs = await listDocs();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:gap-10 md:py-10">
      <aside className="md:sticky md:top-16 md:h-[calc(100svh-5rem)] md:w-56 md:shrink-0 md:overflow-y-auto">
        <DocsSidebar docs={docs} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
export default DocsLayout;
