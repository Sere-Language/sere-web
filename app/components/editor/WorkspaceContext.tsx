"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { editor } from "monaco-editor";
import type { DockviewApi } from "dockview-react";
import type { ProjectKind } from "@/app/lib/projects";
import { listProjectFiles, saveProjectFiles } from "@/app/lib/projectFiles";
import {
  bootCompilerHost,
  combineStreams,
  emitHostArtifact,
  execHostCommand,
} from "@/app/lib/compilerHost";
import { NanoWorkspace } from "@/app/lib/nanoWorkspace";
import { GUEST_ROOT, toGuestPath } from "@/app/lib/nanoPaths";
import { diagnoseGuestSereFailure } from "@/app/lib/sereLinuxInstall";
import {
  buildInitProjectFiles,
  mergeHostSnapshot,
  persistableFiles,
  savableFiles,
  shouldPersistPath,
} from "@/app/lib/sereInit";
import { SereLspClient } from "@/app/lib/sereLspClient";
import { scheduleSereAnalyze, setSereLsp } from "@/app/lib/sereMonacoLsp";
import {
  loadWorkbenchSettings,
  saveWorkbenchSettings,
  type WorkbenchSettings,
} from "@/app/lib/workbenchSettings";
import {
  applyDefaultLayout,
  DEFAULT_SHELL_ID,
  ensurePanel,
  focusBuildSurfaces,
  FILES_PANEL_ID,
  IR_ASM_PANEL_ID,
  OUTPUT_PANEL_ID,
  SETTINGS_PANEL_ID,
  SEARCH_PANEL_ID,
  shellIdFromPanelId,
  TERMINAL_PANEL_ID,
  terminalPanelId,
} from "@/app/lib/workbenchLayout";
import type { TerminalHandle } from "./XTermView";
import {
  defaultOpenPath,
  editorPanelId,
  fileTitle,
  isKeepFile,
  isPathInside,
  joinDest,
  joinWorkspacePath,
  parentDir,
  pathBasename,
  rewritePrefix,
  seedWorkspaceFiles,
  topLevelPaths,
  uniqueWorkspacePath,
  workspaceFilesEqual,
  type WorkspaceFile,
} from "@/app/lib/workspace";

export type TerminalSession = {
  id: string;
  title: string;
  cwd: string;
  generation: number;
};

export type WidgetId = "files" | "output" | "terminal" | "ir-asm" | "settings" | "search";
export type CompilerBackend = "nano" | "host" | null;
export type LspStatus = "off" | "ready" | "error";
export type WorkbenchStatus =
  | "Opening"
  | "Ready"
  | "Unsaved"
  | "Saving"
  | "Saved"
  | "Building"
  | "Running"
  | "Build failed"
  | "Save failed";

export type BootProgress = {
  percent: number;
  label: string;
};

export type ExplorerCreateIntent = {
  id: number;
  kind: "file" | "folder";
  directory?: string;
};

