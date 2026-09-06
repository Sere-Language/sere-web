"use client";

import { useCallback, useMemo } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import ArrowRotateRight from "@gravity-ui/icons/ArrowRotateRight";
import Plus from "@gravity-ui/icons/Plus";
import { DEFAULT_SHELL_ID } from "@/app/lib/workbenchLayout";
import WbIcon from "./WbIcon";
import XTermView, { type TerminalHandle } from "./XTermView";
import { useWorkspace } from "./WorkspaceContext";

export default function TerminalPanel(
  props: IDockviewPanelProps<{ sessionId?: string }>,
) {
  const sessionId = props.params?.sessionId ?? DEFAULT_SHELL_ID;
  const {
    projectName,
    runTerminalCommand,
    registerTerminal,
    openNewShell,
    reloadShell,
    terminalSessions,
    settings,
    stop,
  } = useWorkspace();

  const session = useMemo(
    () => terminalSessions.find((entry) => entry.id === sessionId),
    [sessionId, terminalSessions],
  );

  const onReady = useCallback(
    (handle: TerminalHandle | null) => {
      registerTerminal(sessionId, handle);
    },
    [registerTerminal, sessionId],
  );

  const onCommand = useCallback(
    (line: string) => runTerminalCommand(line, sessionId),
    [runTerminalCommand, sessionId],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-transparent">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
        <button
          type="button"
          title="New shell"
          aria-label="New shell"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-foreground"
          onClick={openNewShell}
        >
          <WbIcon icon={Plus} className="size-3.5" />
        </button>
        <button
          type="button"
          title="Reload shell"
          aria-label="Reload shell"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-foreground"
          onClick={() => reloadShell(sessionId)}
        >
          <WbIcon icon={ArrowRotateRight} className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <XTermView
          key={`${sessionId}:${session?.generation ?? 0}:${settings.fontSize}`}
          projectName={projectName}
          cwdDisplay={session?.cwd ?? "/work"}
          fontSize={settings.fontSize}
          onCommand={onCommand}
          onInterrupt={stop}
          onReady={onReady}
        />
      </div>
    </div>
  );
}
