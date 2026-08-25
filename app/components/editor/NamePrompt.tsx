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
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <form
        className="w-full max-w-sm rounded-2xl border border-white/8 bg-[#16191c]/80 p-5 shadow-lg backdrop-blur-2xl"
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
            className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
