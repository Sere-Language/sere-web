const STORAGE_KEY = "sere-cloud-workbench";

export type WorkbenchSettings = {
  emitIrOnRun: boolean;
  fontSize: number;
  minimap: boolean;
  wordWrap: boolean;
};

export const DEFAULT_WORKBENCH_SETTINGS: WorkbenchSettings = {
  emitIrOnRun: true,
  fontSize: 13,
  minimap: false,
  wordWrap: false,
};

function clampFontSize(value: unknown): number {
  const size = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(size)) {
    return DEFAULT_WORKBENCH_SETTINGS.fontSize;
  }
  return Math.min(18, Math.max(11, Math.round(size)));
}

export function loadWorkbenchSettings(): WorkbenchSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_WORKBENCH_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_WORKBENCH_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<WorkbenchSettings>;
    return {
      emitIrOnRun: parsed.emitIrOnRun !== false,
      fontSize: clampFontSize(parsed.fontSize),
      minimap: parsed.minimap === true,
      wordWrap: parsed.wordWrap === true,
    };
  } catch {
    return { ...DEFAULT_WORKBENCH_SETTINGS };
  }
}

export function saveWorkbenchSettings(settings: WorkbenchSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
