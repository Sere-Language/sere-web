import { projectKindLabel, type ProjectKind } from "@/app/lib/projects";

export default function KindBadge({ kind }: { kind: ProjectKind }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        kind === "lib"
          ? "bg-accent/10 text-accent"
          : "bg-primary/15 text-primary-hover"
      }`}
    >
      {projectKindLabel(kind)}
    </span>
  );
}
