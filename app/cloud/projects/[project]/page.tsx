import type { Metadata } from "next";
import { pageMetadata } from "../../../lib/seo";

interface ProjectPageProps {
  params: Promise<{ project: string }>;
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { project } = await params;
  const name = decodeURIComponent(project);
  return pageMetadata({
    title: `${name} — Sere Cloud`,
    description: `The Sere Cloud editor workspace for ${name}.`,
    path: `/cloud/projects/${project}`,
    absoluteTitle: true,
    noIndex: true,
  });
}

export default function CloudProjectPage() {
  return null;
}
