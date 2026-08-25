import { unzipSync } from "fflate";
import type { Nano } from "@userland-run/nano-sdk";

export const SERE_PREFIX = "/opt/sere";

export type SereInstallResult = {
  tag: string;
  prefix: string;
  hasCompiler: boolean;
  message: string;
};

export function diagnoseGuestSereFailure(output: string, exitCode: number): string | null {
  if (exitCode === 0) {
    return null;
  }
  const text = `${output}\nexit ${exitCode}`.toLowerCase();
  const looksLikeGuestExecFailure =
    /exec format|cannot execute|not found|no such file|illegal instruction|elf|wrong isa|permission denied|execve/.test(
      text,
    ) ||
    (/bin\/sere|sere:/.test(text) && output.trim().length < 800);
  if (!looksLikeGuestExecFailure) {
    return null;
  }
  return [
    `bin/sere exited ${exitCode} and did not run in NanoVM (RISC-V BusyBox).`,
    "linux.zip must contain a guest-runnable RISC-V (or Nano-exec) binary at bin/sere plus stdlib/.",
    "An x86 or ARM compiler will fail here. Cloud will not pretend the guest compiler works.",
    output.trim() ? `Guest output:\n${output.trim()}` : "No guest stdout.",
  ].join("\n");
}

function posix(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/g, "");
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "" : path.slice(0, index);
}

function packageRoot(names: string[]): string {
  const install = names.find((name) => name === "install.sh" || name.endsWith("/install.sh"));
  const compiler = names.find((name) => name === "bin/sere" || name.endsWith("/bin/sere"));
  const anchor = compiler ?? install;
  if (!anchor) {
    return "";
  }
  return dirname(anchor);
}

export function linuxZipHasCompiler(files: Record<string, Uint8Array>): boolean {
  return Object.keys(files).some((name) => {
    const relative = posix(name);
    return relative === "bin/sere" || relative.endsWith("/bin/sere");
  });
}

export function applySerePrefix(nano: Nano, files: Record<string, Uint8Array>, tag: string): SereInstallResult {
  const names = Object.keys(files)
    .map(posix)
    .filter((name) => name.length > 0 && !name.endsWith("/"));
  const root = packageRoot(names);
  const prefix = SERE_PREFIX;
  let wroteCompiler = false;

  for (const name of names) {
    const relative = root && (name === root || name.startsWith(`${root}/`))
      ? name.slice(root.length).replace(/^\//, "")
      : name;
    if (!relative) {
      continue;
    }
    const dest = `${prefix}/${relative}`;
    const data = files[name];
    if (!data) {
      continue;
    }
    nano.fs.writeFile(dest, data, 0o777);
    if (relative === "bin/sere") {
      wroteCompiler = true;
    }
  }

  nano.fs.writeFile(`${prefix}/.sere-release`, `${tag}\n`, 0o777);

  if (!wroteCompiler) {
    return {
      tag,
      prefix,
      hasCompiler: false,
      message: `linux.zip (${tag}) has install.sh but no bin/sere. Upload a full Linux tree (bin/sere, stdlib, install.sh) to that release.`,
    };
  }

  return {
    tag,
    prefix,
    hasCompiler: true,
    message: `Installed Sere ${tag} to ${prefix} (LLVM bootstrap skipped in the VM).`,
  };
}

export function unzipLinuxRelease(bytes: Uint8Array): Record<string, Uint8Array> {
  const unpacked = unzipSync(bytes);
  const files: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(unpacked)) {
    const path = posix(name);
    if (!path || path.endsWith("/")) {
      continue;
    }
    files[path] = data;
  }
  return files;
}
