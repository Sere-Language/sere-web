import Link from "next/link";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "../CodeBlock";
import { highlightSere } from "../../utils/highlight";
import { slugify } from "../../lib/docs";

function rewriteHref(href: string | undefined): string | undefined {
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
    return href;
  }

  const [file, hash] = href.split("#");
  const slug = (file ?? "").replace(/^\.\//, "").replace(/\.md$/, "");
  if (!slug) return hash ? `#${hash}` : href;
  const path = slug === "index" ? "/docs" : `/docs/${slug}`;
  return hash ? `${path}#${hash}` : path;
}

function headingText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(headingText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return headingText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-0 mb-4">{children}</h1>
  ),
  h2: ({ children }) => {
    const text = headingText(children);
    const id = slugify(text) || undefined;
    return <h2 id={id} className="mt-12 mb-3 pb-2 border-b border-border-muted">{children}</h2>;
  },
  h3: ({ children }) => {
    const text = headingText(children);
    const id = slugify(text) || undefined;
    return <h3 id={id} className="mt-8 mb-2">{children}</h3>;
  },
  a: ({ href, children }) => {
    const next = rewriteHref(href);
    if (!next) return <span>{children}</span>;
    if (next.startsWith("http://") || next.startsWith("https://")) {
      return (
        <a href={next} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
          {children}
          <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      );
    }
    return <Link href={next}>{children}</Link>;
  },
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, "");
    const lang = className?.replace("language-", "") ?? "";
    const isBlock = Boolean(className) || text.includes("\n");

    if (!isBlock) return <code>{children}</code>;

    const highlighted = lang === "sere" ? highlightSere(text) : text;

    return (
      <div className="my-6">
        <CodeBlock filename={lang || undefined} wide>
          {highlighted}
        </CodeBlock>
      </div>
    );
  },
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full">{children}</table>
    </div>
  ),
};

export default function DocMarkdown({ source }: { source: string }) {
  return (
    <div className="doc-prose">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </Markdown>
    </div>
  );
}
