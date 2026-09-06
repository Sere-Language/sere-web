"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { deleteProject, type CloudProject } from "@/app/lib/projects";
import Button from "./Button";
import Heading from "./Heading";
import Stack from "./Stack";
import Text from "./Text";

interface DeleteProjectDialogProps {
  project: CloudProject;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: DeleteProjectDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const matches = typedName.trim() === project.name;

  useEffect(() => {
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
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await deleteProject(project.slug);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this project.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        tabIndex={-1}
        aria-label="Close delete dialog"
        onClick={onClose}
      />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Delete project" className="relative z-10 max-h-[calc(100svh-2rem)] overflow-y-auto w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-md">
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Heading level={3}>Delete {project.name}</Heading>
            <Text muted className="text-sm leading-6">
              This cannot be undone. Type{" "}
              <span className="font-mono text-foreground">{project.name}</span> to
              confirm.
            </Text>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              Project name
              <input
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "delete-project-error" : undefined}
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 text-sm"
                placeholder={project.name}
              />
            </label>
            {error ? <p id="delete-project-error" role="alert" className="m-0 text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="danger" disabled={!matches || loading}>
                {loading ? "Deleting..." : "Delete project"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
            </div>
          </Stack>
        </form>
      </div>
    </div>
  );
}
