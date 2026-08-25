"use client";

import {
  createNano,
  Shell,
  type Nano,
} from "@userland-run/nano-sdk";
import {
  GUEST_ALL_PERMS,
  GUEST_ROOT,
  fromGuestPath,
  guestFileMode,
  persistableGuestFiles,
  toGuestPath,
} from "./nanoPaths";
import { unzipLinuxRelease, applySerePrefix, SERE_PREFIX, type SereInstallResult } from "./sereLinuxInstall";
import { isBinaryArtifact, shouldPersistPath } from "./sereInit";
import type { WorkspaceFile } from "./workspace";
import { DEFAULT_SHELL_ID } from "./workbenchLayout";

const WASM_URL = "/nano/nano.wasm";
const MODE_TYPE_MASK = 0o170000;

type MutableFsNode = {
  mode: number;
  children: Map<string, MutableFsNode> | null;
};

type MutableMemfs = {
  resolve: (path: string, follow?: boolean) => MutableFsNode | null;
  open: (path: string, flags: number, mode?: number) => number;
  mkdir: (path: string, mode?: number) => unknown;
  chmod: (path: string, mode: number) => unknown;
  createFile: (
    path: string,
    content: string | Uint8Array,
    mode?: number,
  ) => unknown;
  onMutate: ((path: string, kind: string) => void) | null;
};

function withAllPerms(mode: number | undefined): number {
  return (typeof mode === "number" ? mode : 0) | GUEST_ALL_PERMS;
}

function unlockGuestFs(nano: Nano): void {
  const memfs = nano.raw._memfs as unknown as MutableMemfs;
  const open = memfs.open.bind(memfs);
  memfs.open = (path, flags, mode) => open(path, flags, withAllPerms(mode));
  const mkdir = memfs.mkdir.bind(memfs);
  memfs.mkdir = (path, mode) => mkdir(path, withAllPerms(mode));
  const chmod = memfs.chmod.bind(memfs);
  memfs.chmod = (path) => chmod(path, GUEST_ALL_PERMS);
  const createFile = memfs.createFile.bind(memfs);
  memfs.createFile = (path, content, mode) =>
    createFile(path, content, withAllPerms(mode));
}

function grantTreePerms(nano: Nano, path: string): void {
  const node = (nano.raw._memfs as unknown as MutableMemfs).resolve(path);
  if (!node) {
    return;
  }
  const visit = (current: MutableFsNode): void => {
    current.mode = (current.mode & MODE_TYPE_MASK) | GUEST_ALL_PERMS;
    if (current.children) {
      for (const child of current.children.values()) {
        visit(child);
      }
    }
  };
  visit(node);
}

export type NanoRunResult = {
  output: string;
  cwd: string;
  exitCode: number;
};

export class NanoWorkspace {
  private readonly shells = new Map<string, Shell>();
  private fsListener: (() => void) | null = null;

  private constructor(private readonly nano: Nano) {}

  get cwd(): string {
    return this.shellCwd(DEFAULT_SHELL_ID);
  }

  static async boot(): Promise<NanoWorkspace> {
    const isolated =
      typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
    if (!isolated) {
      const { ensureCrossOriginIsolated } = await import("@userland-run/nano-sdk");
      const ready = await ensureCrossOriginIsolated({
        swUrl: "/nano-sw.js",
        reloadIfUncontrolled: true,
      });
      if (!ready) {
        throw new Error(
          "This page needs cross-origin isolation for NanoVM. Reload after the service worker installs, or keep the COOP/COEP headers on the project route.",
        );
      }
    }
    const nano = await createNano({
      image: { wasm: WASM_URL },
      ramMB: 256,
      warmup: true,
      crossOriginIsolation: isolated ? "assert" : "ignore",
    });
    unlockGuestFs(nano);
    nano.fs.writeFile(`${GUEST_ROOT}/.keep`, "", GUEST_ALL_PERMS);
    grantTreePerms(nano, GUEST_ROOT);
    const workspace = new NanoWorkspace(nano);
    workspace.attachFsWatch();
    workspace.createShell(DEFAULT_SHELL_ID);
    return workspace;
  }

  private attachFsWatch(): void {
    const memfs = this.nano.raw._memfs as unknown as MutableMemfs;
    const previous = memfs.onMutate;
    memfs.onMutate = (path, kind) => {
      previous?.(path, kind);
      if (path === GUEST_ROOT || path.startsWith(`${GUEST_ROOT}/`)) {
        this.fsListener?.();
      }
    };
  }

  watchProjectFiles(listener: (() => void) | null): void {
    this.fsListener = listener;
  }

  private shellEnv(): Record<string, string> {
    return {
      HOME: GUEST_ROOT,
      PWD: GUEST_ROOT,
      USER: "sere",
      TERM: "xterm-256color",
      PATH: `${SERE_PREFIX}/bin:/usr/bin:/bin`,
      SERE_HOME: SERE_PREFIX,
      SERE_STDLIB: `${SERE_PREFIX}/stdlib`,
    };
  }

  private applyToolchainEnv(shell: Shell): void {
    shell.env.PATH = `${SERE_PREFIX}/bin:${shell.env.PATH ?? "/usr/bin:/bin"}`;
    shell.env.SERE_HOME = SERE_PREFIX;
    shell.env.SERE_STDLIB = `${SERE_PREFIX}/stdlib`;
    shell.env.HOME = GUEST_ROOT;
    shell.env.PWD = shell.cwd;
  }

  private requireShell(id: string): Shell {
    const shell = this.shells.get(id);
    if (!shell) {
      throw new Error(`NanoVM shell ${id} is not open.`);
    }
    return shell;
  }

