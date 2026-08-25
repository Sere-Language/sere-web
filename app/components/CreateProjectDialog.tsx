"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
      className={`rounded-lg border px-3 py-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-background/40 hover:border-primary/35"
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
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

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
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Close create dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-md">
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
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Project name
              <input
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                placeholder={kind === "lib" ? "mathlib" : "hello-world"}
                required
                autoFocus
                className="w-full px-3 py-2 text-sm"
              />
            </label>
            <Text muted className="font-mono text-xs">
              {slug
                ? `/cloud/projects/${slug} · ${projectKindLabel(kind)}`
                : `/cloud/projects/… · ${projectKindLabel(kind)}`}
            </Text>
            {error ? <Text className="text-sm text-danger">{error}</Text> : null}
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
