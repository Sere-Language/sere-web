"use client";

import { useEffect, useRef, useState } from "react";

interface NamePromptProps {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export default function NamePrompt({
  title,
  label,
  initialValue = "",
  confirmLabel = "Create",
  onCancel,
  onConfirm,
}: NamePromptProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => previousFocus?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
          if (event.key === "Tab") {
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input, button"));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(value);
        }}
      >
        <p className="m-0 text-sm font-medium">{title}</p>
        <label className="mt-3 block text-xs text-muted">
          {label}
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="min-h-9 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-9 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
