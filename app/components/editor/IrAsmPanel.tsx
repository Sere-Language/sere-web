"use client";

import { useEffect, useState } from "react";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import { ensureSereMonaco } from "@/app/lib/sereMonaco";
import { useWorkspace } from "./WorkspaceContext";

const beforeMount: BeforeMount = (monaco) => {
  ensureSereMonaco(monaco);
};

type IrMode = "llvm" | "asm";

export default function IrAsmPanel() {
  const { llvmIr, assembly, settings } = useWorkspace();
  const [mode, setMode] = useState<IrMode>("llvm");
  const text = mode === "llvm" ? llvmIr : assembly;

  useEffect(() => {
    setMode("llvm");
  }, [llvmIr]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 px-3 py-2">
        <button
          type="button"
          className={`min-h-8 rounded-md px-3 py-1 text-[11px] ${
            mode === "llvm" ? "bg-white/10 text-accent" : "text-muted hover:bg-white/6"
          }`}
          aria-pressed={mode === "llvm"}
          onClick={() => setMode("llvm")}
        >
          LLVM IR
        </button>
        <button
          type="button"
          className={`min-h-8 rounded-md px-3 py-1 text-[11px] ${
            mode === "asm" ? "bg-white/10 text-accent" : "text-muted hover:bg-white/6"
          }`}
          aria-pressed={mode === "asm"}
          onClick={() => setMode("asm")}
        >
          ASM
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Editor
          key={`${mode}:${text.length}:${text.slice(0, 48)}:${text.slice(-48)}`}
          height="100%"
          theme="sere-dark"
          language="plaintext"
          path={mode === "llvm" ? "sere-output.ll" : "sere-output.s"}
          value={text}
          beforeMount={beforeMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: settings.fontSize,
            fontFamily:
              '"JetBrainsMono Nerd Font Mono", var(--font-geist-mono), ui-monospace, monospace',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
            domReadOnly: true,
          }}
        />
      </div>
    </div>
  );
}
