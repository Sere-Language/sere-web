import type { DockviewApi } from "dockview-react";
import type { ProjectKind } from "./projects";
import { defaultOpenPath, editorPanelId, fileTitle } from "./workspace";

export const FILES_PANEL_ID = "files";
export const OUTPUT_PANEL_ID = "output";
export const TERMINAL_PANEL_ID = "terminal";
export const IR_ASM_PANEL_ID = "ir-asm";
export const SETTINGS_PANEL_ID = "settings";
export const SEARCH_PANEL_ID = "search";
export const DEFAULT_SHELL_ID = "default";

export function terminalPanelId(sessionId: string): string {
  return sessionId === DEFAULT_SHELL_ID ? TERMINAL_PANEL_ID : `terminal:${sessionId}`;
}

export function shellIdFromPanelId(panelId: string): string | null {
  if (panelId === TERMINAL_PANEL_ID) {
    return DEFAULT_SHELL_ID;
  }
  if (panelId.startsWith("terminal:")) {
    return panelId.slice("terminal:".length);
  }
  return null;
}

export const FILES_PANEL_WIDTH = 288;
export const OUTPUT_PANEL_WIDTH = 300;

export function applyDefaultLayout(api: DockviewApi, kind: ProjectKind): void {
  api.clear();

  const openPath = defaultOpenPath(kind);
  const editorId = editorPanelId(openPath);

  api.addPanel({
    id: editorId,
    component: "editor",
    title: fileTitle(openPath),
    params: { path: openPath },
    minimumWidth: 360,
  });

  api.addPanel({
    id: FILES_PANEL_ID,
    component: "files",
    title: "Files",
    position: { referencePanel: editorId, direction: "left" },
    initialWidth: FILES_PANEL_WIDTH,
    minimumWidth: 180,
    maximumWidth: 480,
  });

  api.addPanel({
    id: OUTPUT_PANEL_ID,
    component: "output",
    title: "Output",
    position: { referencePanel: editorId, direction: "right" },
    initialWidth: OUTPUT_PANEL_WIDTH,
    minimumWidth: 240,
  });

  api.addPanel({
    id: IR_ASM_PANEL_ID,
    component: "irAsm",
    title: "LLVM IR",
    position: { referencePanel: OUTPUT_PANEL_ID, direction: "below" },
    initialHeight: 220,
  });

  api.addPanel({
    id: TERMINAL_PANEL_ID,
    component: "terminal",
    title: "Terminal",
    params: { sessionId: DEFAULT_SHELL_ID },
    position: { referencePanel: editorId, direction: "below" },
    initialHeight: 200,
  });

  api.getPanel(editorId)?.api.setActive();

  window.requestAnimationFrame(() => {
    api.getPanel(FILES_PANEL_ID)?.group.api.setSize({ width: FILES_PANEL_WIDTH });
    api.getPanel(OUTPUT_PANEL_ID)?.group.api.setSize({ width: OUTPUT_PANEL_WIDTH });
    api.getPanel(TERMINAL_PANEL_ID)?.group.api.setSize({ height: 200 });
  });
}

export function focusBuildSurfaces(api: DockviewApi, kind: ProjectKind): void {
  const editorId = editorPanelId(defaultOpenPath(kind));

  ensurePanel(api, OUTPUT_PANEL_ID, {
    component: "output",
    title: "Output",
    referenceId: editorId,
    direction: "right",
  });
  ensurePanel(api, IR_ASM_PANEL_ID, {
    component: "irAsm",
    title: "LLVM IR",
    referenceId: OUTPUT_PANEL_ID,
    direction: "below",
  });
  ensurePanel(api, TERMINAL_PANEL_ID, {
    component: "terminal",
    title: "Terminal",
    referenceId: editorId,
    direction: "below",
    params: { sessionId: DEFAULT_SHELL_ID },
  });

  api.getPanel(OUTPUT_PANEL_ID)?.api.setActive();
  api.getPanel(TERMINAL_PANEL_ID)?.api.setActive();
  api.getPanel(IR_ASM_PANEL_ID)?.api.setActive();

  window.requestAnimationFrame(() => {
    api.getPanel(OUTPUT_PANEL_ID)?.group.api.setSize({ width: OUTPUT_PANEL_WIDTH });
    api.getPanel(TERMINAL_PANEL_ID)?.group.api.setSize({ height: 200 });
    api.getPanel(IR_ASM_PANEL_ID)?.group.api.setSize({ height: 220 });
  });
}

export function ensurePanel(
  api: DockviewApi,
  id: string,
  options: {
    component: string;
    title: string;
    referenceId: string;
    direction?: "left" | "right" | "within" | "below" | "above";
    params?: Record<string, unknown>;
  },
): void {
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }

  const reference = api.getPanel(options.referenceId) ?? api.activePanel;
  api.addPanel({
    id,
    component: options.component,
    title: options.title,
    params: options.params,
    position: reference
      ? { referencePanel: reference.id, direction: options.direction ?? "within" }
      : undefined,
  });
}
