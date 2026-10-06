import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
    access,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import {
    getReleaseCatalog,
    type ReleaseAsset,
    type SereRelease,
} from "./release";

/**
 * Server-side Sere runner used by the playground.
 *
 * `requireSereEnv()` auto-installs the *latest* GitHub release the first time
 * it is needed (the Windows portable zip on Windows, the Linux zip elsewhere)
 * and keeps the cache fresh: if a newer tag appears, it re-downloads.
 * A locally installed compiler is only used as a fallback.
 *
 * This module spawns native processes and must only ever be imported from the
 * Node.js runtime (API route handlers), never from client components.
 */

const execFileAsync = promisify(execFile);

export type SereToolchain = {
  compiler: string;
  compilerDir: string;
  llvmBin: string;
  llvmDir: string;
  stdlib: string;
  version: string;
  platform: string;
};

export type SereRunResult = {
  ok: boolean;
  buildExitCode: number | null;
  buildStdout: string;
  buildStderr: string;
  buildTimedOut: boolean;
  runExitCode: number | null;
  runStdout: string;
  runStderr: string;
  runTimedOut: boolean;
  buildDurationMs: number;
  runDurationMs: number;
  version: string;
  source: "local" | "github";
  releaseTag: string | null;
};

type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

const HOST_ROOT = path.join(os.tmpdir(), ".sere-host");
const COMPILE_TIMEOUT_MS = 180_000;
const RUN_TIMEOUT_MS = 30_000;
const CATALOG_TTL_MS = 5 * 60_000;

let cachedEnv: {
  env: SereToolchain;
  tag: string | null;
  source: "local" | "github";
} | null = null;

let catalogCheck: { at: number; release: SereRelease; asset: ReleaseAsset } | null =
  null;

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Picks the download asset for the current platform from a release:
 * the portable zip on Windows, the Linux zip everywhere else.
 */
function pickAsset(release: SereRelease): ReleaseAsset | null {
  if (process.platform === "win32") return release.zip;
  return release.linuxZip;
}

async function latestToolchain(): Promise<{
  release: SereRelease;
  asset: ReleaseAsset;
} | null> {
  const now = Date.now();
  if (catalogCheck && now - catalogCheck.at < CATALOG_TTL_MS) {
    return catalogCheck;
  }

  const catalog = await getReleaseCatalog();
  for (const release of catalog.all) {
    const asset = pickAsset(release);
    if (asset) {
      catalogCheck = { at: now, release, asset };
      return catalogCheck;
    }
  }

  catalogCheck = null;
  return null;
}

async function walkForSere(root: string, depth = 0): Promise<string | null> {
  if (depth > 6) return null;

  for (const name of ["sere.exe", "sere"]) {
    for (const candidate of [path.join(root, name), path.join(root, "bin", name)]) {
      if (await exists(candidate)) return candidate;
    }
  }

  let entries: string[] = [];
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const full = path.join(root, entry);
    try {
      const info = await stat(full);
      if (info.isDirectory()) {
        const found = await walkForSere(full, depth + 1);
        if (found) return found;
      }
    } catch {
      // Skip unreadable entries.
    }
  }

  return null;
}

