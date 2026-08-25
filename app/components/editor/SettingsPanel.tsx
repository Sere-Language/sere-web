"use client";

import { useWorkspace } from "./WorkspaceContext";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-start justify-between gap-6 rounded-xl px-1 py-3 text-left hover:bg-white/4"
      onClick={() => onChange(!checked)}
    >
      <span>
        <span className="block text-[13px] text-foreground">{label}</span>
        <span className="mt-0.5 block text-[12px] text-muted">{description}</span>
      </span>
      <span
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-white/12"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export default function SettingsPanel() {
  const {
    settings,
    updateSettings,
    resetLayout,
    emitIrOnRun,
    setEmitIrOnRun,
  } = useWorkspace();

  return (
    <div className="h-full overflow-auto px-8 py-7">
      <div className="mx-auto max-w-xl">
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Preferences
        </p>
        <h2 className="mt-1 mb-6 text-[22px] font-semibold tracking-tight">Settings</h2>

        <section className="mb-8">
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.12em] text-muted">
            Editor
          </h3>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4">
            <div className="flex items-center justify-between gap-6 border-b border-white/6 py-3">
              <span>
                <span className="block text-[13px] text-foreground">Font size</span>
                <span className="mt-0.5 block text-[12px] text-muted">
                  Monaco and the terminal scale together.
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted hover:bg-white/8 hover:text-foreground"
                  onClick={() =>
                    updateSettings({ fontSize: Math.max(11, settings.fontSize - 1) })
                  }
                >
                  −
                </button>
                <span className="w-8 text-center text-[13px] tabular-nums">{settings.fontSize}</span>
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted hover:bg-white/8 hover:text-foreground"
                  onClick={() =>
                    updateSettings({ fontSize: Math.min(18, settings.fontSize + 1) })
                  }
                >
                  +
                </button>
              </div>
            </div>
            <Toggle
              label="Minimap"
              description="Show a code overview on the editor gutter."
              checked={settings.minimap}
              onChange={(minimap) => updateSettings({ minimap })}
            />
            <Toggle
              label="Word wrap"
              description="Wrap long lines instead of scrolling horizontally."
              checked={settings.wordWrap}
              onChange={(wordWrap) => updateSettings({ wordWrap })}
            />
          </div>
        </section>

        <section className="mb-8">
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.12em] text-muted">
            Build
          </h3>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4">
            <Toggle
              label="Emit LLVM / ASM on run"
              description="Refresh the IR and assembly views after a successful build or run."
              checked={emitIrOnRun}
              onChange={setEmitIrOnRun}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.12em] text-muted">
            Layout
          </h3>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <p className="m-0 text-[13px] text-foreground">Workbench layout</p>
            <p className="mt-0.5 mb-3 text-[12px] text-muted">
              Restore the default files, editor, output, and terminal arrangement.
            </p>
            <button
              type="button"
              className="rounded-lg bg-white/8 px-3 py-1.5 text-[12px] text-foreground hover:bg-white/12"
              onClick={resetLayout}
            >
              Reset layout
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
