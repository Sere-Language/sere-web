import type { WorkspaceFile } from "./workspace";

export type HostBootPayload = {
  env: {
    compiler: string;
    compilerDir: string;
    llvmBin: string;
    stdlib: string;
    version: string;
  };
  fromGithub: boolean;
  message: string;
};

export type HostExecPayload = {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
  cwdDisplay: string;
  files: WorkspaceFile[];
};

export type HostEmitPayload = {
  text: string;
  log: string;
  exitCode: number;
  files: WorkspaceFile[];
};

async function hostPost<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/sere/host", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Compiler host request failed.");
  }
  return payload;
}

export function bootCompilerHost(): Promise<HostBootPayload> {
  return hostPost<HostBootPayload>({ op: "boot" });
}

export function execHostCommand(
  projectId: string,
  command: string,
  files: WorkspaceFile[],
): Promise<HostExecPayload> {
  return hostPost<HostExecPayload>({ op: "exec", projectId, command, files });
}

export function emitHostArtifact(
  projectId: string,
  mode: "llvm" | "asm",
  source: string,
  files: WorkspaceFile[],
): Promise<HostEmitPayload> {
  return hostPost<HostEmitPayload>({ op: "emit", projectId, mode, source, files });
}

export function combineStreams(result: Pick<HostExecPayload, "stdout" | "stderr">): string {
  return `${result.stdout}${result.stderr}`;
}
