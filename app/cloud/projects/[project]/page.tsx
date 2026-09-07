import type { Metadata } from "next";

interface ProjectPageProps {
  params: Promise<{ project: string }>;
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { project } = await params;
  return {
    title: `${decodeURIComponent(project)} - Sere Cloud`,
  };
}

export default function CloudProjectPage() {
  return null;
}
