import type { ProjectKind } from "./projects";
import { SERE_INIT_FILES } from "./sereInitAssets";
import type { WorkspaceFile } from "./workspace";

export function shouldPersistPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  if (normalized === "venv" || normalized.startsWith("venv/")) {
    return false;
  }
  return !normalized.split("/").includes("venv");
}

const BINARY_SUFFIXES = [
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".a",
  ".lib",
  ".obj",
  ".o",
  ".pdb",
  ".res",
] as const;

export function isBinaryArtifact(path: string): boolean {
  const lower = path.replaceAll("\\", "/").toLowerCase();
  return BINARY_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export function isGeneratedOutput(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return (
    normalized === "bin" ||
    normalized.startsWith("bin/") ||
    normalized === "dist" ||
    normalized.startsWith("dist/") ||
    normalized === "build" ||
    normalized.startsWith("build/")
  );
}

export function shouldSavePath(path: string): boolean {
  return shouldPersistPath(path) && !isBinaryArtifact(path);
}

export function isProjectSereSource(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.endsWith(".sere")) {
    return false;
  }
  if (!shouldPersistPath(normalized) || isGeneratedOutput(normalized) || isBinaryArtifact(normalized)) {
    return false;
  }
  const parts = normalized.split("/");
  return !parts.includes("stdlib") && !parts.includes("node_modules");
}

export function persistableFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return files.filter((file) => shouldPersistPath(file.path));
}

export function savableFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return files.filter((file) => shouldSavePath(file.path));
}

export function mergeHostSnapshot(
  current: WorkspaceFile[],
  snapshot: WorkspaceFile[],
): WorkspaceFile[] {
  if (snapshot.length === 0) {
    return current;
  }
  const snapMap = new Map(snapshot.map((file) => [file.path, file]));
  const currentMap = new Map(current.map((file) => [file.path, file]));
  const paths = new Set([...currentMap.keys(), ...snapMap.keys()]);
  const next: WorkspaceFile[] = [];
  for (const path of [...paths].sort()) {
    const snap = snapMap.get(path);
    const cur = currentMap.get(path);
    if (isGeneratedOutput(path) || isBinaryArtifact(path)) {
      if (snap) {
        next.push(snap);
      }
      continue;
    }
    if (cur) {
      next.push(cur);
    } else if (snap) {
      next.push(snap);
    }
  }
  return next;
}

export function buildInitProjectFiles(
  kind: ProjectKind,
  projectName: string,
  sereVersion: string,
): WorkspaceFile[] {
  const exeName = projectName.replace(/[^A-Za-z0-9._-]+/g, "-") || "project";
  const tomlKind = kind === "lib" ? "lib" : "app";
  const entry = kind === "lib" ? "src/lib.sere" : "src/main.sere";
  const output =
    kind === "lib" ? `dist/${exeName}.slib` : `bin/${exeName}.exe`;
  const helloWorld = `def main() -> i32:
    print("hello world")
    return 0
`;
  const helloLib = `def hello() -> i32:
    print("hello world")
    return 0
`;

  const files = Object.entries(SERE_INIT_FILES).flatMap(([path, content]) => {
    if (path === "libs/native.sere" || path.startsWith("libs/native/")) {
      return [];
    }

    if (path === "sere.toml") {
      return [
        {
          path,
          content: `kind = "${tomlKind}"
name = "${projectName}"
sere = "${sereVersion}"
src = "src"
entry = "${entry}"
libs = "libs"
stdlib = "venv/stdlib"
output = "${output}"
opt = "O0"
native = false
`,
        },
      ];
    }

    if (path === "src/main.sere") {
      if (kind === "lib") {
        return [{ path: "src/lib.sere", content: helloLib }];
      }
      return [{ path, content: helloWorld }];
    }

    if (path === "README.txt") {
      const readme =
        kind === "lib"
          ? content
              .replaceAll("sere-app-example", projectName)
              .replaceAll("src/main.sere", entry)
              .replaceAll("sere run", "sere pack")
          : content
              .replaceAll("sere-app-example", projectName)
              .replaceAll("src/main.sere", entry);
      return [{ path, content: readme }];
    }

    return [{ path, content }];
  });

  files.push({
    path: "libs/README.txt",
    content: `Drop a packed .slib or a folder library here, then import it.
Native C++ under libs/native is optional (set native = true in sere.toml).
`,
  });

  return files;
}
