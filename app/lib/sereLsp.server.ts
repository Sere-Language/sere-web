import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { hostEnv, requireSereEnv, type SereToolchain } from "./sereRunner.server";

/**
 * Server-side bridge to `sere --lsp` used by the playground's autocomplete.
 *
 * The language server speaks JSON-RPC 2.0 over stdin/stdout (LSP framing with
 * `Content-Length` headers). This module keeps a single long-lived server
 * process per Node.js instance, syncs the playground's virtual document before
 * every completion request, and returns the completion list.
 *
 * Like `sereRunner.server.ts`, this must only be imported from the Node.js
 * runtime (API route handlers).
 */

const DOC_URI = "file:///playground/main.sere";

export type SereCompletionItem = {
  label: string;
  kind?: number;
  detail?: string;
  insertText?: string;
  filterText?: string;
  sortText?: string;
  insertTextFormat?: number;
  documentation?: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

function extractDocs(documentation: unknown): string | undefined {
  if (typeof documentation === "string") return documentation;
  if (
    documentation &&
    typeof documentation === "object" &&
    typeof (documentation as { value?: unknown }).value === "string"
  ) {
    return (documentation as { value: string }).value;
  }
  return undefined;
}

function extractHover(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const contents = (result as { contents?: unknown }).contents;
  const list = Array.isArray(contents) ? contents : [contents];
  const text = list
    .map((content) => {
      if (typeof content === "string") return content;
      if (
        content &&
        typeof content === "object" &&
        typeof (content as { value?: unknown }).value === "string"
      ) {
        return (content as { value: string }).value;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
  return text || null;
}

function normalizeItems(result: unknown): SereCompletionItem[] {
  const raw = Array.isArray(result)
    ? result
    : result && typeof result === "object"
      ? ((result as { items?: unknown }).items ?? [])
      : [];

  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && typeof (item as { label?: unknown }).label === "string",
    )
    .map((item) => ({
      label: String(item.label),
      kind: typeof item.kind === "number" ? item.kind : undefined,
      detail: typeof item.detail === "string" ? item.detail : undefined,
      insertText: typeof item.insertText === "string" ? item.insertText : undefined,
      filterText: typeof item.filterText === "string" ? item.filterText : undefined,
      sortText: typeof item.sortText === "string" ? item.sortText : undefined,
      insertTextFormat:
        typeof item.insertTextFormat === "number" ? item.insertTextFormat : undefined,
      documentation: extractDocs(item.documentation),
    }));
}

class SereLspClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private version = 0;
  private docOpen = false;
  private lastText = "";
  private ready: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  /** Serializes access so a single document/process stays consistent. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private ensureStarted(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = this.start().catch((error) => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  private async start(): Promise<void> {
    const { env } = await requireSereEnv();
    this.docOpen = false;
    this.version = 0;
    this.lastText = "";

    await this.spawnChild(env);
    try {
      await this.request("initialize", {
        processId: process.pid,
        rootUri: null,
        initializationOptions: {
          stdlib: env.stdlib,
          compiler: env.compiler,
          version: env.version,
          llvmDir: env.llvmDir,
        },
        capabilities: {
          textDocument: {
            hover: { contentFormat: ["markdown"] },
            completion: { completionItem: { snippetSupport: true } },
            publishDiagnostics: { relatedInformation: false },
          },
        },
      });
      this.notify("initialized", {});
    } catch (error) {
      // A failed initialize leaves a dead process; tear it down so the next
      // request can try again from a clean state.
      this.teardown();
      throw error;
    }
  }

  private spawnChild(env: SereToolchain): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const child = spawn(env.compiler, ["--lsp"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: hostEnv(env),
        windowsHide: true,
      });

      this.child = child;
      this.buffer = Buffer.alloc(0);

      child.stdout.on("data", (chunk: Buffer) => this.feed(chunk));
      child.stderr.on("data", (chunk: Buffer) => {
        if (process.env.NODE_ENV !== "production") {
          process.stderr.write(chunk);
        }
      });

      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });

      child.on("exit", (code) => {
        this.child = null;
        this.ready = null;
        this.docOpen = false;
        this.version = 0;
        this.lastText = "";
        this.failPending(new Error(`sere --lsp exited (${code ?? "unknown"})`));
      });

      // The process is alive and pipes are writable; requests queue behind
      // `initialize` in `start()`.
      resolve();
    });
  }

  private teardown(): void {
    this.failPending(new Error("sere --lsp was stopped"));
    const child = this.child;
    this.child = null;
    this.ready = null;
    this.docOpen = false;
    if (child && !child.killed) {
      try {
        child.kill();
      } catch {
        // Ignore.
      }
    }
  }

  private failPending(error: Error): void {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }

  private feed(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      this.buffer = this.buffer.subarray(bodyStart + length);
      try {
        this.dispatch(JSON.parse(body));
      } catch {
        // Ignore malformed frames.
      }
    }
  }

  private dispatch(message: {
    id?: number | string;
    method?: string;
    result?: unknown;
    error?: { message?: string };
  }): void {
    if (
      message &&
      (typeof message.id === "number" || typeof message.id === "string") &&
      this.pending.has(Number(message.id))
    ) {
      const id = Number(message.id);
      const { resolve, reject } = this.pending.get(id)!;
      this.pending.delete(id);
      if (message.error) {
        reject(new Error(message.error.message || "LSP request failed"));
      } else {
        resolve(message.result);
      }
      return;
    }
    // Notifications (e.g. publishDiagnostics) are intentionally ignored.
  }

  private send(payload: unknown): void {
    if (!this.child?.stdin.writable) return;
    const body = JSON.stringify(payload);
    this.child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  private request(method: string, params: unknown): Promise<unknown> {
    if (!this.child?.stdin.writable) {
      return Promise.reject(new Error("sere --lsp is not running"));
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(method: string, params: unknown): void {
    this.send({ jsonrpc: "2.0", method, params });
  }

  private sync(source: string, skipAnalyze: boolean): void {
    if (!this.docOpen) {
      this.docOpen = true;
      this.version = 1;
      this.lastText = source;
      this.notify("textDocument/didOpen", {
        textDocument: {
          uri: DOC_URI,
          languageId: "sere",
          version: this.version,
          text: source,
        },
      });
      return;
    }

    if (source === this.lastText) return;

    this.version += 1;
    this.lastText = source;
    this.notify("textDocument/didChange", {
      textDocument: { uri: DOC_URI, version: this.version },
      contentChanges: [{ text: source }],
      skipAnalyze,
    });
  }

  async complete(source: string, line: number, character: number): Promise<SereCompletionItem[]> {
    return this.enqueue(async () => {
      await this.ensureStarted();
      this.sync(source, true);

      const lineText = source.split(/\r?\n/)[line] ?? "";
      const result = await this.request("textDocument/completion", {
        textDocument: { uri: DOC_URI },
        position: { line, character },
        sereLine: lineText,
        sereCharacter: character,
      });

      return normalizeItems(result);
    });
  }

  /** Starts the language server without waiting; failures are swallowed. */
  async warm(): Promise<void> {
    try {
      await this.enqueue(() => this.ensureStarted());
    } catch {
      // Best-effort: the first real request retries if the warm-up failed.
    }
  }

  async hover(source: string, line: number, character: number): Promise<string | null> {
    return this.enqueue(async () => {
      await this.ensureStarted();
      // Full analysis (skipAnalyze=false) so hover reflects the latest text.
      this.sync(source, false);

      const lineText = source.split(/\r?\n/)[line] ?? "";
      const result = await this.request("textDocument/hover", {
        textDocument: { uri: DOC_URI },
        position: { line, character },
        sereLine: lineText,
        sereCharacter: character,
      });

      return extractHover(result);
    });
  }
}

let client: SereLspClient | null = null;

function getClient(): SereLspClient {
  if (!client) client = new SereLspClient();
  return client;
}

/** Asks the language server for completions at the given position. */
export async function completeLsp(
  source: string,
  line: number,
  character: number,
): Promise<SereCompletionItem[]> {
  return getClient().complete(source, line, character);
}

/** Starts the language server in the background so the first completion is fast. */
export function warmLsp(): Promise<void> {
  return getClient().warm();
}

/** Asks the language server for hover info at the given position. */
export async function hoverLsp(
  source: string,
  line: number,
  character: number,
): Promise<string | null> {
  return getClient().hover(source, line, character);
}
