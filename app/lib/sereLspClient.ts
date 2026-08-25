import { isProjectSereSource } from "./sereInit";
import type { WorkspaceFile } from "./workspace";

export type LspJson = Record<string, unknown>;

export type LspPosition = { line: number; character: number };
export type LspRange = { start: LspPosition; end: LspPosition };

export type LspCompletionItem = {
  label: string;
  kind?: number;
  detail?: string;
  insertText?: string;
  insertTextFormat?: number;
  filterText?: string;
  sortText?: string;
  documentation?: string | { value?: string };
};

export type LspLocation = { uri: string; range: LspRange };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export type SereLspInfo = {
  rootUri: string;
  stdlib: string;
  version: string;
  compiler: string;
};

export class SereLspClient {
  readonly projectId: string;
  info: SereLspInfo | null = null;
  onDiagnostics: (uri: string, diagnostics: LspJson[]) => void = () => undefined;
  onOpenPath: (path: string, selection?: LspRange) => void = () => undefined;

  private nextId = 1;
  private pending = new Map<number, Pending>();
  private versions = new Map<string, number>();
  private source: EventSource | null = null;
  private ready: Promise<void>;
  private resolveReady: () => void = () => undefined;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  async start(files: WorkspaceFile[]): Promise<void> {
    const response = await fetch("/api/sere/lsp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "open", projectId: this.projectId, files }),
    });
    const payload = (await response.json()) as SereLspInfo & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not start the Sere language server.");
    }
    this.info = payload;
    const stream = new EventSource(`/api/sere/lsp?projectId=${encodeURIComponent(this.projectId)}`);
    this.source = stream;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error("Language server stream timed out."));
      }, 15000);
      stream.addEventListener("ready", () => {
        window.clearTimeout(timer);
        resolve();
      });
      stream.addEventListener("rpc", (event) => {
        try {
          this.dispatch(JSON.parse((event as MessageEvent).data) as LspJson);
        } catch {
          // Ignore malformed events.
        }
      });
      stream.onerror = () => undefined;
    });

    await this.request("initialize", {
      processId: null,
      rootUri: payload.rootUri,
      rootPath: decodeURIComponent(payload.rootUri.replace(/^file:\/\//, "")),
      initializationOptions: {
        stdlib: payload.stdlib,
        compiler: payload.compiler,
        version: payload.version,
      },
      capabilities: {
        textDocument: {
          hover: { contentFormat: ["markdown"] },
          completion: {
            completionItem: { snippetSupport: true, documentationFormat: ["markdown"] },
          },
          publishDiagnostics: { relatedInformation: false },
          semanticTokens: { requests: { full: true, range: true } },
          inlayHint: {},
          signatureHelp: { contextSupport: true },
        },
        workspace: { workspaceFolders: true },
      },
      workspaceFolders: [{ uri: payload.rootUri, name: "project" }],
    });
    this.notify("initialized", {});
    this.resolveReady();
  }

  async waitUntilReady(): Promise<boolean> {
    try {
      await this.ready;
      return this.info !== null;
    } catch {
      return false;
    }
  }

  documentUri(relativePath: string): string {
    const root = this.info?.rootUri.replace(/\/+$/, "") ?? "";
    return `${root}/${relativePath.replaceAll("\\", "/")}`;
  }

  relativePath(uri: string): string | null {
    const root = this.info?.rootUri.replace(/\/+$/, "") ?? "";
    const normalized = decodeURIComponent(uri).replaceAll("\\", "/");
    const rootNorm = decodeURIComponent(root).replaceAll("\\", "/");
    if (normalized.toLowerCase().startsWith(`${rootNorm.toLowerCase()}/`)) {
      return normalized.slice(rootNorm.length + 1);
    }
    return null;
  }

  openDocument(relativePath: string, text: string): void {
    if (!isProjectSereSource(relativePath) || !this.info) {
      return;
    }
    const uri = this.documentUri(relativePath);
    if (this.versions.has(uri)) {
      this.changeDocument(relativePath, text, true);
      return;
    }
    const version = 1;
    this.versions.set(uri, version);
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "sere", version, text },
    });
  }

  changeDocument(relativePath: string, text: string, skipAnalyze = false): void {
    if (!isProjectSereSource(relativePath) || !this.info) {
      return;
    }
    const uri = this.documentUri(relativePath);
    if (!this.versions.has(uri)) {
      this.openDocument(relativePath, text);
      return;
    }
    const version = (this.versions.get(uri) ?? 1) + 1;
    this.versions.set(uri, version);
    this.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
      skipAnalyze,
    });
  }

  closeDocument(relativePath: string): void {
    const uri = this.documentUri(relativePath);
    this.versions.delete(uri);
    this.notify("textDocument/didClose", {
      textDocument: { uri },
    });
  }

  positionParams(relativePath: string, line: number, character: number, extra: LspJson = {}): LspJson {
    return {
      textDocument: { uri: this.documentUri(relativePath) },
      position: { line, character },
      ...extra,
    };
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      void this.post({ jsonrpc: "2.0", id, method, params }).catch((error: unknown) => {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error("LSP request failed."));
      });
    });
  }

  notify(method: string, params: unknown): void {
    void this.post({ jsonrpc: "2.0", method, params }).catch(() => undefined);
  }

  async stop(): Promise<void> {
    this.source?.close();
    this.source = null;
    try {
      await fetch("/api/sere/lsp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "close", projectId: this.projectId }),
      });
    } catch {
      // Best-effort shutdown.
    }
    for (const [, pending] of this.pending) {
      pending.reject(new Error("Language server stopped."));
    }
    this.pending.clear();
  }

  private async post(message: LspJson): Promise<void> {
    try {
      const response = await fetch("/api/sere/lsp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "rpc", projectId: this.projectId, message }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "LSP RPC failed.");
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error("LSP RPC failed.");
    }
  }

  private dispatch(message: LspJson): void {
    const id = message.id;
    if (typeof id === "number" && this.pending.has(id)) {
      const pending = this.pending.get(id);
      this.pending.delete(id);
      if (message.error && typeof message.error === "object") {
        const error = message.error as { message?: string };
        pending?.reject(new Error(error.message ?? "LSP error"));
        return;
      }
      pending?.resolve(message.result);
      return;
    }
    if (message.method === "textDocument/publishDiagnostics") {
      const params = (message.params ?? {}) as { uri?: string; diagnostics?: LspJson[] };
      if (params.uri) {
        this.onDiagnostics(params.uri, params.diagnostics ?? []);
      }
    }
  }
}
