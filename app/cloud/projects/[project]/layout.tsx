import ProjectEditorShell from "../../../components/ProjectEditorShell";

interface ProjectEditorLayoutProps {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}

export default async function ProjectEditorLayout({
  params,
}: ProjectEditorLayoutProps) {
  const { project } = await params;

  return <ProjectEditorShell slug={decodeURIComponent(project)} />;
}
