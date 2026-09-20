import Link from "next/link";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { expandHtmlImages, resolveDocImage, resolveDocLink } from "../../lib/docLinks";
import { slugify } from "../../lib/docs";
import { highlightSere } from "../../utils/highlight";
import CodeBlock from "../CodeBlock";

function headingText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(headingText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return headingText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
      {children}
      <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

/**
 * The docs are written in the Sere repository, where links are relative to the
 * page that holds them (and folders are real folders), so every link is resolved
 * against `dir` before it reaches the browser.
 */
function createComponents(dir: string): Components {
  return {
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
      const target = resolveDocLink(href, dir);
      if (!target) return <span>{children}</span>;
      if (target.kind === "external") {
        return <ExternalLink href={target.href}>{children}</ExternalLink>;
      }
      if (target.kind === "anchor") return <a href={target.href}>{children}</a>;
      return <Link href={target.href}>{children}</Link>;
    },
    img: ({ src, alt }) => {
      const resolved = resolveDocImage(typeof src === "string" ? src : undefined, dir);
      if (!resolved) return null;
      // Remote images from the repository are served as-is, so next/image would
      // need every raw.githubusercontent.com URL allowlisted first.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={resolved} alt={alt ?? ""} loading="lazy" />;
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
}

export default function DocMarkdown({ source, dir = "" }: { source: string; dir?: string }) {
  return (
    <div className="doc-prose">
      <Markdown remarkPlugins={[remarkGfm]} components={createComponents(dir)}>
        {expandHtmlImages(source)}
      </Markdown>
    </div>
  );
}
