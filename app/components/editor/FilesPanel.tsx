"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import ArrowChevronDown from "@gravity-ui/icons/ArrowChevronDown";
import ArrowChevronRight from "@gravity-ui/icons/ArrowChevronRight";
import ArrowsRotateRight from "@gravity-ui/icons/ArrowsRotateRight";
import FilePlus from "@gravity-ui/icons/FilePlus";
import FolderPlus from "@gravity-ui/icons/FolderPlus";
import { persistableFiles } from "@/app/lib/sereInit";
import {
  buildFileTree,
  defaultOpenPath,
  directorySetFromFiles,
  isKeepFile,
  joinDest,
  joinWorkspacePath,
  parentDir,
  pathBasename,
  shouldConfirmDeletion,
  suggestedCreateName,
  topLevelPaths,
  type FileTreeNode,
} from "@/app/lib/workspace";
import FileIcon from "./FileIcon";
import WbIcon, { type WbIconComponent } from "./WbIcon";
import NamePrompt from "./NamePrompt";
import { directoryForAction, useWorkspace } from "./WorkspaceContext";

const DRAG_TYPE = "application/x-sere-explorer";

type EntryKind = "file" | "dir" | "root";

interface MenuState {
  x: number;
  y: number;
  path: string;
  kind: EntryKind;
}

interface ClipboardState {
  mode: "copy" | "cut";
  paths: string[];
}

interface CreateDraft {
  kind: "file" | "folder";
  directory: string;
  value: string;
}

