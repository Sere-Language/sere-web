"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type KeyboardEvent
} from "react";
import Button from "../components/Button";
import { highlightSere } from "../utils/highlight";

/** Mirrors the JSON shape returned by `/api/playground/run`. */
export type PlaygroundResult = {
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

/** A completion item as returned by `/api/playground/complete`. */
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

type CompletionState = {
  items: SereCompletionItem[];
  index: number;
  replaceStart: number;
  replaceEnd: number;
  top: number;
  left: number;
};

type RunEntry =
  | { id: number; state: "running"; at: Date }
  | ({ id: number; state: "done"; at: Date } & PlaygroundResult)
  | { id: number; state: "failed"; at: Date; error: string };

const DEFAULT_SOURCE = `def fib(n: i32) -> i32:
    if n < 2:
        return n
    a = 0
    b = 1
    i = 2
    while i <= n:
        a, b = b, a + b
        i += 1
    return b

def main() -> i32:
    print("Sere playground")
    for i in range(12):
        print(f"fib({i}) = {fib(i)}")
    return 0
`;

let nextRunId = 1;

/** Opening bracket/quote -> its matching closer. */
const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};

const CLOSING = new Set([")", "]", "}", '"', "'", "`"]);
const TRIGGERS = new Set([".", "@", "!"]);

const CHAR_WIDTH_FALLBACK = 8.4;
const LINE_HEIGHT = 24;
const PAD_LEFT = 16;
const PAD_TOP = 14;
const ESTIMATED_ROW_HEIGHT = 26;
const MAX_VISIBLE_ROWS = 8;
const IDENT_RE = /[A-Za-z0-9_]*$/;

type ActiveTab = "run" | "ir";
type EmitMode = "serem" | "llvm" | "asm";
type OptLevel = "0" | "1" | "2" | "3";

type EmitResult = {
  ok: boolean;
  output: string;
  stderr: string;
  durationMs: number;
  version: string;
};

type HoverState = {
  text: string;
  top: number;
  left: number;
};

const OPT_LEVELS: OptLevel[] = ["0", "1", "2", "3"];

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** UTF-16 line/character position of an absolute character offset. */
function cursorPosition(text: string, index: number): { line: number; character: number } {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return {
    line: lines.length - 1,
    character: (lines[lines.length - 1] ?? "").replace(/\r$/, "").length,
  };
}

/** Absolute character offset of a line/character position. */
function positionToOffset(text: string, line: number, character: number): number {
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i += 1) {
    offset += lines[i].length + 1;
  }
  const target = lines[Math.min(line, lines.length - 1)] ?? "";
  return Math.min(text.length, offset + Math.min(character, target.length));
}

/** Minimal LSP snippet expansion: `${1:fallback}` -> fallback, `${n}`/$n -> "". */
function expandSnippet(text: string): string {
  return text
    .replace(/\$\{([0-9]+):([^}]*)\}/g, (_match, _index, fallback: string) => fallback)
    .replace(/\$\{[0-9]+\}/g, "")
    .replace(/\$[0-9]+/g, "");
}

function completionKindIcon(kind?: number): string {
  switch (kind) {
    case 2: // Method
    case 3: // Function
    case 4: // Constructor
      return "ƒ";
    case 5: // Field
      return "f";
    case 6: // Variable
    case 12: // Value
      return "v";
    case 7: // Class
    case 8: // Interface
      return "c";
    case 9: // Module
      return "m";
    case 10: // Property
      return "p";
    case 13: // Enum
    case 20: // EnumMember
      return "e";
    case 14: // Keyword
      return "k";
    case 15: // Snippet
      return "»";
    case 21: // Constant
      return "c";
    case 22: // Struct
      return "s";
    case 25: // TypeParameter
      return "t";
    default:
      return "·";
  }
}

