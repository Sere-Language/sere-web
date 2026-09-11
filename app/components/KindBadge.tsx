import { projectKindLabel, type ProjectKind } from "@/app/lib/projects";

export default function KindBadge({ kind }: { kind: ProjectKind }) {
  const isLib = kind === "lib";

  return (
    <span
      className={`badge shrink-0 gap-1.5 text-[11px] font-medium ${
        isLib ? "text-accent" : "text-primary-hover"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isLib
            ? "bg-accent shadow-[0_0_6px_rgba(231,210,199,0.8)]"
            : "bg-primary shadow-[0_0_6px_rgba(196,88,74,0.9)]"
        }`}
      />
      {projectKindLabel(kind)}
    </span>
  );
}
