"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import {
  DockviewReact,
  themeAbyss,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import type { ProjectKind } from "@/app/lib/projects";
import { persistableFiles } from "@/app/lib/sereInit";
import { applyDefaultLayout } from "@/app/lib/workbenchLayout";
import CommandPalette, { type PaletteMode } from "./CommandPalette";
import EditorPanel from "./EditorPanel";
import FilesPanel from "./FilesPanel";
import IrAsmPanel from "./IrAsmPanel";
import OutputPanel from "./OutputPanel";
import SearchPanel from "./SearchPanel";
import SettingsPanel from "./SettingsPanel";
import TerminalPanel from "./TerminalPanel";
import WorkbenchToolbar from "./WorkbenchToolbar";
import ProjectLoadingScreen from "./ProjectLoadingScreen";
import { useWorkspace, WorkspaceProvider } from "./WorkspaceContext";

config.autoAddCss = false;

const components = {
  files: () => <FilesPanel />,
  editor: (props: IDockviewPanelProps<{ path: string }>) => (
    <EditorPanel {...props} />
  ),
  output: () => <OutputPanel />,
  terminal: (props: IDockviewPanelProps<{ sessionId?: string }>) => (
    <TerminalPanel {...props} />
  ),
  irAsm: () => <IrAsmPanel />,
  settings: () => <SettingsPanel />,
  search: () => <SearchPanel />,
};

function WorkbenchDock({
  kind,
  onLayoutReady,
}: {
  kind: ProjectKind;
  onLayoutReady: () => void;
}) {
  const { setDockApi, importFiles, save, build, run, openNewShell, startExplorerCreate, showWidget } =
    useWorkspace();
  const importRef = useRef<HTMLInputElement | null>(null);
  const [palette, setPalette] = useState<PaletteMode | null>(null);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      setDockApi(event.api);
      applyDefaultLayout(event.api, kind);
      onLayoutReady();
    },
    [kind, onLayoutReady, setDockApi],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        save();
        return;
      }
      if (key === "b") {
        event.preventDefault();
        void build();
        return;
      }
      if (key === "enter") {
        event.preventDefault();
        void run();
        return;
      }
      if (event.key === "`" && event.shiftKey) {
        event.preventDefault();
        openNewShell();
        return;
      }
      if (key === ",") {
        event.preventDefault();
        showWidget("settings");
        return;
      }
      if (key === "p") {
        event.preventDefault();
        setPalette(event.shiftKey ? "commands" : "files");
        return;
      }
      if (key === "f" && event.shiftKey) {
        event.preventDefault();
        showWidget("search");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [build, openNewShell, run, save, showWidget]);

  async function handleImport(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const imported = await Promise.all(
      Array.from(fileList).map(async (file) => ({
        path: file.name,
        content: await file.text(),
      })),
    );
    importFiles(imported);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <WorkbenchToolbar
        onAddFile={() => startExplorerCreate("file")}
        onAddFolder={() => startExplorerCreate("folder")}
        onImport={() => importRef.current?.click()}
      />
      <input
        ref={importRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          void handleImport(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="workbench-dock min-h-0 flex-1">
        <DockviewReact theme={themeAbyss} components={components} onReady={onReady} />
      </div>
      <StatusBar />
      {palette ? <CommandPalette mode={palette} onClose={() => setPalette(null)} /> : null}
    </div>
  );
}

function StatusBar() {
  const { status, busy, files, kind, dirty, cwdDisplay, sereVersion, compilerBackend, lspStatus } =
    useWorkspace();
  const [mod, setMod] = useState("Ctrl");
  const fileCount = persistableFiles(files).filter(
    (file) => !file.path.endsWith("/.keep") && file.path !== ".keep",
  ).length;
  const vmLabel =
    compilerBackend === "nano" ? "VM ready" : compilerBackend === "host" ? "Host compiler" : "VM";
  const lspLabel = lspStatus === "ready" ? "LSP" : lspStatus === "error" ? "LSP off" : "LSP…";

  useEffect(() => {
    if (/Mac/i.test(navigator.platform) || /Mac/i.test(navigator.userAgent)) {
      setMod("⌘");
    }
  }, []);

  return (
    <div className="relative z-50 flex h-8 shrink-0 items-center justify-between gap-4 border-t border-white/6 bg-[#0c0e10]/80 px-4 text-[11px] text-muted backdrop-blur-xl">
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`size-1.5 shrink-0 rounded-full ${busy ? "bg-warning" : dirty ? "bg-warning" : "bg-success"}`}
        />
        <span className="truncate">{status}</span>
        <span className="hidden text-border sm:inline">·</span>
        <span className="hidden sm:inline">{vmLabel}</span>
        {sereVersion ? (
          <>
            <span className="hidden text-border sm:inline">·</span>
            <span className="hidden max-w-40 truncate sm:inline" title={sereVersion}>
              {sereVersion}
            </span>
          </>
        ) : null}
        <span className="hidden text-border sm:inline">·</span>
        <span className="hidden max-w-48 truncate font-mono sm:inline" title={cwdDisplay}>
          {cwdDisplay}
        </span>
        <span className="hidden text-border sm:inline">·</span>
        <span className="hidden sm:inline">{lspLabel}</span>
        <span className="hidden text-border lg:inline">·</span>
        <span className="hidden lg:inline">{kind === "lib" ? "Library" : "App"}</span>
        <span className="hidden text-border lg:inline">·</span>
        <span className="hidden lg:inline">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
      </span>
      <span className="hidden items-center gap-2 sm:flex">
        <span>
          <kbd className="kbd">{mod}</kbd>
          <kbd className="kbd">P</kbd>
        </span>
        <span>
          <kbd className="kbd">{mod}</kbd>
          <kbd className="kbd">S</kbd>
          <span className="ml-1">Save</span>
        </span>
        <span>
          <kbd className="kbd">{mod}</kbd>
          <kbd className="kbd">B</kbd>
          <span className="ml-1">Build</span>
        </span>
        <span>
          <kbd className="kbd">{mod}</kbd>
          <kbd className="kbd">↵</kbd>
          <span className="ml-1">Run</span>
        </span>
      </span>
    </div>
  );
}

