"use client";

import { useState } from "react";
import LoginPage from "../cloud/auth/login/page";
import SignUpPage from "../cloud/auth/signup/page";
import Button from "../components/Button";
import CreateProjectDialog from "../components/CreateProjectDialog";
import DeleteProjectDialog from "../components/DeleteProjectDialog";
import NamePrompt from "../components/editor/NamePrompt";

const sampleProject = {
  id: "design-review-only",
  name: "hello-world",
  slug: "design-review-only",
  kind: "app" as const,
  createdAt: "2026-09-05T12:00:00Z",
};

export default function DesignReviewPage() {
  const [page, setPage] = useState<"login" | "signup">("login");
  const [dialog, setDialog] = useState<"create" | "delete" | "name" | null>(null);

  return (
    <div
      onSubmitCapture={(event) => {
        // Only blank auth validation runs; no preview form can reach a service.
        const fields = new FormData(event.target as HTMLFormElement);
        const hasValues = Array.from(fields.values()).some((value) => String(value).trim());
        if (dialog || hasValues) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap gap-2 border-b border-border px-6 py-4">
        <Button variant="secondary" onClick={() => setPage("login")}>Preview login</Button>
        <Button variant="secondary" onClick={() => setPage("signup")}>Preview signup</Button>
        <Button variant="secondary" onClick={() => setDialog("create")}>Preview create dialog</Button>
        <Button variant="secondary" onClick={() => setDialog("delete")}>Preview delete dialog</Button>
        <Button variant="secondary" onClick={() => setDialog("name")}>Preview name prompt</Button>
      </div>
      {page === "login" ? <LoginPage /> : <SignUpPage />}
      <CreateProjectDialog open={dialog === "create"} onClose={() => setDialog(null)} />
      {dialog === "delete" ? (
        <DeleteProjectDialog project={sampleProject} onClose={() => setDialog(null)} onDeleted={() => setDialog(null)} />
      ) : null}
      {dialog === "name" ? (
        <NamePrompt title="New file" label="File name" onCancel={() => setDialog(null)} onConfirm={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
