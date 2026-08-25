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
  quiet = false,
  children,
}: CodeBlockProps) {
  const sizeClass = wide
    ? "w-full min-w-0"
    : compact
      ? "w-fit max-w-full"
      : "w-fit min-w-[22rem] max-w-full";

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-sm ${
        quiet ? "" : "shadow-[0_0_80px_-24px_rgba(194,82,72,0.28)]"
      } ${sizeClass} ${className ?? ""}`}
    >
      {filename ? (
        <div
          className={`border-b border-border font-mono text-muted ${
            compact ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-xs"
          }`}
        >
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