  createShell(id = crypto.randomUUID()): string {
    const shell = this.nano.shell({
      cwd: GUEST_ROOT,
      env: this.shellEnv(),
    });
    this.shells.set(id, shell);
    return id;
  }

  reloadShell(id: string): string {
    const previous = this.shells.get(id);
    if (previous) {
      previous.env = {};
    }
    const shell = this.nano.shell({
      cwd: GUEST_ROOT,
      env: this.shellEnv(),
    });
    this.shells.set(id, shell);
    return shell.cwd;
  }

  shellCwd(id: string): string {
    return this.shells.get(id)?.cwd ?? GUEST_ROOT;
  }

  /** Snapshot of persistable project files currently in the guest `/work` tree. */
  listProjectFiles(): WorkspaceFile[] {
    const files: WorkspaceFile[] = [];
    for (const guest of this.nano.fs.walk(GUEST_ROOT)) {
      const relative = fromGuestPath(guest);
      if (!relative || !shouldPersistPath(relative)) {
        continue;
      }
      const text = this.nano.fs.readText(guest);
      if (text === null) {
        if (isBinaryArtifact(relative)) {
          files.push({ path: relative, content: "" });
        }
        continue;
      }
      files.push({ path: relative, content: text });
    }

    const filePaths = new Set(files.map((file) => file.path));
    const visit = (guest: string): void => {
      const entries = this.nano.fs.list(guest) ?? [];
      for (const entry of entries) {
        const child = `${guest}/${entry.name}`;
        const relative = fromGuestPath(child);
        if (!relative || !shouldPersistPath(relative)) {
          continue;
        }
        if (entry.type !== "dir") {
          continue;
        }
        visit(child);
        const hasChild = [...filePaths].some(
          (path) => path === relative || path.startsWith(`${relative}/`),
        );
        if (!hasChild) {
          const keep = `${relative}/.keep`;
          files.push({ path: keep, content: "" });
          filePaths.add(keep);
        }
      }
    };
    visit(GUEST_ROOT);
    return files;
  }

  async syncAll(files: WorkspaceFile[]): Promise<void> {
    const persist = persistableGuestFiles(files);
    const keep = new Set(persist.map((file) => toGuestPath(file.path)));
    keep.add(GUEST_ROOT);
    keep.add(`${GUEST_ROOT}/.keep`);

    for (const existing of this.nano.fs.walk(GUEST_ROOT)) {
      if (!keep.has(existing) && existing !== GUEST_ROOT) {
        try {
          await this.nano.fs.remove(existing);
        } catch {
          // Directory removals can fail until children are gone.
        }
      }
    }

    for (const file of persist) {
      this.writeFile(file.path, file.content);
    }
    grantTreePerms(this.nano, GUEST_ROOT);
  }

  cancel(): void {
    this.nano.cancel();
  }

  async installSere(): Promise<SereInstallResult> {
    let expectedTag: string | null = null;
    try {
      const latest = await fetch("/api/sere/latest");
      if (latest.ok) {
        const payload = (await latest.json()) as { linuxTag?: string | null; tag?: string };
        expectedTag = payload.linuxTag ?? payload.tag ?? null;
      }
    } catch {
      expectedTag = null;
    }

    const cachedTag = this.nano.fs.readText(`${SERE_PREFIX}/.sere-release`)?.trim() ?? "";
    const hasBin = this.nano.fs.exists(`${SERE_PREFIX}/bin/sere`);
    if (expectedTag && cachedTag === expectedTag && hasBin) {
      for (const shell of this.shells.values()) {
        this.applyToolchainEnv(shell);
      }
      return {
        tag: expectedTag,
        prefix: SERE_PREFIX,
        hasCompiler: true,
        message: `Sere ${expectedTag} already at ${SERE_PREFIX} (cached for this VM).`,
      };
    }

    const response = await fetch("/api/sere/linux");
    if (!response.ok) {
      let detail = "No linux.zip on GitHub releases.";
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) {
          detail = payload.error;
        }
      } catch {
        // Keep the default message.
      }
      throw new Error(detail);
    }

    const tag = response.headers.get("X-Sere-Tag") ?? "dev";
    const bytes = new Uint8Array(await response.arrayBuffer());
    const files = unzipLinuxRelease(bytes);
    const result = applySerePrefix(this.nano, files, tag);
    for (const shell of this.shells.values()) {
      this.applyToolchainEnv(shell);
    }
    grantTreePerms(this.nano, SERE_PREFIX);
    grantTreePerms(this.nano, GUEST_ROOT);
    return result;
  }

  writeFile(relativePath: string, content: string): void {
    this.nano.fs.writeFile(
      toGuestPath(relativePath),
      content,
      guestFileMode(relativePath),
    );
  }

  readGuest(path: string): string | null {
    return this.nano.fs.readText(path);
  }

  async removeFile(relativePath: string): Promise<void> {
    const guest = toGuestPath(relativePath);
    if (this.nano.fs.exists(guest)) {
      await this.nano.fs.remove(guest);
    }
  }

  async run(
    line: string,
    onData?: (chunk: string) => void,
    shellId = DEFAULT_SHELL_ID,
  ): Promise<NanoRunResult> {
    const shell = this.requireShell(shellId);
    const trimmed = line.trim();
    if (!trimmed) {
      return { output: "", cwd: shell.cwd, exitCode: 0 };
    }
    grantTreePerms(this.nano, GUEST_ROOT);
    grantTreePerms(this.nano, shell.cwd);
    const result = await shell.run(trimmed, { onData });
    return {
      output: result.output,
      cwd: result.cwd,
      exitCode: result.exitCode,
    };
  }

  destroy(): void {
    this.fsListener = null;
    this.nano.destroy();
  }
}
