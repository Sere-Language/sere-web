"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { markProjectOpened } from "@/app/lib/projectActivity";
import {
  getProjectBySlug,
  type CloudProject,
} from "@/app/lib/projects";
import ProjectLoadingScreen from "./editor/ProjectLoadingScreen";

const Workbench = dynamic(() => import("./editor/Workbench"), {
  ssr: false,
});

interface ProjectEditorShellProps {
  slug: string;
}

export default function ProjectEditorShell({ slug }: ProjectEditorShellProps) {
  const [project, setProject] = useState<CloudProject | null>(null);
  const [error, setError] = useState("");
  const [projectReady, setProjectReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProject(null);
    setError("");
    setProjectReady(false);

    void getProjectBySlug(slug)
      .then((next) => {
        if (cancelled) {
          return;
        }

        setProject(next);
        setError(next ? "" : "This project was not found.");
        setProjectReady(true);
        if (next) {
          markProjectOpened(next.slug);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }

        setError(caught instanceof Error ? caught.message : "Could not open this project.");
        setProjectReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0 flex-col bg-[#0c0e10]">
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="m-0 text-lg font-semibold tracking-tight">{error}</p>
          <p className="m-0 max-w-sm text-sm text-muted">
            This workspace is missing, or you do not have access.
          </p>
          <Link href="/cloud/projects" className="text-sm">
            Back to projects
          </Link>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          {project && projectReady ? (
            <Workbench
              projectId={project.id}
              kind={project.kind}
              projectName={project.name}
            />
          ) : (
            <ProjectLoadingScreen
              projectName={slug}
              percent={16}
              label="Opening project…"
            />
          )}
        </div>
      )}
    </div>
  );
}