export default function Playground() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [stdin, setStdin] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("run");
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [charWidth, setCharWidth] = useState(CHAR_WIDTH_FALLBACK);

  // IR viewer state
  const [irMode, setIrMode] = useState<EmitMode>("llvm");
  const [irOpt, setIrOpt] = useState<OptLevel>("0");
  const [irResult, setIrResult] = useState<EmitResult | null>(null);
  const [irLoading, setIrLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterInnerRef = useRef<HTMLDivElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const completionSeqRef = useRef(0);
  const debounceRef = useRef<number | undefined>(undefined);
  const hoverDebounceRef = useRef<number | undefined>(undefined);
  const hoverSeqRef = useRef(0);
  const irSeqRef = useRef(0);

  const requestEmit = useCallback(
    async (text: string, mode: EmitMode, opt: OptLevel) => {
      const seq = ++irSeqRef.current;
      setIrLoading(true);
      try {
        const response = await fetch("/api/playground/emit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: text, emit: mode, opt }),
        });
        const payload = (await response.json()) as EmitResult & { error?: string };
        if (seq !== irSeqRef.current) return;
        if (response.ok && typeof payload.output === "string") {
          setIrResult(payload);
        } else {
          setIrResult({
            ok: false,
            output: "",
            stderr: typeof payload.error === "string" ? payload.error : "Emit failed.",
            durationMs: 0,
            version: "",
          });
        }
      } catch (error) {
        if (seq !== irSeqRef.current) return;
        setIrResult({
          ok: false,
          output: "",
          stderr: error instanceof Error ? error.message : "Emit failed.",
          durationMs: 0,
          version: "",
        });
      } finally {
        if (seq === irSeqRef.current) setIrLoading(false);
      }
    },
    [],
  );

  // Live IR: re-emit whenever the source, mode, or opt level changes while
  // the IR tab is active.
  useEffect(() => {
    if (activeTab !== "ir") return;
    const timer = window.setTimeout(() => {
      void requestEmit(source, irMode, irOpt);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [source, irMode, irOpt, activeTab, requestEmit]);

  const lineCount = useMemo(() => source.split("\n").length, [source]);

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { scrollTop, scrollLeft } = textarea;
    if (highlightRef.current) {
      highlightRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    }
    if (gutterInnerRef.current) {
      gutterInnerRef.current.style.transform = `translateY(${-scrollTop}px)`;
    }
  }, []);

  useEffect(() => {
    syncScroll();
  }, [source, syncScroll]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    const width = ctx.measureText("M").width;
    if (width > 0) setCharWidth(width);
  }, []);

  useEffect(() => {
    const body = terminalBodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [runs]);

  useEffect(() => {
    if (!completion) return;
    const active = codeRef.current?.querySelector<HTMLElement>(
      '.play-completion[data-active="true"]',
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [completion]);

  const latestToolchain = useMemo(() => {
    for (let i = runs.length - 1; i >= 0; i -= 1) {
      const run = runs[i];
      if (run.state === "done") {
        return { version: run.version, source: run.source, releaseTag: run.releaseTag };
      }
    }
    return null;
  }, [runs]);

  async function requestCompletion(text: string, caret: number) {
    const { line, character } = cursorPosition(text, caret);
    const before = text.slice(0, caret);
    const prefix = IDENT_RE.exec(before)?.[0] ?? "";
    const replaceStart = caret - prefix.length;

    const seq = ++completionSeqRef.current;

    try {
      const response = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: text, line, character }),
      });

      const payload = (await response.json()) as {
        items?: SereCompletionItem[];
        error?: string;
      };

      if (seq !== completionSeqRef.current) return;

      const items = Array.isArray(payload.items) ? payload.items : [];
      if (items.length === 0) {
        setCompletion(null);
        return;
      }

      const textarea = textareaRef.current;
      const containerHeight = codeRef.current?.clientHeight ?? 400;
      const scrollTop = textarea?.scrollTop ?? 0;
      const scrollLeft = textarea?.scrollLeft ?? 0;

      const caretLineTop = PAD_TOP + line * LINE_HEIGHT - scrollTop;
      const belowTop = caretLineTop + LINE_HEIGHT;
      const estimatedHeight =
        Math.min(items.length, MAX_VISIBLE_ROWS) * ESTIMATED_ROW_HEIGHT + 12;
      const fitsBelow = belowTop + estimatedHeight <= containerHeight;
      const top = fitsBelow ? belowTop : Math.max(0, caretLineTop - estimatedHeight);

      setCompletion({
        items,
        index: 0,
        replaceStart,
        replaceEnd: caret,
        top,
        left: PAD_LEFT + character * charWidth - scrollLeft,
      });
    } catch {
      if (seq === completionSeqRef.current) setCompletion(null);
    }
  }

  function acceptCompletion(index?: number) {
    const state = completion;
    if (!state) return;
    const item = state.items[index ?? state.index];
    if (!item) return;

    const raw = item.insertText ?? item.label;
    const text = item.insertTextFormat === 2 ? expandSnippet(raw) : raw;
    const next = source.slice(0, state.replaceStart) + text + source.slice(state.replaceEnd);
    const caret = state.replaceStart + text.length;

    completionSeqRef.current += 1;
    setSource(next);
    setCompletion(null);

    const textarea = textareaRef.current;
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.selectionStart = textarea.selectionEnd = caret;
        textarea.focus();
      }
    });
  }

  async function requestHover(text: string, line: number, character: number): Promise<string | null> {
    const seq = ++hoverSeqRef.current;
    try {
      const response = await fetch("/api/playground/hover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: text, line, character }),
      });
      const payload = (await response.json()) as { text?: unknown };
      if (seq !== hoverSeqRef.current) return null;
      return typeof payload.text === "string" ? payload.text : null;
    } catch {
      return null;
    }
  }

  function handleEditorMouseMove(event: { clientX: number; clientY: number }) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const rect = textarea.getBoundingClientRect();
    const x = event.clientX - rect.left + textarea.scrollLeft - PAD_LEFT;
    const y = event.clientY - rect.top + textarea.scrollTop - PAD_TOP;
    const character = Math.max(0, Math.round(x / charWidth));
    const line = Math.max(0, Math.round(y / LINE_HEIGHT));
    const offset = positionToOffset(source, line, character);
    const pos = cursorPosition(source, offset);

    window.clearTimeout(hoverDebounceRef.current);
    hoverDebounceRef.current = window.setTimeout(async () => {
      const text = await requestHover(source, pos.line, pos.character);
      if (!text) {
        setHover(null);
        return;
      }
      const ta = textareaRef.current;
      setHover({
        text,
        top: PAD_TOP + pos.line * LINE_HEIGHT - (ta?.scrollTop ?? 0) + LINE_HEIGHT,
        left: PAD_LEFT + pos.character * charWidth - (ta?.scrollLeft ?? 0),
      });
    }, 300);
  }

  function handleEditorMouseLeave() {
    window.clearTimeout(hoverDebounceRef.current);
    setHover(null);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    const caret = event.target.selectionStart;
    setSource(value);
    setHover(null);

    const before = value.slice(0, caret);
    const ident = /[A-Za-z0-9_]+$/.exec(before)?.[0];

    if (ident && ident.length >= 1) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        void requestCompletion(value, caret);
      }, 120);
    } else {
      window.clearTimeout(debounceRef.current);
      // Keep the popup open across punctuation triggers (".", "@", "!") that
      // re-open it via keydown; close it for any other non-identifier edit.
      const prevChar = value[caret - 1] ?? "";
      if (!TRIGGERS.has(prevChar)) {
        setCompletion(null);
      }
    }
  }

  function handleScroll() {
    syncScroll();
    if (completion) setCompletion(null);
    if (hover) setHover(null);
  }

  function handleBlur() {
    window.setTimeout(() => setCompletion(null), 150);
    setHover(null);
  }

  async function run() {
    if (!source.trim()) return;

    const id = nextRunId++;
    setRuns((prev) => [...prev, { id, state: "running", at: new Date() }]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10 * 60_000);

    try {
      const response = await fetch("/api/playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, stdin }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as
        | PlaygroundResult
        | { error: string };

      if (!response.ok || "error" in payload) {
        setRuns((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? {
                  id,
                  state: "failed",
                  at: new Date(),
                  error:
                    "error" in payload
                      ? payload.error
                      : `Request failed (${response.status}).`,
                }
              : entry,
          ),
        );
        return;
      }

      setRuns((prev) =>
        prev.map((entry) =>
          entry.id === id ? { id, state: "done", at: new Date(), ...payload } : entry,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Timed out. First runs can take a while while the latest release installs."
          : error instanceof Error
            ? error.message
            : "The playground failed unexpectedly.";
      setRuns((prev) =>
        prev.map((entry) =>
          entry.id === id ? { id, state: "failed", at: new Date(), error: message } : entry,
        ),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // The completion popup owns these keys while it is open.
    if (completion) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCompletion((c) =>
          c ? { ...c, index: (c.index + 1) % c.items.length } : c,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCompletion((c) =>
          c ? { ...c, index: (c.index - 1 + c.items.length) % c.items.length } : c,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        acceptCompletion();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCompletion(null);
        return;
      }
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const next = `${source.slice(0, start)}    ${source.slice(end)}`;
      setSource(next);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      });
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void run();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === " ") {
      event.preventDefault();
      void requestCompletion(source, start);
      return;
    }

    // Auto-close brackets and quotes (wrapping the selection when present).
    const closeChar = PAIRS[event.key];
    if (closeChar && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const selected = source.slice(start, end);
      const insertion = selected ? event.key + selected + closeChar : event.key + closeChar;
      const next = source.slice(0, start) + insertion + source.slice(end);
      setSource(next);
      const caret = start + (selected ? insertion.length - 1 : 1);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = caret;
      });
      return;
    }

    // Skip over an already-inserted closing bracket or quote.
    if (
      CLOSING.has(event.key) &&
      start === end &&
      start < source.length &&
      source[start] === event.key
    ) {
      event.preventDefault();
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
      return;
    }

    // Completion trigger characters: insert them and query the language server.
    if (TRIGGERS.has(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const next = source.slice(0, start) + event.key + source.slice(end);
      setSource(next);
      const caret = start + 1;
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = caret;
      });
      void requestCompletion(next, caret);
      return;
    }

    // Auto-indent on Enter: copy the current indentation and step in after ":".
    if (event.key === "Enter") {
      event.preventDefault();
      const lineStart = source.lastIndexOf("\n", start - 1) + 1;
      const currentLine = source.slice(lineStart, start);
      const indent = (/^[ \t]*/.exec(currentLine) ?? [""])[0];
      const extra = currentLine.trimEnd().endsWith(":") ? "    " : "";
      const insertion = `\n${indent}${extra}`;
      const next = source.slice(0, start) + insertion + source.slice(end);
      setSource(next);
      const caret = start + insertion.length;
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = caret;
      });
      return;
    }
  }

  const running = runs.some((entry) => entry.state === "running");
  const completionStyle: CSSProperties | undefined = completion
    ? { top: completion.top, left: completion.left }
    : undefined;
  const hoverStyle: CSSProperties | undefined = hover
    ? { top: hover.top, left: hover.left }
    : undefined;

  const editorElement = (
    <div className="play-editor">
      <div className="play-head">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-3.5 w-[3px] rounded-full bg-primary shadow-[0_0_10px_rgba(196,88,74,0.85)]" />
          <span className="truncate font-mono text-xs text-foreground/80">main.sere</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSource(DEFAULT_SOURCE)}
            disabled={running}
          >
            Reset
          </Button>
          <Button variant="primary" size="sm" onClick={() => void run()} disabled={running}>
            {running ? (
              <>
                <span className="play-spinner" aria-hidden />
                Running…
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M5 3.5v9l7-4.5-7-4.5z" />
                </svg>
                Run
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="play-editor-body">
        <div className="play-gutter" aria-hidden>
          <div className="play-gutter-inner" ref={gutterInnerRef}>
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        </div>

        <div className="play-code" ref={codeRef}>
          <pre className="play-code-highlight" ref={highlightRef} aria-hidden>
            {highlightSere(source)}
            {"\n"}
          </pre>
          <textarea
            ref={textareaRef}
            className="play-code-input"
            value={source}
            onChange={handleChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onMouseMove={handleEditorMouseMove}
            onMouseLeave={handleEditorMouseLeave}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="off"
            aria-label="Sere source code"
          />
          {completion ? (
            <div className="play-completions" style={completionStyle} role="listbox">
              {completion.items.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  role="option"
                  aria-selected={index === completion.index}
                  className="play-completion"
                  data-active={index === completion.index}
                  title={item.documentation ?? item.detail ?? item.label}
                  onMouseEnter={() =>
                    setCompletion((c) => (c ? { ...c, index } : c))
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    acceptCompletion(index);
                  }}
                >
                  <span className="play-completion-kind">
                    {completionKindIcon(item.kind)}
                  </span>
                  <span className="play-completion-label">{item.label}</span>
                  {item.detail ? (
                    <span className="play-completion-detail">{item.detail}</span>
                  ) : null}
                </div>
              ))}
              {completion.items[completion.index]?.documentation ? (
                <div className="play-completion-docs">
                  {completion.items[completion.index].documentation}
                </div>
              ) : null}
            </div>
          ) : null}
          {hover ? (
            <div className="play-hover" style={hoverStyle}>
              {hover.text}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="play-shell panel-raised">
      <div className="play-tabbar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "run"}
          className="play-tab"
          data-active={activeTab === "run"}
          onClick={() => {
            setActiveTab("run");
            setCompletion(null);
            setHover(null);
          }}
        >
          Run
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ir"}
          className="play-tab"
          data-active={activeTab === "ir"}
          onClick={() => {
            setActiveTab("ir");
            setCompletion(null);
            setHover(null);
          }}
        >
          IR
        </button>
      </div>

      {activeTab === "run" ? (
        <>
          {editorElement}

          {/* Terminal */}
          <div className="play-terminal">
            <div className="play-head">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/80 shadow-[0_0_8px_rgba(196,88,74,0.7)]" />
                </span>
                <span className="truncate font-mono text-xs text-foreground/80">sere — playground</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                {latestToolchain ? (
                  <>
                    <span>{latestToolchain.source === "github" ? "release" : "local"} ·</span>
                    <span className="text-foreground/70">
                      {latestToolchain.releaseTag ?? latestToolchain.version}
                    </span>
                  </>
                ) : (
                  <span>idle</span>
                )}
              </div>
            </div>

            <div className="play-terminal-body" ref={terminalBodyRef}>
              {runs.length === 0 ? (
                <p className="play-terminal-empty">
                  Write some Sere, then press <kbd>Run</kbd> or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>.
                  <br />
                  <span className="play-terminal-hint">
                    Compiled at -O0 for the fastest turnaround.
                  </span>
                </p>
              ) : (
                runs.map((entry) => <RunView key={entry.id} entry={entry} />)
              )}
            </div>

            <div className="play-stdin">
              <span className="play-stdin-label">stdin</span>
              <textarea
                className="play-stdin-input"
                value={stdin}
                onChange={(event) => setStdin(event.target.value)}
                placeholder="Optional input for your program…"
                spellCheck={false}
                rows={2}
                aria-label="Program stdin"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="play-ir-split">
          {editorElement}

          <div className="play-ir-panel">
            <div className="play-head">
              <div className="flex items-center gap-1.5">
                {(["serem", "llvm", "asm"] as EmitMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className="play-ir-mode"
                    data-active={irMode === mode}
                    onClick={() => setIrMode(mode)}
                  >
                    {mode === "serem" ? "Serem" : mode === "llvm" ? "LLVM IR" : "ASM"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-muted">opt</span>
                {OPT_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="play-ir-opt"
                    data-active={irOpt === level}
                    onClick={() => setIrOpt(level)}
                  >
                    -O{level}
                  </button>
                ))}
              </div>
            </div>

            <div className="play-ir-body">
              {irResult?.stderr.trim() ? (
                <pre className="play-stderr">{irResult.stderr.trimEnd()}</pre>
              ) : null}
              <pre className="play-ir-output">{irResult?.output ?? ""}</pre>
              {irLoading ? (
                <div className="play-ir-loading">
                  <span className="play-spinner" aria-hidden /> Emitting…
                </div>
              ) : null}
            </div>

            <div className="play-ir-status">
              {irResult ? (
                <>
                  <span className={irResult.ok ? "text-success" : "text-danger"}>
                    {irResult.ok ? "ok" : "error"}
                  </span>
                  <span>built {formatMs(irResult.durationMs)}</span>
                  {irResult.version ? <span>sere {irResult.version}</span> : null}
                </>
              ) : (
                <span>…</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RunView({ entry }: { entry: RunEntry }) {
  if (entry.state === "running") {
    return (
      <div className="play-entry">
        <div className="play-prompt">
          <span className="play-prompt-mark">❯</span> sere run
          <span className="play-spinner" aria-hidden />
        </div>
      </div>
    );
  }

  if (entry.state === "failed") {
    return (
      <div className="play-entry">
        <div className="play-prompt">
          <span className="play-prompt-mark">❯</span> sere run
        </div>
        <pre className="play-stderr">{entry.error}</pre>
      </div>
    );
  }

  const code = entry.runExitCode ?? entry.buildExitCode;
  const statusTone =
    entry.ok ? "text-success" : code !== 0 ? "text-danger" : "text-muted";

  return (
    <div className="play-entry">
      <div className="play-prompt">
        <span className="play-prompt-mark">❯</span> sere run
      </div>

      {entry.buildStderr.trim() ? (
        <pre className="play-stderr">{entry.buildStderr.trimEnd()}</pre>
      ) : null}

      {entry.runStdout ? <pre className="play-stdout">{entry.runStdout.replace(/\n$/, "")}</pre> : null}
      {entry.runStderr ? <pre className="play-stderr">{entry.runStderr.replace(/\n$/, "")}</pre> : null}

      <div className="play-status">
        <span className={statusTone}>
          {entry.ok ? "exit 0" : code === null ? "terminated" : `exit ${code}`}
        </span>
        <span>
          built {formatMs(entry.buildDurationMs)} · ran {formatMs(entry.runDurationMs)}
        </span>
        {entry.buildTimedOut || entry.runTimedOut ? <span className="text-warning">timed out</span> : null}
        <span>sere {entry.version}</span>
      </div>
    </div>
  );
}
