import type { Metadata } from "next";
import { Suspense } from "react";
import Container from "../../components/Container";
import NewProjectMenu from "../../components/NewProjectMenu";
import Section from "../../components/Section";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Projects",
  description: "Create and open Sere Cloud projects.",
  path: "/cloud/projects",
  noIndex: true,
});

export default function CloudProjectsPage() {
  return (
    <Container className="max-w-7xl">
      <Section className="py-8">
        <Suspense>
          <NewProjectMenu />
        </Suspense>
      </Section>
    </Container>
  );
}
