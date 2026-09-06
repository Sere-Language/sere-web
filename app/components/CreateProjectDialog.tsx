"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProject,
  projectKindLabel,
  projectPath,
  slugifyProjectName,
  type ProjectKind,
} from "@/app/lib/projects";
import Button from "./Button";
import Heading from "./Heading";
import Stack from "./Stack";
import Text from "./Text";

function KindOption({
  kind,
  selected,
  title,
  body,
  onSelect,
}: {
  kind: ProjectKind;
  selected: boolean;
  title: string;
  body: string;
  onSelect: (kind: ProjectKind) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(kind)}
      aria-pressed={selected}
      className={`rounded-lg border px-3 py-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:bg-secondary"
      }`}
    >
      <p className="m-0 text-sm font-medium text-foreground">{title}</p>
      <p className="m-0 mt-1 text-xs leading-5 text-muted">{body}</p>
    </button>
  );
}

interface CreateProjectDialogProps {
  open: boolean;
  initialKind?: ProjectKind;
  onClose: () => void;
}

export default function CreateProjectDialog({
  open,
  initialKind = "app",
  onClose,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProjectKind>(initialKind);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const slug = useMemo(() => slugifyProjectName(name), [name]);

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setName("");
      setError("");
      setCreating(false);
    }
  }, [initialKind, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]',
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!dialogRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug) {
      setError("Use letters or numbers in the project name.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      await createProject({
        name: name.trim(),
        slug,
        kind,
      });
      router.push(projectPath(slug));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this project.");
      setCreating(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        tabIndex={-1}
        aria-label="Close create dialog"
        onClick={onClose}
      />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="New project" className="relative z-10 max-h-[calc(100svh-2rem)] overflow-y-auto w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-md">
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Heading level={3}>New project</Heading>
            <Text muted className="text-sm leading-6">
              Apps compile to a binary. Libraries pack to an <code>.slib</code>.
            </Text>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <KindOption
                kind="app"
                selected={kind === "app"}
                title="App"
                body="src/main.sere, then build and run."
                onSelect={setKind}
              />
              <KindOption
                kind="lib"
                selected={kind === "lib"}
                title="Library"
                body="src/lib.sere, then pack for reuse."
                onSelect={setKind}
              />
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              Project name
              <input
                name="name"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "create-project-error" : undefined}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                placeholder={kind === "lib" ? "mathlib" : "hello-world"}
                required
                className="w-full px-3 py-2 text-sm"
              />
            </label>
            <Text muted className="font-mono text-xs">
              {slug
                ? `/cloud/projects/${slug} · ${projectKindLabel(kind)}`
                : `/cloud/projects/… · ${projectKindLabel(kind)}`}
            </Text>
            {error ? <p id="create-project-error" role="alert" className="m-0 text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={creating}>
                {creating
                  ? "Creating..."
                  : `Create ${kind === "lib" ? "library" : "app"}`}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
                Cancel
              </Button>
            </div>
          </Stack>
        </form>
      </div>
    </div>
  );
}
