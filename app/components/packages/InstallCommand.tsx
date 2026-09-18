"use client";

import { useEffect, useRef, useState } from "react";

interface InstallCommandProps {
  command: string;
  hint?: string;
}

/** The one line a reader actually needs, with a copy button. */
export default function InstallCommand({ command, hint }: InstallCommandProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the command stays selectable.
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="well flex items-center gap-3 px-3.5 py-2.5">
        <span className="shrink-0 font-mono text-xs text-primary">$</span>
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground select-all">
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy: ${command}`}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-muted uppercase transition-colors hover:border-border-strong hover:text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {hint ? <p className="m-0 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