interface WorkbenchProps {
  projectId: string;
  kind: ProjectKind;
  projectName: string;
}

function WorkbenchChrome({
  kind,
  projectName,
}: {
  kind: ProjectKind;
  projectName: string;
}) {
  const { hydrated, bootProgress } = useWorkspace();
  const [layoutReady, setLayoutReady] = useState(false);
  const markLayoutReady = useCallback(() => {
    setLayoutReady(true);
  }, []);
  const open = hydrated && layoutReady;
  const percent = hydrated ? Math.max(bootProgress.percent, 94) : bootProgress.percent;
  const label = hydrated ? "Setting up editor…" : bootProgress.label;

  useEffect(() => {
    if (!hydrated) {
      setLayoutReady(false);
    }
  }, [hydrated]);

  useEffect(() => {
    if (open) {
      window.dispatchEvent(new Event("resize"));
    }
  }, [open]);

  return (
    <div className="relative h-full min-h-0 workbench-shell">
      {hydrated ? (
        <div
          className={open ? "h-full min-h-0" : "pointer-events-none invisible absolute inset-0"}
          aria-hidden={!open}
        >
          <WorkbenchDock kind={kind} onLayoutReady={markLayoutReady} />
        </div>
      ) : null}
      {open ? null : (
        <ProjectLoadingScreen projectName={projectName} percent={percent} label={label} />
      )}
    </div>
  );
}

export default function Workbench({ projectId, kind, projectName }: WorkbenchProps) {
  return (
    <WorkspaceProvider projectId={projectId} kind={kind} projectName={projectName}>
      <WorkbenchChrome kind={kind} projectName={projectName} />
    </WorkspaceProvider>
  );
}
