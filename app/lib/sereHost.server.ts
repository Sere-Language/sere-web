import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { accessSync, createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { unzipSync } from "fflate";
import { getReleaseCatalog, recommendedRelease } from "./release";
import { isBinaryArtifact, shouldPersistPath } from "./sereInit";
import type { WorkspaceFile } from "./workspace";

const execFileAsync = promisify(execFile);

export type SereEnv = {
  compiler: string;
  compilerDir: string;
  llvmBin: string;
  stdlib: string;
  version: string;
};

export type HostBootResult = {
  env: SereEnv;
  fromGithub: boolean;
  message: string;
};

export type HostExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
  cwdDisplay: string;
  files: WorkspaceFile[];
};

const HOST_ROOT = path.join(process.cwd(), ".sere-host");
const sessions = new Map<string, { cwd: string }>();
let cachedEnv: SereEnv | null = null;

function windowsPosix(cwd: string): string {
  const normalized = cwd.replaceAll("\\", "/");
  const match = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (!match) {
    return normalized;
  }
  return `/${match[1].toLowerCase()}/${match[2]}`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isCompilerBinary(filePath: string): Promise<boolean> {
  const base = path.basename(filePath).toLowerCase();
  const parent = path.basename(path.dirname(filePath)).toLowerCase();
  if (parent !== "bin") {
    return false;
  }
  if (base !== "sere.exe" && base !== "sere") {
    return false;
  }
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function walkForSere(root: string, depth = 0): Promise<string | null> {
  if (depth > 8) {
    return null;
  }
  const preferred = process.platform === "win32" ? ["sere.exe", "sere"] : ["sere", "sere.exe"];
  for (const name of preferred) {
    const inBin = path.join(root, "bin", name);
    if (await isCompilerBinary(inBin)) {
      return inBin;
    }
  }
  let entries: string[] = [];
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }
  const skip = new Set(["include", "stdlib", "docs", "share", "lib", "lib64"]);
  entries.sort((left, right) => {
    if (left === "bin") {
      return -1;
    }
    if (right === "bin") {
      return 1;
    }
    return left.localeCompare(right);
  });
  for (const entry of entries) {
    if (skip.has(entry.toLowerCase())) {
      continue;
    }
    const full = path.join(root, entry);
    try {
      if ((await stat(full)).isDirectory()) {
        const found = await walkForSere(full, depth + 1);
        if (found) {
          return found;
        }
      }
    } catch {
      // Skip unreadable entries.
    }
  }
  return null;
}

async function printEnv(compiler: string): Promise<SereEnv> {
  try {
    const { stdout } = await execFileAsync(compiler, ["--print-env"], {
      windowsHide: true,
      timeout: 20_000,
    });
    const parsed = JSON.parse(stdout) as Partial<SereEnv>;
    const compilerPath = parsed.compiler ?? compiler;
    return {
      compiler: compilerPath,
      compilerDir: parsed.compilerDir ?? path.dirname(compilerPath),
      llvmBin: parsed.llvmBin ?? path.dirname(compilerPath),
      stdlib: parsed.stdlib ?? "",
      version: parsed.version ?? "dev",
    };
  } catch {
    const compilerDir = path.dirname(compiler);
    const home = path.basename(compilerDir).toLowerCase() === "bin" ? path.dirname(compilerDir) : compilerDir;
    return {
      compiler,
      compilerDir,
      llvmBin: compilerDir,
      stdlib: path.join(home, "stdlib"),
      version: "dev",
    };
  }
}

async function findLocalCompiler(): Promise<string | null> {
  const home = process.env.LOCALAPPDATA;
  const candidates = [
    process.env.SERE_COMPILER,
    home ? path.join(home, "Programs", "Sere", "bin", "sere.exe") : "",
    home ? path.join(home, "Programs", "Sere", "bin", "sere") : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      if ((await stat(candidate)).isFile()) {
        return candidate;
      }
    } catch {
      // Missing.
    }
  }

  try {
    const command = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(command, ["sere"], {
      windowsHide: true,
      timeout: 10_000,
    });
    const first = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (first) {
      try {
        if ((await stat(first)).isFile()) {
          return first;
        }
      } catch {
        // Missing.
      }
    }
  } catch {
    // Not on PATH.
  }

  return null;
}

function githubDownloadHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "sere-web",
    Accept: "application/octet-stream",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function downloadZip(url: string, dest: string): Promise<void> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: githubDownloadHeaders(),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Could not download toolchain (${response.status}).`);
  }
  await pipeline(
    Readable.fromWeb(response.body as never),
    createWriteStream(dest),
  );
}

async function extractZip(zipPath: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const bytes = await readFile(zipPath);
  const files = unzipSync(bytes);
  for (const [name, data] of Object.entries(files)) {
    const relative = name.replaceAll("\\", "/");
    if (!relative || relative.endsWith("/")) {
      continue;
    }
    const out = path.join(dest, ...relative.split("/"));
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, data);
  }
}

async function installZip(tag: string, url: string): Promise<SereEnv> {
  const dest = path.join(HOST_ROOT, "toolchains", tag);
  const ready = path.join(dest, ".ready");
  if (await exists(ready)) {
    const compiler = await walkForSere(dest);
    if (compiler) {
      return printEnv(compiler);
    }
    await rm(dest, { recursive: true, force: true });
  }

  await mkdir(HOST_ROOT, { recursive: true });
  const zipPath = path.join(HOST_ROOT, `${tag}.zip`);
  await downloadZip(url, zipPath);
  await rm(dest, { recursive: true, force: true });
  try {
    await extractZip(zipPath, dest);
  } finally {
    await rm(zipPath, { force: true });
  }
  const compiler = await walkForSere(dest);
  if (!compiler) {
    throw new Error("The GitHub zip did not contain bin/sere.exe.");
  }
  await writeFile(ready, `${tag}\n`, "utf8");
  return printEnv(compiler);
}

async function installFromGithub(): Promise<SereEnv> {
  const catalog = await getReleaseCatalog();
  const ordered = [
    recommendedRelease(catalog),
    ...(catalog.all ?? []),
  ].filter((release, index, list): release is NonNullable<typeof release> => {
    if (!release?.zip?.url) {
      return false;
    }
    return list.findIndex((item) => item?.tag === release.tag) === index;
  });
  if (ordered.length === 0) {
    throw new Error("No Windows toolchain zip was listed on GitHub.");
  }

  let lastError = "No Windows toolchain zip was listed on GitHub.";
  for (const release of ordered) {
    try {
      return await installZip(release.tag, release.zip!.url);
    } catch (caught) {
      lastError = caught instanceof Error ? caught.message : lastError;
    }
  }
  throw new Error(lastError);
}

export async function bootCompilerHost(): Promise<HostBootResult> {
  const local = await findLocalCompiler();
  if (local) {
    const env = await printEnv(local);
    cachedEnv = env;
    return {
      env,
      fromGithub: false,
      message: `Using installed Sere ${env.version} (${env.compiler})`,
    };
  }

  const env = await installFromGithub();
  cachedEnv = env;
  return {
    env,
    fromGithub: true,
    message: `Installed Sere ${env.version} from GitHub into .sere-host`,
  };
}

export async function requireHostEnv(): Promise<SereEnv> {
  if (cachedEnv) {
    return cachedEnv;
  }
  const boot = await bootCompilerHost();
  return boot.env;
}

export function workspaceRoot(projectId: string): string {
  const safe = projectId.replace(/[^A-Za-z0-9._-]+/g, "-");
  return path.join(HOST_ROOT, "workspaces", safe);
}

export function sessionCwd(projectId: string): string {
  const root = workspaceRoot(projectId);
  return sessions.get(projectId)?.cwd ?? root;
}

export function cwdDisplay(cwd: string, projectId: string): string {
  const root = workspaceRoot(projectId);
  const posixRoot = windowsPosix(root);
  const posixCwd = windowsPosix(cwd);
  if (posixCwd === posixRoot) {
    return "~";
  }
  if (posixCwd.startsWith(`${posixRoot}/`)) {
    return `~/${posixCwd.slice(posixRoot.length + 1)}`;
  }
  return posixCwd;
}

export async function syncWorkspace(
  projectId: string,
  files: WorkspaceFile[],
): Promise<string> {
  const root = workspaceRoot(projectId);
  await mkdir(root, { recursive: true });

  const keep = new Set(files.map((file) => path.normalize(path.join(root, file.path))));

  async function prune(folder: string): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await readdir(folder);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "venv" || entry === "bin" || entry === "dist" || entry === "build") {
        continue;
      }
      if (entry === ".host-ready" || entry.startsWith(".sere-emit.")) {
        continue;
      }
      const full = path.join(folder, entry);
      const info = await stat(full);
      if (info.isDirectory()) {
        await prune(full);
        continue;
      }
      if (!keep.has(path.normalize(full))) {
        await rm(full, { force: true });
      }
    }
  }

  await prune(root);

  for (const file of files) {
    if (isBinaryArtifact(file.path)) {
      continue;
    }
    const dest = path.join(root, file.path);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, file.content, "utf8");
  }

  if (!sessions.has(projectId)) {
    sessions.set(projectId, { cwd: root });
  }

  return root;
}

async function snapshotWorkspace(projectId: string): Promise<WorkspaceFile[]> {
  const root = workspaceRoot(projectId);
  const files: WorkspaceFile[] = [];

  async function walk(folder: string, rel: string): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await readdir(folder);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "venv") {
        continue;
      }
      if (!rel && (entry === ".host-ready" || entry.startsWith(".sere-emit."))) {
        continue;
      }
      const full = path.join(folder, entry);
      const posix = (rel ? `${rel}/${entry}` : entry).replaceAll("\\", "/");
      const info = await stat(full);
      if (info.isDirectory()) {
        await walk(full, posix);
        continue;
      }
      if (!shouldPersistPath(posix)) {
        continue;
      }
      if (isBinaryArtifact(posix) || info.size > 2_000_000) {
        files.push({ path: posix, content: "" });
        continue;
      }
      const buffer = await readFile(full);
      if (buffer.includes(0)) {
        files.push({ path: posix, content: "" });
        continue;
      }
      files.push({ path: posix, content: buffer.toString("utf8") });
    }
  }

  await walk(root, "");
  return files;
}

function resolveBash(): string | null {
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];
  for (const candidate of candidates) {
    if (fileExistsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function fileExistsSync(filePath: string): boolean {
  try {
    accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function hostEnv(env: SereEnv): NodeJS.ProcessEnv {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const current = process.env[pathKey] ?? process.env.PATH ?? "";
  const joined = [env.compilerDir, env.llvmBin, current].filter(Boolean).join(path.delimiter);
  return {
    ...process.env,
    [pathKey]: joined,
    PATH: joined,
    SERE_HOME: path.basename(env.compilerDir).toLowerCase() === "bin"
      ? path.dirname(env.compilerDir)
      : env.compilerDir,
    SERE_STDLIB: env.stdlib || path.join(
      path.basename(env.compilerDir).toLowerCase() === "bin"
        ? path.dirname(env.compilerDir)
        : env.compilerDir,
      "stdlib",
    ),
    SERE_ACTIVE: "1",
    TERM: "xterm-256color",
    FORCE_COLOR: "1",
    CLICOLOR_FORCE: "1",
  };
}

function runCommand(
  command: string,
  cwd: string,
  env: SereEnv,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const bash = resolveBash();
  const wrapped = bash
    ? `export LS_COLORS="${process.env.LS_COLORS ?? ""}"; ${command}`
    : command;

  return new Promise((resolve) => {
    const child = bash
      ? spawn(bash, ["-lc", wrapped], { cwd, env: hostEnv(env), windowsHide: true })
      : spawn("cmd.exe", ["/d", "/s", "/c", command], {
          cwd,
          env: hostEnv(env),
          windowsHide: true,
        });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ stdout, stderr: `${stderr}${error.message}\n`, exitCode: 1 });
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr: `${stderr}command timed out\n`, exitCode: 124 });
    }, 90_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

function resolveCd(projectId: string, target: string): string {
  const root = workspaceRoot(projectId);
  const current = sessionCwd(projectId);
  const next =
    !target || target === "~"
      ? root
      : path.resolve(current, target.replace(/^~\//, `${root}/`).replaceAll("/", path.sep));
  const relative = path.relative(root, next);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return current;
  }
  return next;
}

async function ensureProjectReady(projectId: string, env: SereEnv): Promise<void> {
  const root = workspaceRoot(projectId);
  const marker = path.join(root, ".host-ready");
  if (await exists(marker)) {
    return;
  }
  await runCommand("sere refresh-bin", root, env);
  await writeFile(marker, "ok\n", "utf8");
}

export async function execInWorkspace(input: {
  projectId: string;
  command: string;
  files: WorkspaceFile[];
}): Promise<HostExecResult> {
  const env = await requireHostEnv();
  await syncWorkspace(input.projectId, input.files);
  await ensureProjectReady(input.projectId, env);
  const trimmed = input.command.trim();
  if (!trimmed) {
    const cwd = sessionCwd(input.projectId);
    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
      cwd,
      cwdDisplay: cwdDisplay(cwd, input.projectId),
      files: await snapshotWorkspace(input.projectId),
    };
  }

  if (trimmed === "deactivate") {
    const cwd = sessionCwd(input.projectId);
    return {
      stdout: "Sere project is still available in this host; PATH stays active.\n",
      stderr: "",
      exitCode: 0,
      cwd,
      cwdDisplay: cwdDisplay(cwd, input.projectId),
      files: await snapshotWorkspace(input.projectId),
    };
  }

  const cdMatch = /^cd(?:\s+|$)(.*)$/.exec(trimmed);
  if (cdMatch) {
    const next = resolveCd(input.projectId, cdMatch[1]?.trim() ?? "");
    if (!(await exists(next))) {
      const cwd = sessionCwd(input.projectId);
      return {
        stdout: "",
        stderr: `bash: cd: ${cdMatch[1]}: No such file or directory\n`,
        exitCode: 1,
        cwd,
        cwdDisplay: cwdDisplay(cwd, input.projectId),
        files: await snapshotWorkspace(input.projectId),
      };
    }
    sessions.set(input.projectId, { cwd: next });
    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
      cwd: next,
      cwdDisplay: cwdDisplay(next, input.projectId),
      files: await snapshotWorkspace(input.projectId),
    };
  }

  const cwd = sessionCwd(input.projectId);
  const result = await runCommand(trimmed, cwd, env);
  return {
    ...result,
    cwd,
    cwdDisplay: cwdDisplay(cwd, input.projectId),
    files: await snapshotWorkspace(input.projectId),
  };
}

export async function emitArtifact(input: {
  projectId: string;
  files: WorkspaceFile[];
  mode: "llvm" | "asm";
  source: string;
}): Promise<{ text: string; log: string; exitCode: number; files: WorkspaceFile[] }> {
  const env = await requireHostEnv();
  await syncWorkspace(input.projectId, input.files);
  await ensureProjectReady(input.projectId, env);
  const root = workspaceRoot(input.projectId);
  const outRel = input.mode === "llvm" ? "build/out.ll" : "build/out.s";
  const outPath = path.join(root, outRel);
  await mkdir(path.dirname(outPath), { recursive: true });
  const flag = input.mode === "llvm" ? "--emit-llvm" : "--emit-asm";
  const source = input.source.replaceAll("\\", "/");
  // Relative -o so Git Bash does not eat Windows backslashes (\b in \build).
  const command = `sere ${flag} ${quote(source)} -o ${quote(outRel)} --color=never`;
  const result = await runCommand(command, root, env);
  let text = "";
  try {
    text = await readFile(outPath, "utf8");
  } catch {
    text = "";
  }
  return {
    text,
    log: `${result.stdout}${result.stderr}`,
    exitCode: result.exitCode,
    files: await snapshotWorkspace(input.projectId),
  };
}

function quote(value: string): string {
  if (!/[\s"]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '\\"')}"`;
}

export { HOST_ROOT };
