"use client";

import { useRouter } from "next/navigation";
import MenuBar, { MenuItem, MenuSeparator } from "./MenuBar";
import { useWorkspace } from "./WorkspaceContext";

interface WorkbenchMenuProps {
  onAddFile: () => void;
  onImport: () => void;
}

export default function WorkbenchMenu({ onAddFile, onImport }: WorkbenchMenuProps) {
  const router = useRouter();
  const { closeActiveEditor, resetLayout, showWidget, openNewShell, reloadShell, emitIrOnRun, setEmitIrOnRun } =
    useWorkspace();

  return (
    <div className="flex items-center gap-0.5">
      <MenuBar label="File">
        <MenuItem onClick={onAddFile}>New file…</MenuItem>
        <MenuItem onClick={onImport}>Import file…</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => showWidget("settings")}>Settings</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={closeActiveEditor}>Close editor</MenuItem>
        <MenuItem onClick={() => router.push("/cloud/projects")}>Close project</MenuItem>
      </MenuBar>
      <MenuBar label="View">
        <MenuItem onClick={() => showWidget("files")}>Show files</MenuItem>
        <MenuItem onClick={() => showWidget("output")}>Show output</MenuItem>
        <MenuItem onClick={() => showWidget("terminal")}>Show terminal</MenuItem>
        <MenuItem onClick={openNewShell}>New shell</MenuItem>
        <MenuItem onClick={() => reloadShell()}>Reload shell</MenuItem>
        <MenuItem onClick={() => showWidget("ir-asm")}>Show LLVM IR</MenuItem>
        <MenuItem onClick={() => showWidget("settings")}>Settings</MenuItem>
        <MenuSeparator />
        <MenuItem
          checked={emitIrOnRun}
          onClick={() => setEmitIrOnRun(!emitIrOnRun)}
        >
          Emit LLVM / ASM on run
        </MenuItem>
      </MenuBar>
      <MenuBar label="Layout">
        <MenuItem onClick={resetLayout}>Reset layout</MenuItem>
      </MenuBar>
    </div>
  );
}