interface WorkspaceContextValue {
  kind: ProjectKind;
  projectName: string;
  files: WorkspaceFile[];
  status: WorkbenchStatus;
  hydrated: boolean;
  bootProgress: BootProgress;
  busy: boolean;
  dirty: boolean;
  updateFile: (path: string, content: string) => void;
  getFile: (path: string) => WorkspaceFile | undefined;
  openFile: (path: string) => void;
  addFile: (directory: string, name: string, content?: string) => void;
  addFolder: (directory: string, name: string) => void;
  deleteFile: (path: string) => void;
  deleteEntries: (paths: string[]) => void;
  renameEntry: (path: string, nextName: string) => void;
  moveEntries: (paths: string[], destDir: string) => void;
  copyEntries: (paths: string[], destDir: string) => void;
  importFiles: (imported: WorkspaceFile[]) => void;
  startExplorerCreate: (kind: "file" | "folder", directory?: string) => void;
  explorerCreateIntent: ExplorerCreateIntent | null;
  clearExplorerCreateIntent: () => void;
  closeActiveEditor: () => void;
  resetLayout: () => void;
  showWidget: (id: WidgetId) => void;
  setDockApi: (api: DockviewApi) => void;
  registerEditor: (path: string, instance: editor.IStandaloneCodeEditor) => void;
  unregisterEditor: (path: string) => void;
  undo: () => void;
  redo: () => void;
  find: () => void;
  format: () => void;
  save: () => Promise<void>;
  build: () => Promise<void>;
  run: () => Promise<void>;
  stop: () => void;
  writeTerminal: (text: string) => void;
  registerTerminal: (shellId: string, handle: TerminalHandle | null) => void;
  runTerminalCommand: (
    line: string,
    shellId?: string,
  ) => Promise<{ output: string; cwdDisplay: string }>;
  openNewShell: () => void;
  reloadShell: (shellId?: string) => void;
  refreshFromGuest: () => void;
  terminalSessions: TerminalSession[];
  cwdDisplay: string;
  sereVersion: string;
  compilerBackend: CompilerBackend;
  lspStatus: LspStatus;
  outputText: string;
  llvmIr: string;
  assembly: string;
  emitIrOnRun: boolean;
  setEmitIrOnRun: (value: boolean) => void;
  settings: WorkbenchSettings;
  updateSettings: (patch: Partial<WorkbenchSettings>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function isSereCli(line: string): boolean {
  return /^(?:\.\/(?:bin\/)?)?sere(?:\s|$)/.test(line.trim());
}

function isActivateLine(line: string): boolean {
  return /^(\.|source)\s+(\.\/)?scripts\/activate\b/.test(line.trim());
}

interface WorkspaceProviderProps {
  projectId: string;
  kind: ProjectKind;
  projectName: string;
  children: ReactNode;
}

export function WorkspaceProvider({
  projectId,
  kind,
  projectName,
  children,
}: WorkspaceProviderProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>(() =>
    seedWorkspaceFiles(kind, projectName),
  );
  const [outputText, setOutputText] = useState("Sere Cloud\n");
  const [llvmIr, setLlvmIr] = useState(
    `; LLVM IR\n; Build or run to fill this view.\n`,
  );
  const [assembly, setAssembly] = useState("; ASM\n; Build or run to fill this view.\n");
  const [dockApi, setDockApiState] = useState<DockviewApi | null>(null);
  const [status, setStatus] = useState<WorkbenchStatus>("Opening");
  const [hydrated, setHydrated] = useState(false);
  const [bootProgress, setBootProgress] = useState<BootProgress>({
    percent: 8,
    label: "Opening project…",
  });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cwdDisplay, setCwdDisplay] = useState(GUEST_ROOT);
  const [sereVersion, setSereVersion] = useState("");
  const [compilerBackend, setCompilerBackend] = useState<CompilerBackend>(null);
  const [lspStatus, setLspStatus] = useState<LspStatus>("off");
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([
    { id: DEFAULT_SHELL_ID, title: "Terminal", cwd: GUEST_ROOT, generation: 0 },
  ]);
  const [explorerCreateIntent, setExplorerCreateIntent] =
    useState<ExplorerCreateIntent | null>(null);
  const editorsRef = useRef(new Map<string, editor.IStandaloneCodeEditor>());
  const cancelledRef = useRef(false);
  const hydratedRef = useRef(false);
  const filesRef = useRef(files);
  filesRef.current = files;
  const nanoRef = useRef<NanoWorkspace | null>(null);
  const pullGuestFilesRef = useRef<() => void>(() => undefined);
  const fsSyncTimerRef = useRef<number | null>(null);
  const sereBackendRef = useRef<"nano" | "host" | null>(null);
  const terminalHandlesRef = useRef(new Map<string, TerminalHandle>());
  const terminalQueueRef = useRef<string[]>([]);
  const sessionsRef = useRef(terminalSessions);
  sessionsRef.current = terminalSessions;
  const dockApiRef = useRef(dockApi);
  dockApiRef.current = dockApi;
  const runLockRef = useRef(Promise.resolve());
  const shellCountRef = useRef(1);
  const hostSnapshotRef = useRef<WorkspaceFile[] | null>(null);
  const [settings, setSettings] = useState<WorkbenchSettings>(() => loadWorkbenchSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const setDockApi = useCallback((api: DockviewApi) => {
    setDockApiState(api);
  }, []);

  const getFile = useCallback(
    (path: string) => files.find((file) => file.path === path),
    [files],
  );

  const updateFile = useCallback((path: string, content: string) => {
    setFiles((current) =>
      current.map((file) => (file.path === path ? { ...file, content } : file)),
    );
    nanoRef.current?.writeFile(path, content);
    scheduleSereAnalyze(path, content);
    const panel = dockApiRef.current?.getPanel(editorPanelId(path));
    panel?.api.setTitle(`• ${fileTitle(path)}`);
    if (hydratedRef.current) {
      setDirty(true);
      setStatus("Unsaved");
    }
  }, []);

  const openFile = useCallback(
    (path: string) => {
      if (!dockApi) {
        return;
      }

      const id = editorPanelId(path);
      const existing = dockApi.getPanel(id);
      if (existing) {
        existing.api.setActive();
        return;
      }

      const reference =
        dockApi.panels.find((panel) => panel.id.startsWith("editor:")) ??
        dockApi.getPanel(FILES_PANEL_ID);

      dockApi.addPanel({
        id,
        component: "editor",
        title: fileTitle(path),
        params: { path },
        position: reference
          ? { referencePanel: reference.id, direction: "within" }
          : undefined,
      });
    },
    [dockApi],
  );
  const openFileRef = useRef(openFile);
  openFileRef.current = openFile;

  const markDirty = useCallback(() => {
    if (hydratedRef.current) {
      setDirty(true);
      setStatus("Unsaved");
    }
  }, []);

  const closeRemovedEditors = useCallback((previous: WorkspaceFile[], next: WorkspaceFile[]) => {
    const api = dockApiRef.current;
    if (!api) {
      return;
    }
    const upcoming = new Set(next.map((file) => file.path));
    for (const file of previous) {
      if (upcoming.has(file.path)) {
        continue;
      }
      const panel = api.getPanel(editorPanelId(file.path));
      if (panel) {
        api.removePanel(panel);
      }
    }
  }, []);

  const pullGuestFiles = useCallback(
    (markUnsaved = true) => {
      const vm = nanoRef.current;
      if (!vm) {
        return;
      }
      const listed = vm.listProjectFiles();
      const merged = hostSnapshotRef.current
        ? mergeHostSnapshot(listed, hostSnapshotRef.current)
        : listed;
      const previous = filesRef.current;
      if (workspaceFilesEqual(previous, merged)) {
        return;
      }
      closeRemovedEditors(previous, merged);
      filesRef.current = merged;
      setFiles(merged);
      if (markUnsaved) {
        markDirty();
      }
    },
    [closeRemovedEditors, markDirty],
  );
  pullGuestFilesRef.current = pullGuestFiles;

  const commitFiles = useCallback(
    (next: WorkspaceFile[], reopen: string[] = []) => {
      const vm = nanoRef.current;
      const previous = filesRef.current;
      const previousPaths = new Set(previous.map((file) => file.path));
      const upcoming = new Set(next.map((file) => file.path));

      const finish = (): void => {
        for (const path of reopen) {
          window.setTimeout(() => openFile(path), 0);
        }
      };

      if (!vm) {
        closeRemovedEditors(previous, next);
        filesRef.current = next;
        setFiles(next);
        markDirty();
        finish();
        return;
      }

      void (async () => {
        const staleDirs = new Set<string>();
        for (const path of previousPaths) {
          if (upcoming.has(path)) {
            continue;
          }
          await vm.removeFile(path);
          let directory = parentDir(path);
          while (directory) {
            staleDirs.add(directory);
            directory = parentDir(directory);
          }
        }
        for (const directory of [...staleDirs].sort((left, right) => right.length - left.length)) {
          const stillUsed = [...upcoming].some(
            (path) => path === directory || path.startsWith(`${directory}/`),
          );
          if (!stillUsed) {
            await vm.removeFile(directory);
          }
        }
        for (const file of next) {
          vm.writeFile(file.path, file.content);
        }
        pullGuestFiles();
        finish();
      })();
    },
    [closeRemovedEditors, markDirty, openFile, pullGuestFiles],
  );

  const addFile = useCallback(
    (directory: string, name: string, content = "") => {
      const path = joinWorkspacePath(directory, name);
      if (filesRef.current.some((file) => file.path === path)) {
        throw new Error("A file already exists at that path.");
      }
      const vm = nanoRef.current;
      if (vm) {
        vm.writeFile(path, content);
        pullGuestFiles();
      } else {
        const next = [...filesRef.current, { path, content }];
        filesRef.current = next;
        setFiles(next);
      }
      if (!isKeepFile(path)) {
        window.setTimeout(() => openFile(path), 0);
      }
      markDirty();
    },
    [markDirty, openFile, pullGuestFiles],
  );

  const addFolder = useCallback(
    (directory: string, name: string) => {
      const folder = joinWorkspacePath(directory, name);
      const keep = `${folder}/.keep`;
      if (
        filesRef.current.some(
          (file) => file.path === keep || file.path === folder || file.path.startsWith(`${folder}/`),
        )
      ) {
        throw new Error("A folder already exists at that path.");
      }
      commitFiles([...filesRef.current, { path: keep, content: "" }]);
    },
    [commitFiles],
  );

  const deleteEntries = useCallback(
    (paths: string[]) => {
      const roots = topLevelPaths(paths);
      commitFiles(
        filesRef.current.filter(
          (file) => !roots.some((root) => file.path === root || isPathInside(root, file.path)),
        ),
      );
    },
    [commitFiles],
  );

  const deleteFile = useCallback(
    (path: string) => {
      deleteEntries([path]);
    },
    [deleteEntries],
  );

  const renameEntry = useCallback(
    (from: string, nextName: string) => {
      const cleaned = nextName.trim().replaceAll("\\", "/");
      if (!cleaned || cleaned.includes("/") || cleaned.includes("..")) {
        throw new Error("Enter a valid name.");
      }
      const dest = joinDest(parentDir(from), cleaned);
      if (dest === from) {
        return;
      }
      const taken = new Set(
        filesRef.current
          .filter((file) => file.path !== from && !file.path.startsWith(`${from}/`))
          .map((file) => file.path),
      );
      if (uniqueWorkspacePath(taken, dest) !== dest) {
        throw new Error("Something already exists at that name.");
      }
      const reopen: string[] = [];
      const next = filesRef.current.map((file) => {
        if (file.path !== from && !file.path.startsWith(`${from}/`)) {
          return file;
        }
        const updatedPath = rewritePrefix(file.path, from, dest);
        if (dockApi?.getPanel(editorPanelId(file.path))) {
          reopen.push(updatedPath);
        }
        return { ...file, path: updatedPath };
      });
      commitFiles(next, reopen);
    },
    [commitFiles, dockApi],
  );

  const relocateEntries = useCallback(
    (paths: string[], destDir: string, copy: boolean) => {
      const roots = topLevelPaths(paths);
      for (const root of roots) {
        if (root !== "" && (destDir === root || destDir.startsWith(`${root}/`))) {
          throw new Error("Cannot move a folder into itself.");
        }
      }

      const current = filesRef.current;
      const mapping = new Map<string, string>();
      const taken = new Set(
        copy
          ? current.map((file) => file.path)
          : current
              .filter((file) => !roots.some((root) => file.path === root || isPathInside(root, file.path)))
              .map((file) => file.path),
      );

      for (const root of roots) {
        const desired = joinDest(destDir, pathBasename(root));
        if (!copy && desired === root) {
          continue;
        }
        const destRoot = uniqueWorkspacePath(taken, desired);
        for (const file of current) {
          if (file.path !== root && !file.path.startsWith(`${root}/`)) {
            continue;
          }
          const updatedPath = rewritePrefix(file.path, root, destRoot);
          mapping.set(file.path, updatedPath);
          taken.add(updatedPath);
        }
      }

      if (mapping.size === 0) {
        return;
      }

      const reopen: string[] = [];
      if (copy) {
        const extras: WorkspaceFile[] = [];
        for (const file of current) {
          const destPath = mapping.get(file.path);
          if (!destPath) {
            continue;
          }
          extras.push({ path: destPath, content: file.content });
        }
        commitFiles([...current, ...extras]);
        return;
      }

      const next = current.map((file) => {
        const destPath = mapping.get(file.path);
        if (!destPath) {
          return file;
        }
        if (dockApi?.getPanel(editorPanelId(file.path))) {
          reopen.push(destPath);
        }
        return { ...file, path: destPath };
      });
      commitFiles(next, reopen);
    },
    [commitFiles, dockApi],
  );

  const moveEntries = useCallback(
    (paths: string[], destDir: string) => {
      relocateEntries(paths, destDir, false);
    },
    [relocateEntries],
  );

  const copyEntries = useCallback(
    (paths: string[], destDir: string) => {
      relocateEntries(paths, destDir, true);
    },
    [relocateEntries],
  );

  const importFiles = useCallback(
    (imported: WorkspaceFile[]) => {
      const vm = nanoRef.current;
      if (vm) {
        for (const file of imported) {
          if (!shouldPersistPath(file.path)) {
            continue;
          }
          vm.writeFile(file.path, file.content);
        }
        pullGuestFiles();
      } else {
        setFiles((current) => {
          const next = [...current];
          for (const file of imported) {
            if (!shouldPersistPath(file.path)) {
              continue;
            }
            const index = next.findIndex((entry) => entry.path === file.path);
            if (index === -1) {
              next.push(file);
            } else {
              next[index] = file;
            }
          }
          filesRef.current = next;
          return next;
        });
      }
      const first = imported[0];
      if (first) {
        window.setTimeout(() => openFile(first.path), 0);
      }
      markDirty();
    },
    [markDirty, openFile, pullGuestFiles],
  );

  const closeActiveEditor = useCallback(() => {
    const active = dockApi?.activePanel;
    if (active?.id.startsWith("editor:")) {
      dockApi?.removePanel(active);
    }
  }, [dockApi]);

  const resetLayout = useCallback(() => {
    if (!dockApi) {
      return;
    }
    applyDefaultLayout(dockApi, kind);
  }, [dockApi, kind]);

  const showWidget = useCallback(
    (id: WidgetId) => {
      if (!dockApi) {
        return;
      }

      if (id === "files") {
        ensurePanel(dockApi, FILES_PANEL_ID, {
          component: "files",
          title: "Files",
          referenceId: editorPanelId(defaultOpenPath(kind)),
          direction: "left",
        });
        return;
      }

      if (id === "output") {
        ensurePanel(dockApi, OUTPUT_PANEL_ID, {
          component: "output",
          title: "Output",
          referenceId: editorPanelId(defaultOpenPath(kind)),
          direction: "right",
        });
        return;
      }

      if (id === "terminal") {
        ensurePanel(dockApi, TERMINAL_PANEL_ID, {
          component: "terminal",
          title: "Terminal",
          referenceId: editorPanelId(defaultOpenPath(kind)),
          direction: "below",
          params: { sessionId: DEFAULT_SHELL_ID },
        });
        return;
      }

      if (id === "settings") {
        ensurePanel(dockApi, SETTINGS_PANEL_ID, {
          component: "settings",
          title: "Settings",
          referenceId: editorPanelId(defaultOpenPath(kind)),
          direction: "within",
        });
        return;
      }

      if (id === "search") {
        ensurePanel(dockApi, SEARCH_PANEL_ID, {
          component: "search",
          title: "Search",
          referenceId: FILES_PANEL_ID,
          direction: "below",
        });
        return;
      }

      ensurePanel(dockApi, IR_ASM_PANEL_ID, {
        component: "irAsm",
        title: "LLVM IR",
        referenceId: OUTPUT_PANEL_ID,
        direction: "below",
      });
    },
    [dockApi, kind],
  );

  const startExplorerCreate = useCallback(
    (kind: "file" | "folder", directory?: string) => {
      showWidget("files");
      setExplorerCreateIntent({ kind, directory, id: Date.now() });
    },
    [showWidget],
  );

  const clearExplorerCreateIntent = useCallback(() => {
    setExplorerCreateIntent(null);
  }, []);

  const registerEditor = useCallback((path: string, instance: editor.IStandaloneCodeEditor) => {
    editorsRef.current.set(path, instance);
  }, []);

  const unregisterEditor = useCallback((path: string) => {
    editorsRef.current.delete(path);
  }, []);

  const activeEditor = useCallback((): editor.IStandaloneCodeEditor | undefined => {
    const id = dockApi?.activePanel?.id;
    if (id?.startsWith("editor:")) {
      const fromActive = editorsRef.current.get(id.slice("editor:".length));
      if (fromActive) {
        return fromActive;
      }
    }
    return editorsRef.current.values().next().value;
  }, [dockApi]);

  const triggerEditor = useCallback(
    (handlerId: string, payload?: unknown) => {
      activeEditor()?.trigger("keyboard", handlerId, payload ?? null);
    },
    [activeEditor],
  );

  const undo = useCallback(() => triggerEditor("undo"), [triggerEditor]);
  const redo = useCallback(() => triggerEditor("redo"), [triggerEditor]);
  const find = useCallback(() => {
    void activeEditor()?.getAction("actions.find")?.run();
  }, [activeEditor]);
  const format = useCallback(() => {
    void activeEditor()?.getAction("editor.action.formatDocument")?.run();
  }, [activeEditor]);
  const appendOutput = useCallback((chunk: string) => {
    setOutputText((current) => `${current}${chunk}`);
  }, []);

  const persist = useCallback(async () => {
    setStatus("Saving");
    const snapshot = filesRef.current;
    await saveProjectFiles(projectId, savableFiles(snapshot));
    setDirty(false);
    setStatus("Saved");
    const api = dockApiRef.current;
    if (api) {
      for (const panel of api.panels) {
        if (!panel.id.startsWith("editor:")) {
          continue;
        }
        const path = panel.id.slice("editor:".length);
        panel.api.setTitle(fileTitle(path));
      }
    }
  }, [projectId]);

  const save = useCallback(async () => {
    try {
      await persist();
    } catch (caught) {
      setStatus("Save failed");
      appendOutput(
        `\nSave failed: ${caught instanceof Error ? caught.message : "unknown error"}\n`,
      );
    }
  }, [appendOutput, persist]);

  useEffect(() => {
    let cancelled = false;

    function log(text: string): void {
      if (!cancelled) {
        appendOutput(text);
      }
    }

    async function boot(): Promise<void> {
      hydratedRef.current = false;
      setHydrated(false);
      setStatus("Opening");
      setOutputText("Sere Cloud\n");
      setBootProgress({ percent: 12, label: "Opening project…" });
      setBootProgress({ percent: 24, label: "Loading project files…" });
      log("Loading project files…\n");

      let sereVersion = "dev";
      try {
        const response = await fetch("/api/sere/latest");
        if (response.ok) {
          const payload = (await response.json()) as { tag?: string; linuxTag?: string };
          sereVersion = payload.linuxTag ?? payload.tag ?? "dev";
        }
      } catch {
        // Seed with "dev" if GitHub is unreachable.
      }

      let loaded = ensureLibsFolder(buildInitProjectFiles(kind, projectName, sereVersion));

      try {
        const stored = await listProjectFiles(projectId);
        if (cancelled) {
          return;
        }

        if (stored.length === 0) {
          setBootProgress({ percent: 78, label: "Creating project files…" });
          loaded = ensureLibsFolder(
            buildInitProjectFiles(kind, projectName, sereVersion),
          );
          setFiles(loaded);
          await saveProjectFiles(projectId, loaded);
          log(`Wrote ${loaded.length} files for a new project.\n`);
        } else {
          setBootProgress({ percent: 78, label: "Restoring project files…" });
          loaded = ensureLibsFolder(stored);
          setFiles(loaded);
          if (loaded.length !== stored.length) {
            await saveProjectFiles(projectId, loaded);
          }
          log(`Restored ${loaded.length} saved files (venv excluded).\n`);
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }
        const message = caught instanceof Error ? caught.message : "Could not load files.";
        log(`${message}\n`);
        loaded = ensureLibsFolder(buildInitProjectFiles(kind, projectName, sereVersion));
        setFiles(loaded);
      }

      if (cancelled) {
        return;
      }

      filesRef.current = loaded;
      sereBackendRef.current = null;
      setBootProgress({ percent: 82, label: "Booting NanoVM…" });
      log("Booting NanoVM…\n");
      try {
        nanoRef.current?.destroy();
        const vm = await NanoWorkspace.boot();
        if (cancelled) {
          vm.destroy();
          return;
        }
        nanoRef.current = vm;
        vm.watchProjectFiles(() => {
          if (fsSyncTimerRef.current !== null) {
            window.clearTimeout(fsSyncTimerRef.current);
          }
          fsSyncTimerRef.current = window.setTimeout(() => {
            pullGuestFilesRef.current();
          }, 80);
        });
        await vm.syncAll(loaded);
        const guestFiles = vm.listProjectFiles();
        filesRef.current = guestFiles;
        setFiles(guestFiles);
        setCwdDisplay(vm.cwd);
        setTerminalSessions([
          { id: DEFAULT_SHELL_ID, title: "Terminal", cwd: vm.cwd, generation: 0 },
        ]);
        shellCountRef.current = 1;
        log(`Guest filesystem ready at ${GUEST_ROOT} (${guestFiles.length} files).\n`);
        setBootProgress({ percent: 86, label: "Starting Windows compiler host…" });
        log("Starting the Windows compiler host…\n");
        try {
          const host = await bootCompilerHost();
          sereBackendRef.current = "host";
          setCompilerBackend("host");
          setSereVersion(host.env.version);
          log(`${host.message}\n`);
        } catch (hostCaught) {
          log(
            `Compiler host: ${hostCaught instanceof Error ? hostCaught.message : "failed"}\n`,
          );
        }
        try {
          const installed = await vm.installSere();
          log(`${installed.message}\n`);
          if (installed.hasCompiler && sereBackendRef.current !== "host") {
            sereBackendRef.current = "nano";
            setCompilerBackend("nano");
            const version = await vm.run("sere --version");
            const diagnostic = diagnoseGuestSereFailure(version.output, version.exitCode);
            if (diagnostic) {
              log(`${diagnostic}\n`);
            } else {
              const line = version.output.trim().split("\n")[0] ?? installed.tag;
              setSereVersion(line || installed.tag);
              if (version.output.trim()) {
                log(version.output.endsWith("\n") ? version.output : `${version.output}\n`);
              }
            }
          }
        } catch (installCaught) {
          log(
            `Linux zip: ${installCaught instanceof Error ? installCaught.message : "failed"}\n`,
          );
        }
      } catch (caught) {
        log(
          `NanoVM: ${caught instanceof Error ? caught.message : "could not boot the VM"}\n`,
        );
      }

      if (!cancelled) {
        setBootProgress({ percent: 90, label: "Setting up editor…" });
        hydratedRef.current = true;
        setDirty(false);
        setStatus("Ready");
        setHydrated(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      if (fsSyncTimerRef.current !== null) {
        window.clearTimeout(fsSyncTimerRef.current);
      }
      nanoRef.current?.watchProjectFiles(null);
      nanoRef.current?.destroy();
      nanoRef.current = null;
    };
  }, [appendOutput, kind, projectId, projectName]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    let cancelled = false;
    const session = new SereLspClient(projectId);
    session.onOpenPath = (path, range) => {
      openFileRef.current(path);
      window.setTimeout(() => {
        const instance = editorsRef.current.get(path);
        if (!instance || !range) {
          return;
        }
        const position = {
          lineNumber: range.start.line + 1,
          column: range.start.character + 1,
        };
        instance.setPosition(position);
        instance.revealPositionInCenter(position);
        instance.focus();
      }, 60);
    };
    setSereLsp(session);
    setLspStatus("off");
    void session
      .start(persistableFiles(filesRef.current))
      .then(() => {
        if (cancelled) {
          return;
        }
        setLspStatus("ready");
        const version = session.info?.version ?? "";
        appendOutput(
          version
            ? `Host language server ${version} (${session.info?.compiler}). Guest sere --lsp is unused unless linux.zip ships a RISC-V compiler.\n`
            : "Sere language server ready.\n",
        );
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setLspStatus("error");
        const message = caught instanceof Error ? caught.message : "failed";
        appendOutput(`Language server: ${message}\n`);
        setSereLsp(null);
      });
    return () => {
      cancelled = true;
      setSereLsp(null);
      void session.stop();
    };
  }, [appendOutput, hydrated, projectId]);

  useEffect(() => {
    if (!hydratedRef.current || !dirty) {
      return;
    }

    const timer = window.setTimeout(() => {
      void save();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [dirty, files, save]);

  const registerTerminal = useCallback((shellId: string, handle: TerminalHandle | null) => {
    if (!handle) {
      terminalHandlesRef.current.delete(shellId);
      return;
    }
    terminalHandlesRef.current.set(shellId, handle);
    if (shellId !== DEFAULT_SHELL_ID) {
      return;
    }
    for (const queued of terminalQueueRef.current) {
      handle.write(queued);
    }
    terminalQueueRef.current = [];
  }, []);

  const writeTerminal = useCallback((text: string) => {
    const handle = terminalHandlesRef.current.get(DEFAULT_SHELL_ID);
    if (handle) {
      handle.write(text);
      return;
    }
    terminalQueueRef.current.push(text);
  }, []);

  const promptDefaultTerminal = useCallback(() => {
    terminalHandlesRef.current.get(DEFAULT_SHELL_ID)?.prompt();
  }, []);

  const updateSessionCwd = useCallback((shellId: string, cwd: string) => {
    setTerminalSessions((current) =>
      current.map((session) => (session.id === shellId ? { ...session, cwd } : session)),
    );
    if (shellId === DEFAULT_SHELL_ID) {
      setCwdDisplay(cwd);
    }
  }, []);

  const enqueueRun = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    const previous = runLockRef.current;
    let release = (): void => undefined;
    runLockRef.current = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }, []);

  const applyHostSnapshot = useCallback(
    (snapshot: WorkspaceFile[]) => {
      hostSnapshotRef.current = snapshot;
      const next = mergeHostSnapshot(filesRef.current, snapshot);
      const vm = nanoRef.current;
      if (vm) {
        for (const file of next) {
          vm.writeFile(file.path, file.content);
        }
      }
      if (workspaceFilesEqual(filesRef.current, next)) {
        return;
      }
      closeRemovedEditors(filesRef.current, next);
      filesRef.current = next;
      setFiles(next);
    },
    [closeRemovedEditors],
  );

  const runSereCommand = useCallback(
    async (command: string, shellId = DEFAULT_SHELL_ID) => {
      const startHost = async () => {
        const host = await bootCompilerHost();
        sereBackendRef.current = "host";
        setCompilerBackend("host");
        setSereVersion(host.env.version);
      };

      if (sereBackendRef.current !== "host") {
        try {
          await startHost();
        } catch (caught) {
          const vm = nanoRef.current;
          if (vm) {
            return vm.run(command, undefined, shellId);
          }
          throw new Error(
            caught instanceof Error
              ? `Windows compiler host did not start: ${caught.message}`
              : "Windows compiler host did not start.",
          );
        }
      }

      const result = await execHostCommand(
        projectId,
        command,
        persistableFiles(filesRef.current),
      );
      applyHostSnapshot(result.files ?? []);
      return {
        output: combineStreams(result),
        cwd: nanoRef.current?.shellCwd(shellId) ?? GUEST_ROOT,
        exitCode: result.exitCode,
      };
    },
    [applyHostSnapshot, projectId],
  );

  const runTerminalCommand = useCallback(
    async (
      line: string,
      shellId = DEFAULT_SHELL_ID,
    ): Promise<{ output: string; cwdDisplay: string }> => {
      return enqueueRun(async () => {
        const vm = nanoRef.current;
        if (!vm) {
          throw new Error("NanoVM is not ready.");
        }
        if (isActivateLine(line)) {
          return {
            output:
              "PATH already includes /opt/sere/bin. scripts/activate is a no-op in Cloud (venv/ is not used).\n",
            cwdDisplay: vm.shellCwd(shellId),
          };
        }
        const result = isSereCli(line)
          ? await runSereCommand(line, shellId)
          : await vm.run(line, undefined, shellId);
        updateSessionCwd(shellId, result.cwd);
        pullGuestFiles();
        if (result.output) {
          appendOutput(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
        }
        return { output: result.output, cwdDisplay: result.cwd };
      });
    },
    [appendOutput, enqueueRun, pullGuestFiles, runSereCommand, updateSessionCwd],
  );

  const openNewShell = useCallback(() => {
    const vm = nanoRef.current;
    const api = dockApiRef.current;
    if (!vm || !api) {
      return;
    }
    shellCountRef.current += 1;
    const id = vm.createShell();
    const title = `Terminal ${shellCountRef.current}`;
    const session: TerminalSession = {
      id,
      title,
      cwd: vm.shellCwd(id),
      generation: 0,
    };
    setTerminalSessions((current) => [...current, session]);
    const reference =
      api.getPanel(TERMINAL_PANEL_ID) ??
      api.panels.find((panel) => shellIdFromPanelId(panel.id)) ??
      api.getPanel(editorPanelId(defaultOpenPath(kind)));
    api.addPanel({
      id: terminalPanelId(id),
      component: "terminal",
      title,
      params: { sessionId: id },
      position: reference
        ? { referencePanel: reference.id, direction: "within" }
        : { direction: "below" },
    });
  }, [kind]);

  const reloadShell = useCallback(
    (shellId?: string) => {
      const vm = nanoRef.current;
      if (!vm) {
        return;
      }
      const api = dockApiRef.current;
      const target =
        shellId ??
        (api?.activePanel ? shellIdFromPanelId(api.activePanel.id) : null) ??
        DEFAULT_SHELL_ID;
      const cwd = vm.reloadShell(target);
      setTerminalSessions((current) =>
        current.map((session) =>
          session.id === target
            ? { ...session, cwd, generation: session.generation + 1 }
            : session,
        ),
      );
      updateSessionCwd(target, cwd);
      pullGuestFiles();
    },
    [pullGuestFiles, updateSessionCwd],
  );

  const refreshFromGuest = useCallback(() => {
    pullGuestFiles();
  }, [pullGuestFiles]);

  const updateSettings = useCallback((patch: Partial<WorkbenchSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveWorkbenchSettings(next);
      return next;
    });
  }, []);

  const setEmitIrOnRun = useCallback((value: boolean) => {
    updateSettings({ emitIrOnRun: value });
  }, [updateSettings]);

  const revealBuildUi = useCallback(() => {
    if (dockApi) {
      focusBuildSurfaces(dockApi, kind);
    }
  }, [dockApi, kind]);

  const emitCompileViews = useCallback(async () => {
    const entry = defaultOpenPath(kind);

    function artifactText(
      result: { text: string; log: string; exitCode: number; files?: WorkspaceFile[] },
      rel: string,
      label: string,
    ): string {
      const fromDisk =
        result.text.trim() ||
        result.files?.find((file) => file.path === rel)?.content.trim() ||
        "";
      if (fromDisk) {
        return fromDisk;
      }
      const log = result.log.trim();
      return `; ${label} emit failed (exit ${result.exitCode})\n${log || "no compiler output"}`;
    }

    if (sereBackendRef.current === "host") {
      const llvm = await emitHostArtifact(
        projectId,
        "llvm",
        entry,
        persistableFiles(filesRef.current),
      );
      const asm = await emitHostArtifact(
        projectId,
        "asm",
        entry,
        persistableFiles(filesRef.current),
      );
      setLlvmIr(artifactText(llvm, "build/out.ll", "LLVM IR"));
      setAssembly(artifactText(asm, "build/out.s", "ASM"));
      applyHostSnapshot(asm.files?.length ? asm.files : llvm.files ?? []);
      if (llvm.exitCode !== 0 && llvm.log.trim()) {
        appendOutput(llvm.log.endsWith("\n") ? llvm.log : `${llvm.log}\n`);
      }
      if (asm.exitCode !== 0 && asm.log.trim()) {
        appendOutput(asm.log.endsWith("\n") ? asm.log : `${asm.log}\n`);
      }
      return;
    }
    const vm = nanoRef.current;
    if (!vm) {
      return;
    }
    const guest = toGuestPath(entry);
    await vm.run(`sere --emit-llvm ${guest} -o /work/build/out.ll`);
    await vm.run(`sere --emit-asm ${guest} -o /work/build/out.s`);
    const llvm = vm.readGuest("/work/build/out.ll") ?? vm.readGuest("/tmp/out.ll");
    const asm = vm.readGuest("/work/build/out.s") ?? vm.readGuest("/tmp/out.s");
    if (llvm) {
      vm.writeFile("build/out.ll", llvm);
      setLlvmIr(llvm);
    }
    if (asm) {
      vm.writeFile("build/out.s", asm);
      setAssembly(asm);
    }
  }, [appendOutput, applyHostSnapshot, kind, projectId]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    nanoRef.current?.cancel();
    setBusy(false);
    setStatus("Ready");
  }, []);

  const build = useCallback(async () => {
    cancelledRef.current = false;
    setBusy(true);
    setStatus("Building");
    revealBuildUi();
    const command = "sere build";
    appendOutput(`\n$ ${command}\n`);
    writeTerminal(`\r\n$ ${command}\r\n`);
    try {
      const result = await runSereCommand(command);
      if (cancelledRef.current) {
        appendOutput("build cancelled.\n");
        writeTerminal("build cancelled.\r\n");
        setBusy(false);
        setStatus("Ready");
        promptDefaultTerminal();
        return;
      }
      if (result.output) {
        appendOutput(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
        writeTerminal(result.output.replace(/\n/g, "\r\n"));
      }
      updateSessionCwd(DEFAULT_SHELL_ID, result.cwd);
      pullGuestFiles();
      if (settingsRef.current.emitIrOnRun) {
        try {
          await emitCompileViews();
          showWidget("ir-asm");
        } catch (emitError) {
          const message = emitError instanceof Error ? emitError.message : "emit failed";
          appendOutput(`LLVM/ASM emit skipped: ${message}\n`);
        }
      }
      setBusy(false);
      setStatus(result.exitCode === 0 ? "Ready" : "Build failed");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "build failed";
      appendOutput(`${message}\n`);
      writeTerminal(`${message}\r\n`);
      setBusy(false);
      setStatus("Build failed");
    }
    promptDefaultTerminal();
  }, [appendOutput, emitCompileViews, promptDefaultTerminal, pullGuestFiles, revealBuildUi, runSereCommand, showWidget, updateSessionCwd, writeTerminal]);

  const run = useCallback(async () => {
    cancelledRef.current = false;
    setBusy(true);
    setStatus("Running");
    revealBuildUi();
    const command = kind === "lib" ? "sere pack" : "sere run";
    appendOutput(`\n$ ${command}\n`);
    writeTerminal(`\r\n$ ${command}\r\n`);
    try {
      const result = await runSereCommand(command);
      if (cancelledRef.current) {
        appendOutput("run cancelled.\n");
        writeTerminal("run cancelled.\r\n");
        setBusy(false);
        setStatus("Ready");
        promptDefaultTerminal();
        return;
      }
      if (result.output) {
        appendOutput(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
        writeTerminal(result.output.replace(/\n/g, "\r\n"));
      }
      updateSessionCwd(DEFAULT_SHELL_ID, result.cwd);
      pullGuestFiles();
      if (settingsRef.current.emitIrOnRun) {
        try {
          await emitCompileViews();
          showWidget("ir-asm");
        } catch (emitError) {
          const message = emitError instanceof Error ? emitError.message : "emit failed";
          appendOutput(`LLVM/ASM emit skipped: ${message}\n`);
        }
      }
      setBusy(false);
      setStatus(result.exitCode === 0 ? "Ready" : "Build failed");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "run failed";
      appendOutput(`${message}\n`);
      writeTerminal(`${message}\r\n`);
      setBusy(false);
      setStatus("Build failed");
    }
    promptDefaultTerminal();
  }, [appendOutput, emitCompileViews, kind, promptDefaultTerminal, pullGuestFiles, revealBuildUi, runSereCommand, showWidget, updateSessionCwd, writeTerminal]);

  const value = useMemo(
    () => ({
      kind,
      projectName,
      files,
      status,
      hydrated,
      bootProgress,
      busy,
      dirty,
      updateFile,
      getFile,
      openFile,
      addFile,
      addFolder,
      deleteFile,
      deleteEntries,
      renameEntry,
      moveEntries,
      copyEntries,
      importFiles,
      startExplorerCreate,
      explorerCreateIntent,
      clearExplorerCreateIntent,
      closeActiveEditor,
      resetLayout,
      showWidget,
      setDockApi,
      registerEditor,
      unregisterEditor,
      undo,
      redo,
      find,
      format,
      save,
      build,
      run,
      stop,
      writeTerminal,
      registerTerminal,
      runTerminalCommand,
      openNewShell,
      reloadShell,
      refreshFromGuest,
      terminalSessions,
      cwdDisplay,
      sereVersion,
      compilerBackend,
      lspStatus,
      outputText,
      llvmIr,
      assembly,
      emitIrOnRun: settings.emitIrOnRun,
      setEmitIrOnRun,
      settings,
      updateSettings,
    }),
    [
      kind,
      projectName,
      files,
      status,
      hydrated,
      bootProgress,
      busy,
      dirty,
      updateFile,
      getFile,
      openFile,
      addFile,
      addFolder,
      deleteFile,
      deleteEntries,
      renameEntry,
      moveEntries,
      copyEntries,
      importFiles,
      startExplorerCreate,
      explorerCreateIntent,
      clearExplorerCreateIntent,
      closeActiveEditor,
      resetLayout,
      showWidget,
      setDockApi,
      registerEditor,
      unregisterEditor,
      undo,
      redo,
      find,
      format,
      save,
      build,
      run,
      stop,
      writeTerminal,
      registerTerminal,
      runTerminalCommand,
      openNewShell,
      reloadShell,
      refreshFromGuest,
      terminalSessions,
      cwdDisplay,
      sereVersion,
      compilerBackend,
      lspStatus,
      outputText,
      llvmIr,
      assembly,
      settings.emitIrOnRun,
      setEmitIrOnRun,
      settings,
      updateSettings,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return context;
}

export function directoryForAction(path: string, kind: "file" | "dir"): string {
  return kind === "dir" ? path : parentDir(path);
}

function ensureLibsFolder(files: WorkspaceFile[]): WorkspaceFile[] {
  if (files.some((file) => file.path === "libs/README.txt" || file.path.startsWith("libs/"))) {
    return files;
  }
  return [
    ...files,
    {
      path: "libs/README.txt",
      content:
        "Drop a packed .slib or a folder library here, then import it.\nNative C++ under libs/native is optional (set native = true in sere.toml).\n",
    },
  ];
}
