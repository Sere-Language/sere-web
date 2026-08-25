import type { WorkspaceFile } from "./workspace";

export const GUEST_ROOT = "/work";

export function toGuestPath(relativePath: string): string {
  const clean = relativePath.replaceAll("\\", "/").replace(/^\/+/g, "");
  return clean ? `${GUEST_ROOT}/${clean}` : GUEST_ROOT;
}

/** Workspace-relative path for a guest path under `/work`, or null if outside. */
export function fromGuestPath(guestPath: string): string | null {
  const clean = guestPath.replaceAll("\\", "/");
  if (clean === GUEST_ROOT) {
    return "";
  }
  if (clean.startsWith(`${GUEST_ROOT}/`)) {
    return clean.slice(GUEST_ROOT.length + 1);
  }
  return null;
}

/** rwxrwxrwx — the in-browser VM is a single-user sandbox. */
export const GUEST_ALL_PERMS = 0o777;

export function guestFileMode(_relativePath?: string): number {
  return GUEST_ALL_PERMS;
}

export function persistableGuestFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return files.filter((file) => {
    const path = file.path.replaceAll("\\", "/");
    return path !== "venv" && !path.startsWith("venv/");
  });
}
