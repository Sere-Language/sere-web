import type { Monaco } from "@monaco-editor/react";
import type { editor, IRange, languages, Position } from "monaco-editor";
import {
  SERE_LANGUAGE_ID,
  SERE_TOKEN_MODIFIERS,
  SERE_TOKEN_TYPES,
} from "./sereMonaco";
import {
  SereLspClient,
  type LspCompletionItem,
  type LspJson,
  type LspLocation,
  type LspRange,
} from "./sereLspClient";

let client: SereLspClient | null = null;
let monacoRef: Monaco | null = null;
let providersRegistered = false;
const analyzeTimers = new Map<string, number>();

export function getSereLsp(): SereLspClient | null {
  return client;
}

export function setSereLsp(next: SereLspClient | null): void {
  client = next;
  if (next && monacoRef) {
    next.onDiagnostics = (uri, diagnostics) => applyDiagnostics(monacoRef, uri, diagnostics);
  }
}

function modelPath(model: editor.ITextModel): string | null {
  const value = decodeURIComponent(model.uri.path).replaceAll("\\", "/").replace(/^\/+/, "");
  if (value.endsWith(".sere")) {
    return value;
  }
  return null;
}

function toRange(range: LspRange): IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

function completionKind(monaco: Monaco, kind?: number): languages.CompletionItemKind {
  if (typeof kind !== "number") {
    return monaco.languages.CompletionItemKind.Text;
  }
  const mapped = kind - 1;
  const values = monaco.languages.CompletionItemKind;
  return mapped >= 0 ? (mapped as languages.CompletionItemKind) : values.Text;
}

function replaceRangeAfterDot(
  monaco: Monaco,
  model: editor.ITextModel,
  position: Position,
): IRange {
  const line = model.getLineContent(position.lineNumber);
  const before = line.slice(0, position.column - 1);
  const dot = before.lastIndexOf(".");
  if (dot >= 0) {
    return new monaco.Range(position.lineNumber, dot + 2, position.lineNumber, position.column);
  }
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  };
}

function markdown(value: string): { value: string; isTrusted: boolean } {
  return { value, isTrusted: false };
}

function contentsToMarkdown(contents: unknown): string {
  if (typeof contents === "string") {
    return contents;
  }
  if (contents && typeof contents === "object" && "value" in contents) {
    return String((contents as { value?: string }).value ?? "");
  }
  if (Array.isArray(contents)) {
    return contents.map((item: unknown) => contentsToMarkdown(item)).join("\n\n");
  }
  return "";
}

function asLocations(result: unknown): LspLocation[] {
  if (!result) {
    return [];
  }
  const items = Array.isArray(result) ? result : [result];
  return items.filter((item): item is LspLocation => {
    return Boolean(item && typeof item === "object" && "uri" in item && "range" in item);
  });
}

function applyDiagnostics(monaco: Monaco | null, uri: string, diagnostics: LspJson[]): void {
  if (!monaco || !client) {
    return;
  }
  const relative = client.relativePath(uri);
  if (!relative) {
    return;
  }
  const model = monaco.editor.getModels().find((item: editor.ITextModel) => modelPath(item) === relative);
  if (!model) {
    return;
  }
  const markers: editor.IMarkerData[] = diagnostics.map((item: LspJson) => {
    const range = item.range as LspRange | undefined;
    const severity =
      item.severity === 2
        ? monaco.MarkerSeverity.Warning
        : item.severity === 3
          ? monaco.MarkerSeverity.Info
          : monaco.MarkerSeverity.Error;
    return {
      severity,
      message: String(item.message ?? ""),
      code: item.code ? String(item.code) : undefined,
      source: String(item.source ?? "sere"),
      startLineNumber: (range?.start.line ?? 0) + 1,
      startColumn: (range?.start.character ?? 0) + 1,
      endLineNumber: (range?.end.line ?? 0) + 1,
      endColumn: (range?.end.character ?? 0) + 1,
    };
  });
  monaco.editor.setModelMarkers(model, "sere", markers);
}

async function request(method: string, params: unknown): Promise<unknown> {
  if (!client) {
    return null;
  }
  await client.waitUntilReady();
  try {
    return await client.request(method, params);
  } catch {
    return null;
  }
}

function reveal(locations: LspLocation[]): void {
  const first = locations[0];
  if (!first || !client) {
    return;
  }
  const relative = client.relativePath(first.uri);
  if (relative) {
    client.onOpenPath(relative, first.range);
  }
}

