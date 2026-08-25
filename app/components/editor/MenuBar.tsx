"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface MenuBarProps {
  label: string;
  children: ReactNode;
}

export default function MenuBar({ label, children }: MenuBarProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onDismiss() {
      setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("scroll", onDismiss, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("scroll", onDismiss, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={`rounded-md px-2.5 py-1 text-[12px] ${
          open ? "bg-white/10 text-foreground" : "text-muted hover:bg-white/6 hover:text-foreground"
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[200] min-w-52 rounded-lg border border-white/10 bg-[#141618]/95 p-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              style={{ top: pos.top, left: pos.left }}
              onClick={() => setOpen(false)}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

interface MenuItemProps {
  children: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  onClick?: () => void;
}

export function MenuItem({ children, disabled, danger, checked, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12px] disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-white/6"
      }`}
      onClick={onClick}
    >
      <span className="w-3 shrink-0 text-[10px] text-muted">{checked ? "✓" : ""}</span>
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="mx-1.5 my-1 border-t border-white/8" />;
}
