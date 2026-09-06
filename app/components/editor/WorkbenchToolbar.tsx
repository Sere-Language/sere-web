"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import ArrowRotateLeft from "@gravity-ui/icons/ArrowRotateLeft";
import ArrowRotateRight from "@gravity-ui/icons/ArrowRotateRight";
import CircleStop from "@gravity-ui/icons/CircleStop";
import FloppyDisk from "@gravity-ui/icons/FloppyDisk";
import Gear from "@gravity-ui/icons/Gear";
import Hammer from "@gravity-ui/icons/Hammer";
import Magnifier from "@gravity-ui/icons/Magnifier";
import Play from "@gravity-ui/icons/Play";
import MenuBar, { MenuItem, MenuSeparator } from "./MenuBar";
import WbIcon, { type WbIconComponent } from "./WbIcon";
import { useWorkspace } from "./WorkspaceContext";

interface WorkbenchToolbarProps {
  onAddFile: () => void;
  onAddFolder: () => void;
  onImport: () => void;
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  icon: WbIconComponent;
  onClick: () => void;
  disabled?: boolean;
  accent?: "primary" | "success" | "danger";
}) {
  const color =
    accent === "primary"
      ? "text-primary hover:bg-primary/15"
      : accent === "success"
        ? "text-success hover:bg-success/15"
        : accent === "danger"
          ? "text-danger hover:bg-danger/15"
          : "text-muted hover:bg-white/8 hover:text-foreground";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-40 ${color}`}
      onClick={onClick}
    >
      <WbIcon icon={icon} className="size-4" />
    </button>
  );
}

export default function WorkbenchToolbar({ onAddFile, onAddFolder, onImport }: WorkbenchToolbarProps) {
  const router = useRouter();
  const {
    projectName,
    kind,
    busy,
    dirty,
    closeActiveEditor,
    resetLayout,
    showWidget,
    openNewShell,
    reloadShell,
    undo,
    redo,
    find,
    format,
    save,
    build,
    run,
    stop,
    emitIrOnRun,
    setEmitIrOnRun,
  } = useWorkspace();

  return (
    <div className="relative z-50 flex min-h-11 shrink-0 flex-wrap items-center gap-1 border-b border-border bg-background px-3 py-1.5">
      <Link
        href="/cloud/projects"
        className="hidden text-[12px] text-muted no-underline hover:text-foreground hover:no-underline sm:inline"
      >
        Projects
      </Link>
      <span className="hidden text-[12px] text-white/20 sm:inline">/</span>
      <p className="m-0 max-w-40 truncate text-[13px] font-medium tracking-tight">{projectName}</p>
      <span className="rounded-md border border-white/8 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">
        {kind === "lib" ? "lib" : "app"}
      </span>
      {dirty ? (
        <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">unsaved</span>
      ) : null}
      <div className="mx-1.5 hidden h-4 w-px bg-white/10 sm:block" />
      <div className="flex max-w-full items-center overflow-x-auto">
        <MenuBar label="File">
          <MenuItem onClick={onAddFile}>New file</MenuItem>
          <MenuItem onClick={onAddFolder}>New folder</MenuItem>
          <MenuItem onClick={onImport}>Import file…</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => void save()}>Save</MenuItem>
          <MenuItem onClick={closeActiveEditor}>Close editor</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => showWidget("settings")}>Settings</MenuItem>
          <MenuItem onClick={() => router.push("/cloud/projects")}>Close project</MenuItem>
        </MenuBar>
        <MenuBar label="Edit">
          <MenuItem onClick={undo}>Undo</MenuItem>
          <MenuItem onClick={redo}>Redo</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={find}>Find</MenuItem>
          <MenuItem onClick={format}>Format document</MenuItem>
        </MenuBar>
        <MenuBar label="View">
          <MenuItem onClick={() => showWidget("files")}>Files</MenuItem>
          <MenuItem onClick={() => showWidget("search")}>Search in files</MenuItem>
          <MenuItem onClick={() => showWidget("output")}>Output</MenuItem>
          <MenuItem onClick={() => showWidget("terminal")}>Terminal</MenuItem>
          <MenuItem onClick={() => showWidget("ir-asm")}>LLVM IR</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => showWidget("settings")}>Settings</MenuItem>
          <MenuItem
            checked={emitIrOnRun}
            onClick={() => setEmitIrOnRun(!emitIrOnRun)}
          >
            Emit LLVM / ASM on run
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={resetLayout}>Reset layout</MenuItem>
        </MenuBar>
        <MenuBar label="Terminal">
          <MenuItem onClick={openNewShell}>New shell</MenuItem>
          <MenuItem onClick={() => reloadShell()}>Reload shell</MenuItem>
          <MenuItem onClick={() => showWidget("terminal")}>Show terminal</MenuItem>
        </MenuBar>
        <MenuBar label="Run">
          <MenuItem onClick={() => void build()} disabled={busy}>
            Build
          </MenuItem>
          <MenuItem onClick={() => void run()} disabled={busy}>
            Run
          </MenuItem>
          <MenuItem onClick={stop} disabled={!busy}>
            Stop
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            checked={emitIrOnRun}
            onClick={() => setEmitIrOnRun(!emitIrOnRun)}
          >
            Emit LLVM / ASM on run
          </MenuItem>
        </MenuBar>
        <MenuBar label="Settings">
          <MenuItem onClick={() => showWidget("settings")}>Open settings</MenuItem>
          <MenuItem
            checked={emitIrOnRun}
            onClick={() => setEmitIrOnRun(!emitIrOnRun)}
          >
            Emit LLVM / ASM on run
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={resetLayout}>Reset layout</MenuItem>
        </MenuBar>
      </div>
      <div className="ml-auto flex max-w-full items-center gap-0.5 overflow-x-auto">
        <IconButton label="Undo" icon={ArrowRotateLeft} onClick={undo} />
        <IconButton label="Redo" icon={ArrowRotateRight} onClick={redo} />
        <IconButton label="Save" icon={FloppyDisk} onClick={() => void save()} />
        <IconButton label="Find" icon={Magnifier} onClick={find} />
        <div className="mx-1.5 h-4 w-px bg-white/10" />
        <IconButton
          label="Build"
          icon={Hammer}
          onClick={() => void build()}
          disabled={busy}
          accent="primary"
        />
        <IconButton
          label="Run"
          icon={Play}
          onClick={() => void run()}
          disabled={busy}
          accent="success"
        />
        <IconButton
          label="Stop"
          icon={CircleStop}
          onClick={stop}
          disabled={!busy}
          accent="danger"
        />
        <div className="mx-1.5 h-4 w-px bg-white/10" />
        <IconButton label="Settings" icon={Gear} onClick={() => showWidget("settings")} />
      </div>
    </div>
  );
}
