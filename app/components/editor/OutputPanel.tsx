"use client";

import { useEffect, useRef } from "react";
import { useWorkspace } from "./WorkspaceContext";

export default function OutputPanel() {
  const { outputText, settings } = useWorkspace();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [outputText]);

  return (
    <pre
      className="m-0 h-full overflow-auto bg-transparent px-4 py-3 leading-6 text-[#c8c2be]"
      style={{
        fontSize: settings.fontSize,
        fontFamily:
          '"JetBrainsMono Nerd Font Mono", var(--font-geist-mono), ui-monospace, monospace',
      }}
    >
      {outputText}
      <div ref={endRef} />
    </pre>
  );
}