function flattenVisible(nodes: FileTreeNode[], openDirs: Set<string>): FileTreeNode[] {
  const rows: FileTreeNode[] = [];
  function walk(list: FileTreeNode[]): void {
    for (const node of list) {
      if (node.kind === "file" && isKeepFile(node.path)) {
        continue;
      }
      rows.push(node);
      if (node.kind === "dir" && openDirs.has(node.path) && node.children) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return rows;
}

function clampMenu(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const pad = 8;
  return {
    x: Math.min(Math.max(pad, x), Math.max(pad, window.innerWidth - width - pad)),
    y: Math.min(Math.max(pad, y), Math.max(pad, window.innerHeight - height - pad)),
  };
}

export default function FilesPanel() {
  const {
    files,
    openFile,
    addFile,
    addFolder,
    deleteEntries,
    renameEntry,
    moveEntries,
    copyEntries,
    importFiles,
    projectName,
    kind,
    refreshFromGuest,
    explorerCreateIntent,
    clearExplorerCreateIntent,
    runTerminalCommand,
    showWidget,
  } = useWorkspace();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [actionDirPath, setActionDirPath] = useState("");
  const [nameDialog, setNameDialog] = useState<"move" | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusPath, setFocusPath] = useState(() => defaultOpenPath(kind));
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => new Set(["src", "libs", "scripts", "bin"]));
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const seenDirsRef = useRef<Set<string> | null>(null);

  const tree = useMemo(() => buildFileTree(persistableFiles(files)), [files]);
  const visible = useMemo(() => flattenVisible(tree, openDirs), [openDirs, tree]);

  useEffect(() => {
    const dirs = directorySetFromFiles(files);
    if (seenDirsRef.current === null) {
      seenDirsRef.current = dirs;
      return;
    }
    const added: string[] = [];
    for (const dir of dirs) {
      if (!seenDirsRef.current.has(dir)) {
        added.push(dir);
      }
    }
    seenDirsRef.current = dirs;
    if (added.length === 0) {
      return;
    }
    setOpenDirs((current) => {
      const next = new Set(current);
      for (const dir of added) {
        let prefix = "";
        for (const part of dir.split("/")) {
          prefix = prefix ? `${prefix}/${part}` : part;
          next.add(prefix);
        }
      }
      return next;
    });
  }, [files]);

  const actionDir = useCallback(
    (path: string, entryKind: EntryKind) => {
      if (entryKind === "root") {
        return "";
      }
      return directoryForAction(path, entryKind === "dir" ? "dir" : "file");
    },
    [],
  );

  const selectedDir = useCallback((): string => {
    if (menu) {
      return actionDir(menu.path, menu.kind);
    }
    const focused = visible.find((node) => node.path === focusPath);
    if (focused) {
      return actionDir(focused.path, focused.kind);
    }
    const first = [...selected][0];
    if (first) {
      const node = visible.find((entry) => entry.path === first);
      return actionDir(first, node?.kind ?? "file");
    }
    return "";
  }, [actionDir, focusPath, menu, selected, visible]);

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu || !menuRef.current) {
      return;
    }
    const box = menuRef.current.getBoundingClientRect();
    setMenuPos(clampMenu(menu.x, menu.y, box.width, box.height));
  }, [menu]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setMenu(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function toggleDir(path: string) {
    setOpenDirs((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function ensureDirOpen(path: string) {
    if (!path) {
      return;
    }
    setOpenDirs((current) => {
      const next = new Set(current);
      let prefix = "";
      for (const part of path.split("/")) {
        prefix = prefix ? `${prefix}/${part}` : part;
        next.add(prefix);
      }
      return next;
    });
  }

  function selectClick(event: MouseEvent, node: FileTreeNode) {
    event.stopPropagation();
    const additive = event.metaKey || event.ctrlKey;
    const range = event.shiftKey;
    setFocusPath(node.path);

    setSelected((current) => {
      if (range) {
        const from = visible.findIndex((entry) => entry.path === focusPath);
        const to = visible.findIndex((entry) => entry.path === node.path);
        if (from === -1 || to === -1) {
          return new Set([node.path]);
        }
        const [start, end] = from < to ? [from, to] : [to, from];
        return new Set(visible.slice(start, end + 1).map((entry) => entry.path));
      }
      if (additive) {
        const next = new Set(current);
        if (next.has(node.path)) {
          next.delete(node.path);
        } else {
          next.add(node.path);
        }
        return next;
      }
      return new Set([node.path]);
    });

    if (node.kind === "file" && !additive && !range) {
      openFile(node.path);
    }
    if (node.kind === "dir" && !additive && !range) {
      toggleDir(node.path);
    }
  }

  function openMenu(event: MouseEvent, path: string, entryKind: EntryKind) {
    event.preventDefault();
    event.stopPropagation();
    setSelected((current) => {
      if (entryKind !== "root" && !current.has(path)) {
        return new Set([path]);
      }
      return current;
    });
    if (entryKind !== "root") {
      setFocusPath(path);
    }
    setMenuPos({ x: event.clientX, y: event.clientY });
    setMenu({ x: event.clientX, y: event.clientY, path, kind: entryKind });
  }

  function beginRename(path: string) {
    setRenaming(path);
    setRenameValue(pathBasename(path));
    setMenu(null);
  }

  function commitRename() {
    if (!renaming) {
      return;
    }
    const path = renaming;
    const nextName = renameValue;
    setRenaming(null);
    try {
      renameEntry(path, nextName);
      setFocusPath(joinDest(parentDir(path), nextName.trim()));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not rename.");
    }
  }

  function copySelected() {
    const paths = selected.size > 0 ? [...selected] : focusPath ? [focusPath] : [];
    if (paths.length === 0) {
      return;
    }
    setClipboard({ mode: "copy", paths });
    setMenu(null);
  }

  function cutSelected() {
    const paths = selected.size > 0 ? [...selected] : focusPath ? [focusPath] : [];
    if (paths.length === 0) {
      return;
    }
    setClipboard({ mode: "cut", paths });
    setMenu(null);
  }

  function pasteInto(destDir: string) {
    if (!clipboard) {
      return;
    }
    try {
      if (clipboard.mode === "copy") {
        copyEntries(clipboard.paths, destDir);
      } else {
        moveEntries(clipboard.paths, destDir);
        setClipboard(null);
      }
      ensureDirOpen(destDir);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not paste.");
    }
    setMenu(null);
  }

  function deleteSelected() {
    const paths = selected.size > 0 ? [...selected] : focusPath ? [focusPath] : [];
    if (paths.length === 0) {
      return;
    }
    const label = paths.length === 1 ? pathBasename(paths[0] ?? "") : `${paths.length} items`;
    if (shouldConfirmDeletion(files, paths) && !window.confirm(`Delete ${label}?`)) {
      return;
    }
    deleteEntries(paths);
    setSelected(new Set());
    setMenu(null);
  }

  async function copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      window.alert("Could not copy the path.");
    }
    setMenu(null);
  }

  function pathsFromDrag(event: DragEvent): string[] {
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  function dropDestination(path: string, entryKind: EntryKind): string {
    return actionDir(path, entryKind);
  }

  function handleDrop(event: DragEvent, path: string, entryKind: EntryKind) {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    const destDir = dropDestination(path, entryKind);
    const internal = pathsFromDrag(event);
    if (internal.length > 0) {
      try {
        if (event.ctrlKey || event.altKey) {
          copyEntries(internal, destDir);
        } else {
          moveEntries(internal, destDir);
        }
        ensureDirOpen(destDir);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Could not move those items.");
      }
      return;
    }
    if (event.dataTransfer.files.length > 0) {
      void importDropped(event.dataTransfer.files, destDir);
    }
  }

  async function importDropped(fileList: FileList, destDir: string) {
    const imported = await Promise.all(
      Array.from(fileList).map(async (file) => {
        const relative = file.webkitRelativePath || file.name;
        return {
          path: joinWorkspacePath(destDir, relative),
          content: await file.text(),
        };
      }),
    );
    importFiles(imported);
    ensureDirOpen(destDir);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const meta = event.metaKey || event.ctrlKey;
    if (renaming || createDraft) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const index = Math.max(0, visible.findIndex((node) => node.path === focusPath));
      const next = visible[Math.min(visible.length - 1, index + 1)];
      if (next) {
        setFocusPath(next.path);
        setSelected(new Set([next.path]));
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const index = Math.max(0, visible.findIndex((node) => node.path === focusPath));
      const next = visible[Math.max(0, index - 1)];
      if (next) {
        setFocusPath(next.path);
        setSelected(new Set([next.path]));
      }
      return;
    }
    if (event.key === "Enter" && focusPath) {
      event.preventDefault();
      const node = visible.find((entry) => entry.path === focusPath);
      if (node?.kind === "dir") {
        toggleDir(node.path);
      } else if (node?.kind === "file") {
        openFile(node.path);
      }
      return;
    }
    if (event.key === "F2" && focusPath) {
      event.preventDefault();
      beginRename(focusPath);
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      deleteSelected();
      return;
    }
    if (event.key === "Escape") {
      setMenu(null);
      setSelected(new Set());
      return;
    }
    if (meta && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelected();
      return;
    }
    if (meta && event.key.toLowerCase() === "x") {
      event.preventDefault();
      cutSelected();
      return;
    }
    if (meta && event.key.toLowerCase() === "v") {
      event.preventDefault();
      pasteInto(selectedDir());
      return;
    }
    if (meta && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelected(new Set(visible.map((node) => node.path)));
    }
  }

  function beginCreate(kind: "file" | "folder", directory?: string) {
    const dir = directory ?? selectedDir();
    ensureDirOpen(dir);
    setCreateDraft({
      kind,
      directory: dir,
      value: suggestedCreateName(files, dir, kind),
    });
    setRenaming(null);
    setMenu(null);
  }

  useEffect(() => {
    if (!explorerCreateIntent) {
      return;
    }
    beginCreate(explorerCreateIntent.kind, explorerCreateIntent.directory);
    clearExplorerCreateIntent();
  }, [clearExplorerCreateIntent, explorerCreateIntent]);

  function commitCreate(): boolean {
    if (!createDraft) {
      return true;
    }
    const name = createDraft.value.trim();
    if (!name) {
      setCreateDraft(null);
      return true;
    }
    try {
      if (createDraft.kind === "folder") {
        addFolder(createDraft.directory, name);
        ensureDirOpen(joinWorkspacePath(createDraft.directory, name));
      } else {
        addFile(createDraft.directory, name);
      }
      setCreateDraft(null);
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not create that path.");
      return false;
    }
  }

  function startCreate(kind: "file" | "folder", directory?: string) {
    beginCreate(kind, directory);
  }

  function setCreateDraftValue(value: string) {
    setCreateDraft((current) => (current ? { ...current, value } : current));
  }

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col bg-transparent"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={() => {
        setMenu(null);
        setSelected(new Set());
      }}
      onContextMenu={(event) => openMenu(event, "", "root")}
      onDragOver={(event) => {
        event.preventDefault();
        setDropTarget("");
      }}
      onDragLeave={() => setDropTarget(null)}
      onDrop={(event) => handleDrop(event, "", "root")}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/6 px-3">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-tight text-foreground/90" title={projectName}>
          {projectName}
        </span>
        <div className="flex items-center gap-0.5">
          <HeaderButton
            label="New file"
            icon={FilePlus}
            onClick={() => startCreate("file")}
          />
          <HeaderButton
            label="New folder"
            icon={FolderPlus}
            onClick={() => startCreate("folder")}
          />
          <HeaderButton
            label="Refresh from NanoVM"
            icon={ArrowsRotateRight}
            onClick={refreshFromGuest}
          />
        </div>
      </div>
      <div
        className={`min-h-0 flex-1 overflow-auto px-1.5 py-2 ${
          dropTarget === "" ? "bg-primary/10" : ""
        }`}
      >
        {createDraft && createDraft.directory === "" ? (
          <CreateRow
            depth={0}
            kind={createDraft.kind}
            value={createDraft.value}
            onValue={setCreateDraftValue}
            onCommit={commitCreate}
            onCancel={() => setCreateDraft(null)}
          />
        ) : null}
        {tree
          .filter((node) => !(node.kind === "file" && isKeepFile(node.path)))
          .map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            openDirs={openDirs}
            selected={selected}
            focusPath={focusPath}
            renaming={renaming}
            renameValue={renameValue}
            createDraft={createDraft}
            dropTarget={dropTarget}
            clipboard={clipboard}
            onRenameValue={setRenameValue}
            onRenameCommit={commitRename}
            onRenameCancel={() => setRenaming(null)}
            onCreateValue={setCreateDraftValue}
            onCreateCommit={commitCreate}
            onCreateCancel={() => setCreateDraft(null)}
            onToggle={toggleDir}
            onMenu={openMenu}
            onSelect={selectClick}
            onDragStart={(event, nodePath) => {
              const paths =
                selected.has(nodePath) && selected.size > 0 ? [...selected] : [nodePath];
              event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(topLevelPaths(paths)));
              event.dataTransfer.setData("text/plain", topLevelPaths(paths).join("\n"));
              event.dataTransfer.effectAllowed = "copyMove";
              if (!selected.has(nodePath)) {
                setSelected(new Set([nodePath]));
                setFocusPath(nodePath);
              }
            }}
            onDragOver={(event, nodePath, entryKind) => {
              event.preventDefault();
              event.stopPropagation();
              setDropTarget(dropDestination(nodePath, entryKind));
            }}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {menu
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[200] min-w-48 rounded-lg border border-white/10 bg-[#141618]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              style={{ left: menuPos.x || menu.x, top: menuPos.y || menu.y }}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <MenuRow onClick={() => startCreate("file", actionDir(menu.path, menu.kind))}>
                New file
              </MenuRow>
              <MenuRow onClick={() => startCreate("folder", actionDir(menu.path, menu.kind))}>
                New folder
              </MenuRow>
              <MenuSep />
              {menu.kind === "file" ? (
                <MenuRow
                  onClick={() => {
                    openFile(menu.path);
                    closeMenu();
                  }}
                >
                  Open
                </MenuRow>
              ) : null}
              {menu.kind !== "root" ? (
                <MenuRow onClick={() => beginRename(menu.path)}>Rename</MenuRow>
              ) : null}
              {menu.kind !== "root" ? <MenuRow onClick={cutSelected}>Cut</MenuRow> : null}
              {menu.kind !== "root" ? <MenuRow onClick={copySelected}>Copy</MenuRow> : null}
              <MenuRow disabled={!clipboard} onClick={() => pasteInto(actionDir(menu.path, menu.kind))}>
                Paste
              </MenuRow>
              {menu.kind !== "root" ? (
                <MenuRow
                  onClick={() => {
                    setActionDirPath(actionDir(menu.path, menu.kind));
                    setNameDialog("move");
                    closeMenu();
                  }}
                >
                  Move to…
                </MenuRow>
              ) : null}
              {menu.kind !== "root" ? (
                <MenuRow onClick={() => void copyPath(menu.path)}>Copy path</MenuRow>
              ) : null}
              <MenuRow
                onClick={() => {
                  const dir = actionDir(menu.path, menu.kind);
                  const guest = dir ? `/work/${dir}` : "/work";
                  showWidget("terminal");
                  void runTerminalCommand(`cd ${guest} && ls`);
                  closeMenu();
                }}
              >
                Reveal in terminal
              </MenuRow>
              {menu.kind !== "root" ? (
                <>
                  <MenuSep />
                  <MenuRow danger onClick={deleteSelected}>
                    Delete
                  </MenuRow>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {nameDialog === "move"
        ? createPortal(
            <NamePrompt
              title="Move to"
              label="Folder path"
              confirmLabel="Move"
              initialValue={actionDirPath}
              onCancel={() => setNameDialog(null)}
              onConfirm={(value) => {
                try {
                  const dest = value.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
                  const paths = selected.size > 0 ? [...selected] : focusPath ? [focusPath] : [];
                  moveEntries(paths, dest);
                  ensureDirOpen(dest);
                  setNameDialog(null);
                } catch (error) {
                  window.alert(
                    error instanceof Error ? error.message : "Could not complete that action.",
                  );
                }
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function HeaderButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: WbIconComponent;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-white/8 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <WbIcon icon={icon} className="size-3.5" />
    </button>
  );
}

function MenuRow({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`block w-full rounded-lg px-3 py-2 text-left text-[12px] disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "text-[#c25248] hover:bg-[#c25248]/10" : "text-[#eeeae8] hover:bg-white/8"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuSep() {
  return <div className="mx-1.5 my-1.5 border-t border-white/8" />;
}

function CreateRow({
  depth,
  kind,
  value,
  onValue,
  onCommit,
  onCancel,
}: {
  depth: number;
  kind: "file" | "folder";
  value: string;
  onValue: (value: string) => void;
  onCommit: () => boolean | void;
  onCancel: () => void;
}) {
  const pad = 10 + depth * 16 + (kind === "file" ? 14 : 0);
  return (
    <div
      className="relative mx-1 mb-0.5 flex h-7 w-[calc(100%-0.5rem)] items-center gap-1.5 rounded-lg bg-primary/15 pr-2 text-left text-[#eeeae8]"
      style={{ paddingLeft: pad }}
      onClick={(event) => event.stopPropagation()}
    >
      {kind === "folder" ? (
        <WbIcon icon={ArrowChevronRight} className="size-2.5 shrink-0 text-[#6e6a68]" />
      ) : null}
      <FileIcon name={value || (kind === "folder" ? "folder" : "file")} kind={kind === "folder" ? "dir" : "file"} />
      <InlineNameInput value={value} onValue={onValue} onCommit={onCommit} onCancel={onCancel} />
    </div>
  );
}

function InlineNameInput({
  value,
  onValue,
  onCommit,
  onCancel,
}: {
  value: string;
  onValue: (value: string) => void;
  onCommit: () => boolean | void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ignoreBlur = useRef(false);
  const finished = useRef(false);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function finish(action: () => boolean | void) {
    if (finished.current) {
      return;
    }
    const ok = action();
    if (ok === false) {
      return;
    }
    finished.current = true;
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      value={value}
      className="min-w-0 flex-1 rounded-md border border-primary/70 bg-black/30 px-1.5 text-[12px] text-[#eeeae8] outline-none"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onValue(event.target.value)}
      onBlur={() => {
        if (ignoreBlur.current) {
          return;
        }
        finish(onCommit);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(onCommit);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          ignoreBlur.current = true;
          finish(onCancel);
        }
      }}
    />
  );
}

function TreeNode({
  node,
  depth,
  openDirs,
  selected,
  focusPath,
  renaming,
  renameValue,
  createDraft,
  dropTarget,
  clipboard,
  onRenameValue,
  onRenameCommit,
  onRenameCancel,
  onCreateValue,
  onCreateCommit,
  onCreateCancel,
  onToggle,
  onMenu,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  node: FileTreeNode;
  depth: number;
  openDirs: Set<string>;
  selected: Set<string>;
  focusPath: string;
  renaming: string | null;
  renameValue: string;
  createDraft: CreateDraft | null;
  dropTarget: string | null;
  clipboard: ClipboardState | null;
  onRenameValue: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onCreateValue: (value: string) => void;
  onCreateCommit: () => boolean | void;
  onCreateCancel: () => void;
  onToggle: (path: string) => void;
  onMenu: (event: MouseEvent, path: string, kind: EntryKind) => void;
  onSelect: (event: MouseEvent, node: FileTreeNode) => void;
  onDragStart: (event: DragEvent, path: string) => void;
  onDragOver: (event: DragEvent, path: string, kind: EntryKind) => void;
  onDrop: (event: DragEvent, path: string, kind: EntryKind) => void;
}) {
  const open = openDirs.has(node.path);
  const isSelected = selected.has(node.path);
  const isFocus = focusPath === node.path;
  const isDrop = dropTarget === node.path;
  const dimmed = clipboard?.mode === "cut" && clipboard.paths.includes(node.path);
  const pad = 10 + depth * 16;
  const renamingThis = renaming === node.path;
  const showCreate = Boolean(createDraft && createDraft.directory === node.path && open);

  const rowClass = `group relative mx-1 mb-0.5 flex h-7 w-[calc(100%-0.5rem)] items-center gap-1.5 rounded-lg pr-2 text-left ${
    isSelected ? "bg-white/10 text-[#eeeae8]" : "text-[#c8c2be] hover:bg-white/5"
  } ${isDrop ? "ring-1 ring-primary/70" : ""} ${dimmed ? "opacity-50" : ""}`;

  const label = renamingThis ? (
    <InlineNameInput
      value={renameValue}
      onValue={onRenameValue}
      onCommit={onRenameCommit}
      onCancel={onRenameCancel}
    />
  ) : (
    <span className={`truncate text-[12px] tracking-tight ${node.kind === "dir" ? "font-medium text-[#eeeae8]" : ""}`}>
      {node.name}
    </span>
  );

  if (node.kind === "dir") {
    return (
      <div>
        <div
          draggable={!renamingThis}
          className={`${rowClass} cursor-pointer`}
          style={{ paddingLeft: pad }}
          onClick={(event) => onSelect(event, node)}
          onContextMenu={(event) => onMenu(event, node.path, "dir")}
          onDragStart={(event) => onDragStart(event, node.path)}
          onDragOver={(event) => onDragOver(event, node.path, "dir")}
          onDrop={(event) => onDrop(event, node.path, "dir")}
        >
          {isFocus ? <span className="absolute left-1.5 h-3.5 w-0.5 rounded-full bg-primary" /> : null}
          <span
            className="inline-flex"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.path);
            }}
          >
            <WbIcon
              icon={open ? ArrowChevronDown : ArrowChevronRight}
              className="size-2.5 shrink-0 text-[#6e6a68]"
            />
          </span>
          <FileIcon name={node.name} kind="dir" open={open} />
          {label}
        </div>
        {open ? (
          <>
            {showCreate && createDraft ? (
              <CreateRow
                depth={depth + 1}
                kind={createDraft.kind}
                value={createDraft.value}
                onValue={onCreateValue}
                onCommit={onCreateCommit}
                onCancel={onCreateCancel}
              />
            ) : null}
            {(node.children ?? [])
              .filter((child) => !(child.kind === "file" && isKeepFile(child.path)))
              .map((child) => (
                <TreeNode
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  openDirs={openDirs}
                  selected={selected}
                  focusPath={focusPath}
                  renaming={renaming}
                  renameValue={renameValue}
                  createDraft={createDraft}
                  dropTarget={dropTarget}
                  clipboard={clipboard}
                  onRenameValue={onRenameValue}
                  onRenameCommit={onRenameCommit}
                  onRenameCancel={onRenameCancel}
                  onCreateValue={onCreateValue}
                  onCreateCommit={onCreateCommit}
                  onCreateCancel={onCreateCancel}
                  onToggle={onToggle}
                  onMenu={onMenu}
                  onSelect={onSelect}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                />
              ))}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      draggable={!renamingThis}
      className={`${rowClass} cursor-pointer`}
      style={{ paddingLeft: pad + 12 }}
      onClick={(event) => onSelect(event, node)}
      onContextMenu={(event) => onMenu(event, node.path, "file")}
      onDragStart={(event) => onDragStart(event, node.path)}
      onDragOver={(event) => onDragOver(event, node.path, "file")}
      onDrop={(event) => onDrop(event, node.path, "file")}
    >
      {isFocus ? <span className="absolute left-1.5 h-3.5 w-0.5 rounded-full bg-primary" /> : null}
      <FileIcon name={node.name} kind="file" />
      {label}
    </div>
  );
}