export function registerSereLspProviders(monaco: Monaco): void {
  monacoRef = monaco;
  if (providersRegistered) {
    return;
  }
  providersRegistered = true;

  monaco.languages.registerCompletionItemProvider(SERE_LANGUAGE_ID, {
    triggerCharacters: [".", " ", '"', "@", "!"],
    provideCompletionItems: async (model: editor.ITextModel, position: Position) => {
      const path = modelPath(model);
      if (!path || !client) {
        return { suggestions: [] };
      }
      const line = model.getLineContent(position.lineNumber);
      client.changeDocument(path, model.getValue(), true);
      const result = await request("textDocument/completion", {
        ...client.positionParams(path, position.lineNumber - 1, position.column - 1, {
          sereLine: line,
          sereCharacter: position.column - 1,
        }),
        context: { triggerKind: 1 },
      });
      const items = (Array.isArray(result) ? result : []) as LspCompletionItem[];
      const range = replaceRangeAfterDot(monaco, model, position);
      return {
        suggestions: items.map((item) => {
          const snippet = item.insertTextFormat === 2;
          return {
            label: item.label,
            kind: completionKind(monaco, item.kind),
            detail: item.detail,
            insertText: item.insertText || item.label,
            insertTextRules: snippet
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            filterText: item.filterText || item.label,
            sortText: item.sortText || item.label,
            range,
          };
        }),
        incomplete: false,
      };
    },
  });

  monaco.languages.registerHoverProvider(SERE_LANGUAGE_ID, {
    provideHover: async (model: editor.ITextModel, position: Position) => {
      const path = modelPath(model);
      if (!path || !client) {
        return null;
      }
      const result = (await request(
        "textDocument/hover",
        client.positionParams(path, position.lineNumber - 1, position.column - 1, {
          sereLine: model.getLineContent(position.lineNumber),
          sereCharacter: position.column - 1,
        }),
      )) as { contents?: unknown; range?: LspRange } | null;
      const value = contentsToMarkdown(result?.contents);
      if (!value) {
        return null;
      }
      return {
        contents: [markdown(value)],
        range: result?.range ? toRange(result.range) : undefined,
      };
    },
  });

  monaco.languages.registerSignatureHelpProvider(SERE_LANGUAGE_ID, {
    signatureHelpTriggerCharacters: ["(", ",", "!"],
    signatureHelpRetriggerCharacters: [",", " "],
    provideSignatureHelp: async (model: editor.ITextModel, position: Position) => {
      const path = modelPath(model);
      if (!path || !client) {
        return null;
      }
      const result = (await request(
        "textDocument/signatureHelp",
        client.positionParams(path, position.lineNumber - 1, position.column - 1, {
          sereLine: model.getLineContent(position.lineNumber),
          sereCharacter: position.column - 1,
        }),
      )) as {
        signatures?: Array<{
          label?: string;
          documentation?: string;
          parameters?: Array<{ label?: string | [number, number]; documentation?: string }>;
        }>;
        activeSignature?: number;
        activeParameter?: number;
      } | null;
      if (!result?.signatures?.length) {
        return null;
      }
      return {
        dispose: () => undefined,
        value: {
          signatures: result.signatures.map((signature) => ({
            label: signature.label ?? "",
            documentation: signature.documentation
              ? markdown(String(signature.documentation))
              : undefined,
            parameters: (signature.parameters ?? []).map((parameter) => ({
              label: parameter.label ?? "",
              documentation: parameter.documentation,
            })),
          })),
          activeSignature: result.activeSignature ?? 0,
          activeParameter: result.activeParameter ?? 0,
        },
      };
    },
  });

  const locationProvider = (method: string): languages.DefinitionProvider => ({
    provideDefinition: async (model: editor.ITextModel, position: Position) => {
      const path = modelPath(model);
      if (!path || !client) {
        return [];
      }
      const locations = asLocations(
        await request(
          method,
          client.positionParams(path, position.lineNumber - 1, position.column - 1, {
            sereLine: model.getLineContent(position.lineNumber),
            sereCharacter: position.column - 1,
          }),
        ),
      );
      reveal(locations);
      return locations.map((location) => ({
        uri: monaco.Uri.parse(location.uri),
        range: toRange(location.range),
      }));
    },
  });

  monaco.languages.registerDefinitionProvider(SERE_LANGUAGE_ID, locationProvider("textDocument/definition"));
  monaco.languages.registerTypeDefinitionProvider(
    SERE_LANGUAGE_ID,
    locationProvider("textDocument/typeDefinition"),
  );
  monaco.languages.registerImplementationProvider(
    SERE_LANGUAGE_ID,
    locationProvider("textDocument/implementation"),
  );

  monaco.languages.registerReferenceProvider(SERE_LANGUAGE_ID, {
    provideReferences: async (model: editor.ITextModel, position: Position) => {
      const path = modelPath(model);
      if (!path || !client) {
        return [];
      }
      const locations = asLocations(
        await request("textDocument/references", {
          ...client.positionParams(path, position.lineNumber - 1, position.column - 1),
          context: { includeDeclaration: true },
        }),
      );
      return locations.map((location) => ({
        uri: monaco.Uri.parse(location.uri),
        range: toRange(location.range),
      }));
    },
  });

  monaco.languages.registerDocumentHighlightProvider(SERE_LANGUAGE_ID, {
    provideDocumentHighlights: async (model: editor.ITextModel, position: Position) => {
      const path = modelPath(model);
      if (!path || !client) {
        return [];
      }
      const result = (await request(
        "textDocument/documentHighlight",
        client.positionParams(path, position.lineNumber - 1, position.column - 1),
      )) as Array<{ range: LspRange; kind?: number }> | null;
      return (result ?? []).map((item) => ({
        range: toRange(item.range),
        kind: item.kind ?? monaco.languages.DocumentHighlightKind.Text,
      }));
    },
  });

  monaco.languages.registerRenameProvider(SERE_LANGUAGE_ID, {
    provideRenameEdits: async (model: editor.ITextModel, position: Position, newName: string) => {
      const path = modelPath(model);
      if (!path || !client) {
        return { edits: [] };
      }
      const result = (await request("textDocument/rename", {
        ...client.positionParams(path, position.lineNumber - 1, position.column - 1),
        newName,
      })) as { changes?: Record<string, Array<{ range: LspRange; newText: string }>> } | null;
      const edits: languages.IWorkspaceTextEdit[] = [];
      for (const [uri, changes] of Object.entries(result?.changes ?? {})) {
        for (const change of changes) {
          edits.push({
            resource: monaco.Uri.parse(uri),
            versionId: undefined,
            textEdit: { range: toRange(change.range), text: change.newText },
          });
        }
      }
      return { edits };
    },
  });

  monaco.languages.registerDocumentSymbolProvider(SERE_LANGUAGE_ID, {
    provideDocumentSymbols: async (model: editor.ITextModel) => {
      const path = modelPath(model);
      if (!path || !client) {
        return [];
      }
      const result = (await request("textDocument/documentSymbol", {
        textDocument: { uri: client.documentUri(path) },
      })) as Array<{
        name: string;
        detail?: string;
        kind: number;
        range: LspRange;
        selectionRange?: LspRange;
        children?: unknown[];
      }> | null;

      const mapSymbol = (
        item: {
          name: string;
          detail?: string;
          kind: number;
          range: LspRange;
          selectionRange?: LspRange;
          children?: unknown[];
        },
      ): languages.DocumentSymbol => ({
        name: item.name,
        detail: item.detail ?? "",
        kind: item.kind as languages.SymbolKind,
        range: toRange(item.range),
        selectionRange: toRange(item.selectionRange ?? item.range),
        tags: [],
        children: Array.isArray(item.children)
          ? item.children.map((child) => mapSymbol(child as typeof item))
          : [],
      });
      return (result ?? []).map((item) => mapSymbol(item));
    },
  });

  monaco.languages.registerDocumentFormattingEditProvider(SERE_LANGUAGE_ID, {
    provideDocumentFormattingEdits: async (model: editor.ITextModel) => {
      const path = modelPath(model);
      if (!path || !client) {
        return [];
      }
      const result = (await request("textDocument/formatting", {
        textDocument: { uri: client.documentUri(path) },
        options: { tabSize: 4, insertSpaces: true },
      })) as Array<{ range: LspRange; newText: string }> | null;
      return (result ?? []).map((item) => ({ range: toRange(item.range), text: item.newText }));
    },
  });

  monaco.languages.registerDocumentRangeFormattingEditProvider(SERE_LANGUAGE_ID, {
    provideDocumentRangeFormattingEdits: async (model: editor.ITextModel, range: IRange) => {
      const path = modelPath(model);
      if (!path || !client) {
        return [];
      }
      const result = (await request("textDocument/rangeFormatting", {
        textDocument: { uri: client.documentUri(path) },
        range: {
          start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
          end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
        },
        options: { tabSize: 4, insertSpaces: true },
      })) as Array<{ range: LspRange; newText: string }> | null;
      return (result ?? []).map((item) => ({ range: toRange(item.range), text: item.newText }));
    },
  });

  monaco.languages.registerFoldingRangeProvider(SERE_LANGUAGE_ID, {
    provideFoldingRanges: async (model: editor.ITextModel) => {
      const path = modelPath(model);
      if (!path || !client) {
        return [];
      }
      const result = (await request("textDocument/foldingRange", {
        textDocument: { uri: client.documentUri(path) },
      })) as Array<{ startLine: number; endLine: number }> | null;
      return (result ?? []).map((item) => ({
        start: item.startLine + 1,
        end: item.endLine + 1,
        kind: monaco.languages.FoldingRangeKind.Region,
      }));
    },
  });

  monaco.languages.registerCodeLensProvider(SERE_LANGUAGE_ID, {
    provideCodeLenses: async (model: editor.ITextModel) => {
      const path = modelPath(model);
      if (!path || !client) {
        return { lenses: [], dispose: () => undefined };
      }
      const result = (await request("textDocument/codeLens", {
        textDocument: { uri: client.documentUri(path) },
      })) as Array<{ range: LspRange; command?: { title?: string } }> | null;
      return {
        lenses: (result ?? []).map((item) => ({
          range: toRange(item.range),
          command: item.command?.title
            ? { id: "", title: item.command.title }
            : undefined,
        })),
        dispose: () => undefined,
      };
    },
  });

  monaco.languages.registerInlayHintsProvider(SERE_LANGUAGE_ID, {
    provideInlayHints: async (model: editor.ITextModel, range: IRange) => {
      const path = modelPath(model);
      if (!path || !client) {
        return { hints: [], dispose: () => undefined };
      }
      const result = (await request("textDocument/inlayHint", {
        textDocument: { uri: client.documentUri(path) },
        range: {
          start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
          end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
        },
      })) as Array<{
        position: { line: number; character: number };
        label: string;
        kind?: number;
        paddingLeft?: boolean;
        paddingRight?: boolean;
      }> | null;
      return {
        hints: (result ?? []).map((item) => ({
          label: item.label,
          position: { lineNumber: item.position.line + 1, column: item.position.character + 1 },
          kind:
            item.kind === 1
              ? monaco.languages.InlayHintKind.Type
              : monaco.languages.InlayHintKind.Parameter,
          paddingLeft: Boolean(item.paddingLeft),
          paddingRight: Boolean(item.paddingRight),
        })),
        dispose: () => undefined,
      };
    },
  });

  monaco.languages.registerCodeActionProvider(SERE_LANGUAGE_ID, {
    provideCodeActions: async (model: editor.ITextModel, range: IRange) => {
      const path = modelPath(model);
      if (!path || !client) {
        return { actions: [], dispose: () => undefined };
      }
      const result = (await request("textDocument/codeAction", {
        textDocument: { uri: client.documentUri(path) },
        range: {
          start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
          end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
        },
        context: { diagnostics: [] },
      })) as Array<{ title: string; kind?: string; isPreferred?: boolean }> | null;
      return {
        actions: (result ?? []).map((item) => ({
          title: item.title,
          kind: item.kind ?? "quickfix",
          isPreferred: Boolean(item.isPreferred),
        })),
        dispose: () => undefined,
      };
    },
  });

  monaco.languages.registerDocumentSemanticTokensProvider(SERE_LANGUAGE_ID, {
    getLegend: () => ({
      tokenTypes: [...SERE_TOKEN_TYPES],
      tokenModifiers: [...SERE_TOKEN_MODIFIERS],
    }),
    provideDocumentSemanticTokens: async (model: editor.ITextModel) => {
      const path = modelPath(model);
      if (!path || !client) {
        return null;
      }
      const result = (await request("textDocument/semanticTokens/full", {
        textDocument: { uri: client.documentUri(path) },
      })) as { data?: number[] } | null;
      const data = result?.data ?? [];
      if (data.length === 0) {
        return null;
      }
      return { data: Uint32Array.from(data), resultId: undefined };
    },
    releaseDocumentSemanticTokens: () => undefined,
  });
}

export function scheduleSereAnalyze(path: string, text: string): void {
  if (!client || !path.endsWith(".sere")) {
    return;
  }
  client.changeDocument(path, text, true);
  const previous = analyzeTimers.get(path);
  if (previous) {
    window.clearTimeout(previous);
  }
  analyzeTimers.set(
    path,
    window.setTimeout(() => {
      analyzeTimers.delete(path);
      client?.changeDocument(path, text, false);
    }, 250),
  );
}
