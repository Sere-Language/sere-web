import {
    formatProjectCreatedAt,
    formatRelativeTime,
    projectPath,
    type CloudProject,
} from "@/app/lib/projects";
import Link from "next/link";
import Button from "./Button";
import KindBadge from "./KindBadge";

interface ProjectTileProps {
  project: CloudProject;
  lastOpened?: string | null;
  onDelete?: (project: CloudProject) => void;
}

export default function ProjectTile({
  project,
  lastOpened,
  onDelete,
}: ProjectTileProps) {
  const activityIso = lastOpened ?? project.createdAt;
  const activityLabel = lastOpened ? "Opened" : "Created";

  return (
    <article className="panel panel-interactive flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={projectPath(project.slug)}
            className="block truncate text-sm font-semibold tracking-tight text-foreground no-underline hover:text-primary hover:no-underline"
          >
            {project.name}
          </Link>
          <p className="m-0 mt-1 truncate font-mono text-[11px] text-muted">
            {project.slug}
          </p>
        </div>
        <KindBadge kind={project.kind} />
      </div>
      <div className="rule" />
      <p
        className="m-0 text-xs text-muted"
        title={formatProjectCreatedAt(activityIso)}
      >
        {activityLabel} {formatRelativeTime(activityIso)}
      </p>
      <div className="flex items-center gap-2">
        <Button href={projectPath(project.slug)} variant="secondary" className="text-xs">
          Open
        </Button>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="px-2.5 py-1 text-xs"
            onClick={() => onDelete(project)}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </article>
  );
}
