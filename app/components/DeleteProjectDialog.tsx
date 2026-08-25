"use client";

import { FormEvent, useEffect, useState } from "react";
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
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const matches = typedName.trim() === project.name;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Close delete dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-md">
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Heading level={3}>Delete {project.name}</Heading>
            <Text muted className="text-sm leading-6">
              This cannot be undone. Type{" "}
              <span className="font-mono text-foreground">{project.name}</span> to
              confirm.
            </Text>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Project name
              <input
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                autoFocus
                autoComplete="off"
                className="w-full px-3 py-2 text-sm"
                placeholder={project.name}
              />
            </label>
            {error ? <Text className="text-sm text-danger">{error}</Text> : null}
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
