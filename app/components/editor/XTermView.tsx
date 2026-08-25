"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const NERD_FONT = '"JetBrainsMono Nerd Font Mono", var(--font-geist-mono), ui-monospace, monospace';

const TERM_THEME = {
  background: "#16181c",
  foreground: "#d8d4d0",
  cursor: "#c25248",
  cursorAccent: "#16181c",
  selectionBackground: "#c2524844",
  black: "#16181c",
  red: "#c25248",
  green: "#7dba7a",
  yellow: "#d4b483",
  blue: "#8aa4c8",
  magenta: "#c49bb0",
  cyan: "#8ec0c4",
  white: "#d8d4d0",
  brightBlack: "#7a7572",
  brightRed: "#d4685c",
  brightGreen: "#95d092",
  brightYellow: "#e8cfc4",
  brightBlue: "#a8bee0",
  brightMagenta: "#d4b0c4",
  brightCyan: "#a8d4d6",
  brightWhite: "#eeeae8",
};

export type TerminalHandle = {
  write: (text: string) => void;
  prompt: () => void;
};

interface XTermViewProps {
  projectName: string;
  cwdDisplay: string;
  fontSize?: number;
  onCommand: (line: string) => Promise<{ output: string; cwdDisplay: string }>;
  onInterrupt?: () => void;
  onReady?: (handle: TerminalHandle | null) => void;
}

export default function XTermView({
  projectName,
  cwdDisplay,
  fontSize = 13,
  onCommand,
  onInterrupt,
  onReady,
}: XTermViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef(projectName);
  const cwdRef = useRef(cwdDisplay);
  const commandRef = useRef(onCommand);
  const interruptRef = useRef(onInterrupt);
  nameRef.current = projectName;
  cwdRef.current = cwdDisplay;
  commandRef.current = onCommand;
  interruptRef.current = onInterrupt;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      disableStdin: false,
      fontFamily: NERD_FONT,
      fontSize,
      lineHeight: 1.35,
      theme: TERM_THEME,
      allowTransparency: true,
      scrollback: 4000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    let line = "";
    let history: string[] = [];
    let historyIndex = -1;
    let busy = false;

    const prompt = () => {
      term.write(
        `\x1b[32msere@nano\x1b[0m \x1b[33m${cwdRef.current}\x1b[0m \x1b[36m(sere:${nameRef.current})\x1b[0m\r\n\x1b[32m$\x1b[0m `,
      );
    };

    const write = (text: string) => {
      term.write(text.replace(/\n/g, "\r\n"));
    };

    const handle: TerminalHandle = { write, prompt };

    void document.fonts.ready.then(() => {
      try {
        fit.fit();
      } catch {
        // Hidden containers can throw.
      }
    });
    fit.fit();

    write(
      "\x1b[36mNanoVM\x1b[0m  project root \x1b[33m/work\x1b[0m  \x1b[90m(+ new shell · reload resets cwd)\x1b[0m\r\n",
    );
    prompt();
    onReady?.(handle);

    const runLine = async (command: string) => {
      if (command === "clear" || command === "cls") {
        term.clear();
        prompt();
        return;
      }
      busy = true;
      try {
        const result = await commandRef.current(command);
        cwdRef.current = result.cwdDisplay;
        if (result.output) {
          write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
        }
      } catch (caught) {
        write(`\x1b[31m${caught instanceof Error ? caught.message : "command failed"}\x1b[0m\r\n`);
      } finally {
        busy = false;
        prompt();
      }
    };

    term.onData((data) => {
      if (data === "\u0003") {
        term.write("^C\r\n");
        line = "";
        if (busy) {
          interruptRef.current?.();
        } else {
          prompt();
        }
        return;
      }
      if (busy) {
        return;
      }
      if (data === "\r") {
        const command = line;
        term.write("\r\n");
        line = "";
        historyIndex = -1;
        if (command.trim()) {
          history = [...history.filter((item) => item !== command), command];
        }
        void runLine(command);
        return;
      }
      if (data === "\u000c") {
        term.clear();
        prompt();
        return;
      }
      if (data === "\u007f") {
        if (line.length > 0) {
          line = line.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }
      if (data === "\x1b[A") {
        if (history.length === 0) {
          return;
        }
        historyIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
        while (line.length > 0) {
          term.write("\b \b");
          line = line.slice(0, -1);
        }
        line = history[historyIndex] ?? "";
        term.write(line);
        return;
      }
      if (data === "\x1b[B") {
        while (line.length > 0) {
          term.write("\b \b");
          line = line.slice(0, -1);
        }
        if (historyIndex < 0) {
          return;
        }
        historyIndex += 1;
        if (historyIndex >= history.length) {
          historyIndex = -1;
          return;
        }
        line = history[historyIndex] ?? "";
        term.write(line);
        return;
      }
      if (data < " " || data.startsWith("\x1b")) {
        return;
      }
      line += data;
      term.write(data);
    });

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // Fit can throw if the container is hidden.
      }
    });
    observer.observe(host);

    return () => {
      onReady?.(null);
      observer.disconnect();
      term.dispose();
    };
  }, [fontSize, onReady]);

  return <div ref={hostRef} className="h-full min-h-0 w-full px-3 py-2.5" />;
}