async function printEnv(compiler: string): Promise<SereToolchain> {
  const fallback = path.dirname(compiler);
  try {
    const { stdout } = await execFileAsync(compiler, ["--print-env"], {
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as Partial<SereToolchain>;
    return {
      compiler: parsed.compiler ?? compiler,
      compilerDir: parsed.compilerDir ?? fallback,
      llvmBin: parsed.llvmBin ?? fallback,
      llvmDir: parsed.llvmDir ?? fallback,
      stdlib: parsed.stdlib ?? "",
      version: parsed.version ?? "unknown",
      platform: parsed.platform ?? process.platform,
    };
  } catch {
    return {
      compiler,
      compilerDir: fallback,
      llvmBin: fallback,
      llvmDir: fallback,
      stdlib: "",
      version: "unknown",
      platform: process.platform,
    };
  }
}

async function findLocalCompiler(): Promise<string | null> {
  const home = process.env.LOCALAPPDATA;
  const candidates = [
    process.env.SERE_COMPILER,
    home ? path.join(home, "Programs", "Sere", "bin", "sere.exe") : "",
    home ? path.join(home, "Programs", "Sere", "bin", "sere") : "",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }

  try {
    const command = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(command, ["sere"], {
      windowsHide: true,
      timeout: 10_000,
    });
    const first = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (first && (await exists(first))) return first;
  } catch {
    // Not on PATH.
  }

  return null;
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Could not download the Sere toolchain (HTTP ${response.status}).`);
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(dest));
}

async function extractArchive(archivePath: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  await execFileAsync("tar", ["-xf", archivePath, "-C", dest], {
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 1024 * 1024,
  });
}

async function installFromGithub(
  release: SereRelease,
  asset: ReleaseAsset,
): Promise<SereToolchain> {
  const dest = path.join(HOST_ROOT, "toolchains", `${release.tag}-${process.platform}`);
  const ready = path.join(dest, ".ready");

  if (await exists(ready)) {
    const compiler = await walkForSere(dest);
    if (compiler) return printEnv(compiler);
  }

  await mkdir(HOST_ROOT, { recursive: true });
  const archivePath = path.join(HOST_ROOT, `${release.tag}-${process.platform}.zip`);
  await downloadFile(asset.url, archivePath);

  await rm(dest, { recursive: true, force: true });
  await extractArchive(archivePath, dest);
  await rm(archivePath, { force: true });

  const compiler = await walkForSere(dest);
  if (!compiler) {
    await rm(dest, { recursive: true, force: true });
    throw new Error("The downloaded release did not contain a sere binary.");
  }

  const env = await printEnv(compiler);
  await writeFile(ready, `${release.tag}\n`, "utf8");
  return env;
}

export type SereEnv = {
  env: SereToolchain;
  source: "local" | "github";
  releaseTag: string | null;
};

let envPromise: Promise<SereEnv> | null = null;
let lastWarmAttemptAt = 0;
const WARM_RETRY_INTERVAL_MS = 10_000;

/**
 * Returns a ready-to-use toolchain, auto-installing the latest release when
 * the cached copy is missing or stale. Concurrent callers share one install.
 * Throws only when nothing is available (and resets so the next call retries).
 */
export function requireSereEnv(): Promise<SereEnv> {
  if (!envPromise) {
    envPromise = computeSereEnv().catch((error) => {
      envPromise = null;
      throw error;
    });
  }
  return envPromise;
}

async function computeSereEnv(): Promise<SereEnv> {
  const latest = await latestToolchain();

  if (latest) {
    const tag = latest.release.tag;
    if (cachedEnv?.source === "github" && cachedEnv.tag === tag) {
      return { env: cachedEnv.env, source: "github", releaseTag: tag };
    }

    try {
      const env = await installFromGithub(latest.release, latest.asset);
      cachedEnv = { env, tag, source: "github" };
      return { env, source: "github", releaseTag: tag };
    } catch (error) {
      // GitHub install failed (network, no asset for platform, …). Fall
      // through to a local compiler before giving up.
      console.error("[sere-runner] GitHub toolchain install failed:", error);
    }
  }

  if (cachedEnv) {
    return {
      env: cachedEnv.env,
      source: cachedEnv.source,
      releaseTag: cachedEnv.tag,
    };
  }

  const local = await findLocalCompiler();
  if (local) {
    const env = await printEnv(local);
    cachedEnv = { env, tag: null, source: "local" };
    return { env, source: "local", releaseTag: null };
  }

  throw new Error(
    "Sere is not installed and the latest release could not be downloaded.",
  );
}

/**
 * Starts (or joins) the toolchain install without waiting for it to finish.
 * Used by the playground status endpoint to warm the compiler in the
 * background while the page shows a loading screen.
 */
export function warmSereEnv(): Promise<void> {
  if (envPromise) {
    return envPromise.then(
      () => undefined,
      () => undefined,
    );
  }

  // Don't hammer GitHub while the network is down: wait a bit between
  // attempts so a fast failure (catalog fetch, bad asset) is not retried
  // on every poll tick.
  const now = Date.now();
  if (now - lastWarmAttemptAt < WARM_RETRY_INTERVAL_MS) {
    return Promise.resolve();
  }
  lastWarmAttemptAt = now;

  return requireSereEnv().then(
    () => undefined,
    () => undefined,
  );
}

/** Synchronous readiness snapshot for the playground status endpoint. */
export function sereEnvSnapshot(): {
  ready: boolean;
  installing: boolean;
  version: string | null;
  source: "local" | "github" | null;
  releaseTag: string | null;
} {
  if (cachedEnv) {
    return {
      ready: true,
      installing: false,
      version: cachedEnv.env.version,
      source: cachedEnv.source,
      releaseTag: cachedEnv.tag,
    };
  }
  return {
    ready: false,
    installing: envPromise !== null,
    version: null,
    source: null,
    releaseTag: null,
  };
}

export function hostEnv(env: SereToolchain): NodeJS.ProcessEnv {
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const current = process.env[pathKey] ?? process.env.PATH ?? "";
  const joined = [env.compilerDir, env.llvmBin, current]
    .filter(Boolean)
    .join(path.delimiter);
  return {
    ...process.env,
    [pathKey]: joined,
    PATH: joined,
    SERE_HOME: env.compilerDir,
    SERE_STDLIB: env.stdlib,
    SERE_ACTIVE: "1",
  };
}

function runProcess(
  file: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  stdin?: string,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ stdout, stderr: `${stderr}${error.message}\n`, exitCode: 1, timedOut: false });
    });

    // Close stdin so programs that read to EOF do not hang. Feed the
    // optional input first when the caller supplied one.
    child.stdin?.on("error", () => {
      // Ignore EPIPE if the program exits before consuming all of stdin.
    });
    child.stdin?.end(stdin ?? "");

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, timedOut });
    });
  });
}

function exeName(): string {
  return process.platform === "win32" ? "main.exe" : "main";
}

/**
 * Compiles a snippet with `sere <file> -o <out>` and runs the produced binary.
 *
 * Compiles at `-O0` for the fastest turnaround — the middle-end optimization
 * passes dominate compile time for a short snippet and do not change output.
 */
export async function runSere(source: string, stdin?: string): Promise<SereRunResult> {
  const { env, source: toolchainSource, releaseTag } = await requireSereEnv();

  const workDir = await mkdtemp(path.join(os.tmpdir(), "sere-playground-"));
  const srcPath = path.join(workDir, "main.sere");
  const outPath = path.join(workDir, exeName());

  try {
    await writeFile(srcPath, source, "utf8");

    const envForRun = hostEnv(env);

    const buildStart = Date.now();
    const build = await runProcess(
      env.compiler,
      [srcPath, "-o", outPath, "--no-color", "-O0"],
      workDir,
      envForRun,
      COMPILE_TIMEOUT_MS,
    );
    const buildDurationMs = Date.now() - buildStart;

    if (build.exitCode !== 0) {
      return {
        ok: false,
        buildExitCode: build.exitCode,
        buildStdout: build.stdout,
        buildStderr: build.stderr,
        buildTimedOut: build.timedOut,
        runExitCode: null,
        runStdout: "",
        runStderr: "",
        runTimedOut: false,
        buildDurationMs,
        runDurationMs: 0,
        version: env.version,
        source: toolchainSource,
        releaseTag,
      };
    }

    const runStart = Date.now();
    const run = await runProcess(outPath, [], workDir, envForRun, RUN_TIMEOUT_MS, stdin ?? "");
    const runDurationMs = Date.now() - runStart;

    return {
      ok: run.exitCode === 0 && !run.timedOut,
      buildExitCode: build.exitCode,
      buildStdout: build.stdout,
      buildStderr: build.stderr,
      buildTimedOut: build.timedOut,
      runExitCode: run.exitCode,
      runStdout: run.stdout,
      runStderr: run.stderr,
      runTimedOut: run.timedOut,
      buildDurationMs,
      runDurationMs,
      version: env.version,
      source: toolchainSource,
      releaseTag,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export type SereEmitMode = "serem" | "llvm" | "asm";

export type SereEmitResult = {
  ok: boolean;
  output: string;
  stderr: string;
  durationMs: number;
  version: string;
};

const EMIT_FLAGS: Record<SereEmitMode, string> = {
  serem: "--emit-serem",
  llvm: "--emit-llvm",
  asm: "--emit-asm",
};

const EMIT_EXTENSIONS: Record<SereEmitMode, string> = {
  serem: ".serem",
  llvm: ".ll",
  asm: ".s",
};

/**
 * Emits one of Sere's intermediate representations for a snippet without
 * linking an executable: `--emit-serem`, `--emit-llvm`, or `--emit-asm`,
 * each at the requested optimization level.
 */
export async function emitSere(
  source: string,
  mode: SereEmitMode,
  optLevel: "0" | "1" | "2" | "3",
): Promise<SereEmitResult> {
  const { env } = await requireSereEnv();

  const workDir = await mkdtemp(path.join(os.tmpdir(), "sere-emit-"));
  const srcPath = path.join(workDir, "main.sere");
  const outPath = path.join(workDir, `main${EMIT_EXTENSIONS[mode]}`);

  try {
    await writeFile(srcPath, source, "utf8");

    const start = Date.now();
    const result = await runProcess(
      env.compiler,
      [srcPath, `-O${optLevel}`, EMIT_FLAGS[mode], "-o", outPath, "--no-color"],
      workDir,
      hostEnv(env),
      COMPILE_TIMEOUT_MS,
    );
    const durationMs = Date.now() - start;

    let output = "";
    if (result.exitCode === 0) {
      try {
        output = await readFile(outPath, "utf8");
      } catch {
        // Fall back to stdout for emit modes that print instead of writing.
      }
    }
    if (!output && result.exitCode === 0) {
      output = result.stdout;
    }

    return {
      ok: result.exitCode === 0 && !result.timedOut,
      output,
      stderr: result.stderr,
      durationMs,
      version: env.version,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
