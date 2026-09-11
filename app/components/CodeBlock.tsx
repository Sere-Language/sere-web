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
    <div className={`code-block group relative shrink-0 overflow-hidden ${sizeClass} ${className ?? ""}`}>
      {/* Ember filament along the top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100" />

      {filename ? (
        <div
          className={`code-block-titlebar relative flex items-center gap-2.5 font-mono ${
            compact ? "px-3 py-2 text-[11px]" : "px-4 py-2.5 text-xs"
          }`}
        >
          <span className="h-3.5 w-[3px] rounded-full bg-primary shadow-[0_0_10px_rgba(196,88,74,0.85)]" />
          <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="truncate tracking-tight text-foreground/80">{filename}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-3">
            <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
            <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/80 shadow-[0_0_8px_rgba(196,88,74,0.7)]" />
          </span>
        </div>
      ) : null}

      <pre
        className={`relative m-0 border-0 bg-transparent ${
          compact ? "px-3.5 py-3 text-[13px] leading-6" : "px-5 py-4 text-sm leading-6"
        }`}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}
