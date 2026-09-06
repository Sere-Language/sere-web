interface CodeBlockProps {
  className?: string;
  filename?: string;
  compact?: boolean;
  wide?: boolean;
  quiet?: boolean;
  children: React.ReactNode;
}

export default function CodeBlock({
  className,
  filename,
  compact = false,
  wide = false,
  children,
}: CodeBlockProps) {
  const sizeClass = wide
    ? "w-full min-w-0"
    : compact
      ? "w-fit max-w-full"
      : "w-full min-w-0 sm:w-fit sm:min-w-[22rem] sm:max-w-full";

  return (
    <div
      className={`code-block shrink-0 overflow-hidden rounded-lg border border-border bg-card ${sizeClass} hover:border-border-strong hover:shadow-lg transition-all duration-200 ${className ?? ""}`}
      style={{
        background: "linear-gradient(180deg, #161a1e 0%, #121417 100%)",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)"
      }}
    >
      {filename ? (
        <div
          className={`border-b border-border font-mono text-muted flex items-center gap-2 ${
            compact ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-xs"
          }`}
          style={{
            borderBottom: "1px solid var(--color-border)",
            boxShadow: "inset 0 -1px 0 rgba(0, 0, 0, 0.2)"
          }}
        >
          <svg className="w-3.5 h-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          {filename}
        </div>
      ) : null}
      <pre
        className={`m-0 border-0 bg-transparent ${
          compact ? "px-3.5 py-3 text-[13px] leading-6" : "px-5 py-4 text-sm leading-6"
        }`}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}
