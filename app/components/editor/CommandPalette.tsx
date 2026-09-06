"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { persistableFiles } from "@/app/lib/sereInit";
import { useWorkspace } from "./WorkspaceContext";

export type PaletteMode = "files" | "commands";

type Command = {
  id: string;
  label: string;
  run: () => void;
};

export default function CommandPalette({
  mode,
  onClose,
}: {
  mode: PaletteMode;
  onClose: () => void;
}) {
  const {
    files,
    openFile,
    build,
    run,
    save,
    stop,
    openNewShell,
    resetLayout,
    showWidget,
    startExplorerCreate,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fileItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return persistableFiles(files)
      .filter((file) => !file.path.endsWith("/.keep"))
      .filter((file) => (needle ? file.path.toLowerCase().includes(needle) : true))
      .slice(0, 40)
      .map((file) => ({ id: file.path, label: file.path }));
  }, [files, query]);

  const commands = useMemo<Command[]>(
    () => [
      { id: "build", label: "Build", run: () => void build() },
      { id: "run", label: "Run", run: () => void run() },
      { id: "save", label: "Save", run: () => void save() },
      { id: "stop", label: "Stop", run: stop },
      { id: "terminal", label: "New terminal", run: openNewShell },
      { id: "files", label: "Show files", run: () => showWidget("files") },
      { id: "output", label: "Show output", run: () => showWidget("output") },
      { id: "search", label: "Search in files", run: () => showWidget("search") },
      { id: "ir", label: "Show LLVM IR", run: () => showWidget("ir-asm") },
      { id: "settings", label: "Open settings", run: () => showWidget("settings") },
      { id: "layout", label: "Reset layout", run: resetLayout },
      { id: "new-file", label: "New file", run: () => startExplorerCreate("file") },
      { id: "new-folder", label: "New folder", run: () => startExplorerCreate("folder") },
    ],
    [build, openNewShell, resetLayout, run, save, showWidget, startExplorerCreate, stop],
  );

  const commandItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return commands.filter((command) =>
      needle ? command.label.toLowerCase().includes(needle) : true,
    );
  }, [commands, query]);

  const items = mode === "files" ? fileItems : commandItems;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query, mode]);

  function commit(index: number): void {
    const item = items[index];
    if (!item) {
      return;
    }
    if (mode === "files") {
      openFile(item.id);
    } else {
      const command = commands.find((entry) => entry.id === item.id);
      command?.run();
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-300 flex items-start justify-center bg-black/50 px-4 pt-[18vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "files" ? "Open file" : "Run command"}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input, button"));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        <input
          ref={inputRef}
          aria-label={mode === "files" ? "Search files" : "Search commands"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) => Math.min(items.length - 1, current + 1));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(0, current - 1));
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              commit(active);
            }
          }}
          placeholder={mode === "files" ? "Open file…" : "Run command…"}
          className="w-full border-0 border-b border-white/8 bg-transparent px-4 py-3 text-[13px] text-foreground outline-none"
        />
        <ul className="m-0 max-h-80 list-none overflow-auto p-1">
          {items.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-muted">No matches</li>
          ) : (
            items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex min-h-9 w-full rounded-md px-3 py-2 text-left text-[13px] ${
                    index === active ? "bg-white/10 text-foreground" : "text-muted hover:bg-white/6"
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(index)}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
