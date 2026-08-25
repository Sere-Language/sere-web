import type { ProjectKind } from "./projects";
import { buildInitProjectFiles } from "./sereInit";

export interface WorkspaceFile {
  path: string;
  content: string;
}

export function seedWorkspaceFiles(kind: ProjectKind, projectName: string): WorkspaceFile[] {
  return buildInitProjectFiles(kind, projectName, "dev");
}

export function defaultOpenPath(kind: ProjectKind): string {
  return kind === "lib" ? "src/lib.sere" : "src/main.sere";
}

export function editorPanelId(path: string): string {
  return `editor:${path}`;
}

export function workspaceFilesEqual(left: WorkspaceFile[], right: WorkspaceFile[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const contents = new Map(left.map((file) => [file.path, file.content]));
  for (const file of right) {
    if (contents.get(file.path) !== file.content) {
      return false;
    }
  }
  return true;
}

export function fileTitle(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

export function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

export function pathBasename(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/g, "");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

export function isKeepFile(path: string): boolean {
  return path === ".keep" || path.endsWith("/.keep");
}

export function isPathInside(parent: string, child: string): boolean {
  if (parent === "") {
    return child !== "";
  }
  return child === parent || child.startsWith(`${parent}/`);
}

export function topLevelPaths(paths: Iterable<string>): string[] {
  const sorted = [...paths].sort((left, right) => left.length - right.length);
  const kept: string[] = [];
  for (const path of sorted) {
    if (kept.some((parent) => isPathInside(parent, path))) {
      continue;
    }
    kept.push(path);
  }
  return kept;
}

export function joinDest(directory: string, name: string): string {
  return directory ? `${directory}/${name}` : name;
}

export function directorySetFromFiles(files: WorkspaceFile[]): Set<string> {
  const dirs = new Set<string>();
  for (const file of files) {
    let directory = parentDir(file.path);
    while (directory) {
      dirs.add(directory);
      directory = parentDir(directory);
    }
  }
  return dirs;
}

export function suggestedCreateName(
  files: WorkspaceFile[],
  directory: string,
  kind: "file" | "folder",
): string {
  const taken = new Set(files.map((file) => file.path));
  const exists = (name: string): boolean => {
    const path = joinDest(directory, name);
    if (taken.has(path) || taken.has(`${path}/.keep`)) {
      return true;
    }
    return [...taken].some((entry) => entry === path || entry.startsWith(`${path}/`));
  };

  if (kind === "folder") {
    if (!exists("New Folder")) {
      return "New Folder";
    }
    let index = 2;
    while (exists(`New Folder ${index}`)) {
      index += 1;
    }
    return `New Folder ${index}`;
  }

  if (!exists("untitled")) {
    return "untitled";
  }
  let index = 1;
  while (exists(`untitled-${index}`)) {
    index += 1;
  }
  return `untitled-${index}`;
}

const LARGE_DELETE_BYTES = 100_000;
const LARGE_DELETE_FILES = 10;

export function shouldConfirmDeletion(files: WorkspaceFile[], paths: string[]): boolean {
  const roots = topLevelPaths(paths);
  const affected = files.filter((file) =>
    roots.some((root) => file.path === root || isPathInside(root, file.path)),
  );
  const realFiles = affected.filter((file) => !isKeepFile(file.path));
  const bytes = realFiles.reduce((sum, file) => sum + file.content.length, 0);
  return realFiles.length >= LARGE_DELETE_FILES || bytes >= LARGE_DELETE_BYTES;
}

export function rewritePrefix(path: string, fromRoot: string, toRoot: string): string {
  if (path === fromRoot) {
    return toRoot;
  }
  if (fromRoot !== "" && path.startsWith(`${fromRoot}/`)) {
    return `${toRoot}/${path.slice(fromRoot.length + 1)}`;
  }
  return path;
}

function pathConflicts(taken: Set<string>, path: string): boolean {
  if (taken.has(path)) {
    return true;
  }
  const nested = `${path}/`;
  for (const existing of taken) {
    if (existing.startsWith(nested) || path.startsWith(`${existing}/`)) {
      return true;
    }
  }
  return false;
}

export function uniqueWorkspacePath(taken: Set<string>, desired: string): string {
  if (!pathConflicts(taken, desired)) {
    return desired;
  }

  const directory = parentDir(desired);
  const base = pathBasename(desired);
  const dot = base.startsWith(".") ? -1 : base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let index = 1;
  while (true) {
    const nextName = index === 1 ? `${stem} copy${ext}` : `${stem} copy ${index}${ext}`;
    const candidate = joinDest(directory, nextName);
    if (!pathConflicts(taken, candidate)) {
      return candidate;
    }
    index += 1;
  }
}

export function joinWorkspacePath(directory: string, name: string): string {
  const cleaned = name.trim().replaceAll("\\", "/").replace(/^\/+/g, "").replace(/\/+$/g, "");
  if (!cleaned || cleaned.includes("..")) {
    throw new Error("Enter a valid file path.");
  }
  if (!directory) {
    return cleaned;
  }
  return `${directory.replace(/\/+$/g, "")}/${cleaned}`;
}

export function monacoLanguageForPath(path: string): string {
  if (path.endsWith(".sere")) {
    return "sere";
  }
  if (path.endsWith(".toml")) {
    return "ini";
  }
  if (path.endsWith(".ll") || path.endsWith(".ir")) {
    return "plaintext";
  }
  if (path.endsWith(".s") || path.endsWith(".asm")) {
    return "plaintext";
  }
  if (path.endsWith(".json")) {
    return "json";
  }
  if (path.endsWith(".md")) {
    return "markdown";
  }
  return "plaintext";
}

export function monacoModelPath(path: string): string {
  return path.endsWith(".sere") ? `file:///${path.replaceAll("\\", "/")}` : path;
}

export interface FileTreeNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: FileTreeNode[];
}

export function buildFileTree(files: WorkspaceFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let level = root;
    let prefix = "";

    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index];
      prefix = prefix ? `${prefix}/${name}` : name;
      const isFile = index === parts.length - 1;
      let node = level.find((entry) => entry.name === name);

      if (!node) {
        node = isFile
          ? { name, path: prefix, kind: "file" }
          : { name, path: prefix, kind: "dir", children: [] };
        level.push(node);
      }

      if (!isFile) {
        node.children ??= [];
        level = node.children;
      }
    }
  }

  sortTree(root);
  return root;
}

function sortTree(nodes: FileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (const node of nodes) {
    if (node.children) {
      sortTree(node.children);
    }
  }
}
