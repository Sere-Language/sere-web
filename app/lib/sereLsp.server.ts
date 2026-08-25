import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import {
  hostEnv,
  requireHostEnv,
  syncWorkspace,
  workspaceRoot,
  type SereEnv,
} from "./sereHost.server";
import { persistableFiles } from "./sereInit";
import type { WorkspaceFile } from "./workspace";

export type LspJson = Record<string, unknown>;

type LspProcess = {
  child: ChildProcessWithoutNullStreams;
  env: SereEnv;
  rootUri: string;
  buffer: Buffer;
  listeners: Set<(message: LspJson) => void>;
};

const processes = new Map<string, LspProcess>();

export function toFileUri(absPath: string): string {
  const posix = path.resolve(absPath).replaceAll("\\", "/");
  const withSlash = posix.startsWith("/") ? posix : `/${posix}`;
  return `file://${withSlash}`;
}

function encodeFrame(payload: LspJson): Buffer {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  return Buffer.concat([header, body]);
}

function dispatch(session: LspProcess, message: LspJson): void {
  for (const listener of session.listeners) {
    listener(message);
  }
}

function feed(session: LspProcess, chunk: Buffer): void {
  session.buffer = Buffer.concat([session.buffer, chunk]);
  while (true) {
    const headerEnd = session.buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      return;
    }
    const header = session.buffer.subarray(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      session.buffer = session.buffer.subarray(headerEnd + 4);
      continue;
    }
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (session.buffer.length < bodyStart + length) {
      return;
    }
    const body = session.buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
    session.buffer = session.buffer.subarray(bodyStart + length);
    try {
      dispatch(session, JSON.parse(body) as LspJson);
    } catch {
      // Drop malformed frames.
    }
  }
}

export async function openLspSession(
  projectId: string,
  files: WorkspaceFile[],
): Promise<{ rootUri: string; stdlib: string; version: string; compiler: string }> {
  await closeLspSession(projectId);
  const env = await requireHostEnv();
  const root = await syncWorkspace(projectId, persistableFiles(files));
  const child = spawn(env.compiler, ["--lsp"], {
    cwd: root,
    env: hostEnv(env),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams;

  const session: LspProcess = {
    child,
    env,
    rootUri: toFileUri(root),
    buffer: Buffer.alloc(0),
    listeners: new Set(),
  };
  child.stdout.on("data", (chunk: Buffer) => feed(session, chunk));
  child.stderr.on("data", () => undefined);
  child.on("exit", () => {
    if (processes.get(projectId) === session) {
      processes.delete(projectId);
    }
  });
  processes.set(projectId, session);
  return {
    rootUri: session.rootUri,
    stdlib: env.stdlib,
    version: env.version,
    compiler: env.compiler,
  };
}

export function sendLspMessage(projectId: string, message: LspJson): void {
  const session = processes.get(projectId);
  if (!session) {
    throw new Error("Sere language server is not running.");
  }
  session.child.stdin.write(encodeFrame(message));
}

export function subscribeLsp(
  projectId: string,
  listener: (message: LspJson) => void,
): () => void {
  const session = processes.get(projectId);
  if (!session) {
    throw new Error("Sere language server is not running.");
  }
  session.listeners.add(listener);
  return () => {
    session.listeners.delete(listener);
  };
}

export function lspSessionInfo(
  projectId: string,
): { rootUri: string; stdlib: string; version: string; compiler: string } | null {
  const session = processes.get(projectId);
  if (!session) {
    return null;
  }
  return {
    rootUri: session.rootUri,
    stdlib: session.env.stdlib,
    version: session.env.version,
    compiler: session.env.compiler,
  };
}

export async function closeLspSession(projectId: string): Promise<void> {
  const session = processes.get(projectId);
  if (!session) {
    return;
  }
  processes.delete(projectId);
  try {
    session.child.stdin.write(encodeFrame({ jsonrpc: "2.0", method: "exit" }));
  } catch {
    // Process may already be gone.
  }
  session.child.kill();
}

export { workspaceRoot };
